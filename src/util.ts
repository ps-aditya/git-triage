import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  "vendor",
  "target",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
  ".vscode-test",
  ".cache",
]);

export const ASSET_EXTENSIONS = new Set([
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".bmp",
]);

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

export function extensionOf(file: string): string {
  return path.extname(file).toLowerCase();
}

export function isAssetFile(file: string): boolean {
  return ASSET_EXTENSIONS.has(extensionOf(file));
}

export function fileExists(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

export function dirExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export interface WalkResult {
  files: string[];
  skipped: number;
  truncated: boolean;
}

export function walkFiles(
  root: string,
  options: { maxFiles?: number; skipDirs?: Set<string> } = {},
): WalkResult {
  const maxFiles = options.maxFiles ?? 50_000;
  const skipDirs = options.skipDirs ?? SKIP_DIRS;
  const files: string[] = [];
  let skipped = 0;
  let truncated = false;

  const visit = (dir: string): void => {
    if (truncated) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      skipped += 1;
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (truncated) return;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        skipped += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        visit(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
      files.push(toPosix(path.relative(root, full)));
    }
  };

  visit(root);
  return { files, skipped, truncated };
}

export function readTextFile(file: string, maxBytes = 1_000_000): string | null {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const buffer = fs.readFileSync(file);
    if (buffer.includes(0)) return null;
    const text = buffer.toString("utf8");
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch {
    return null;
  }
}

export function readHead(file: string, bytes = 4096): Buffer | null {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(bytes);
      const read = fs.readSync(fd, buffer, 0, bytes, 0);
      return buffer.subarray(0, read);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

export function looksLikeText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  if (buffer.includes(0)) return false;
  let printable = 0;
  for (const byte of buffer) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
      printable += 1;
    }
  }
  return printable / buffer.length > 0.85;
}

export function lineOf(text: string, index: number): number {
  if (index <= 0) return 1;
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

export function findLine(text: string, needle: string): number | undefined {
  const index = text.indexOf(needle);
  if (index === -1) return undefined;
  return lineOf(text, index);
}

export function maskSecret(value: string): string {
  if (value.startsWith("-----BEGIN")) {
    return "-----BEGIN … PRIVATE KEY-----";
  }
  const prefixes = [
    "github_pat_",
    "glimt-",
    "glpat-",
    "glrt-",
    "glcbt-",
    "glptt-",
    "gldt-",
    "glsoat-",
    "glffct-",
    "sk-ant-",
    "sk-proj-",
    "npm_",
    "ghp_",
    "gho_",
    "ghu_",
    "ghs_",
    "ghr_",
    "AKIA",
    "ASIA",
    "sk-",
  ];
  const prefix = prefixes.find((p) => value.startsWith(p)) ?? value.slice(0, 4);
  const last4 = value.slice(-4);
  return `${prefix}…${last4}`;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function truncate(value: string, max = 160): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * Removes // and /* *\/ comments and trailing commas from JSONC.
 * String-aware so URLs like https://... survive.
 */
export function stripJsonComments(input: string): string {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inLine) {
      if (char === "\n") {
        inLine = false;
        out += char;
      }
      continue;
    }

    if (inBlock) {
      if (char === "*" && next === "/") {
        inBlock = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLine = true;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlock = true;
      i += 1;
      continue;
    }

    out += char;
  }

  return out.replace(/,\s*([}\]])/g, "$1");
}

export interface IniEntry {
  section: string;
  key: string;
  value: string;
  line: number;
}

export function parseIni(text: string): IniEntry[] {
  const entries: IniEntry[] = [];
  let section = "";
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    entries.push({ section, key, value, line: i + 1 });
  }
  return entries;
}

export function resolveGitDir(root: string): string | null {
  const dotGit = path.join(root, ".git");
  try {
    const stat = fs.statSync(dotGit);
    if (stat.isDirectory()) return dotGit;
    if (stat.isFile()) {
      const content = fs.readFileSync(dotGit, "utf8").trim();
      const match = content.match(/^gitdir:\s*(.+)$/m);
      if (match) return path.resolve(root, match[1].trim());
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveCommonDir(gitDir: string): string {
  const commonFile = path.join(gitDir, "commondir");
  try {
    const content = fs.readFileSync(commonFile, "utf8").trim();
    if (content) return path.resolve(gitDir, content);
  } catch {
    // Not a linked worktree.
  }
  return gitDir;
}

export function isProbablyBinaryFile(file: string): boolean {
  const head = readHead(file, 2048);
  if (!head) return true;
  return !looksLikeText(head);
}
