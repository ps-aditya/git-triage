import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { redactSecrets } from "../redact.js";
import { SECRET_RULES } from "../rules.js";
import type { Finding } from "../types.js";
import { maskSecret, readTextFile, sha256, truncate } from "../util.js";

export interface SecretScanResult {
  findings: Finding[];
  commits: number;
  truncated: boolean;
}

function findingFor(
  rule: (typeof SECRET_RULES)[number],
  secret: string,
  evidenceLine: string,
  file: string | undefined,
  line: number | undefined,
  commit: string | undefined,
  source: string,
): Finding {
  return {
    ruleId: rule.id,
    category: "secret",
    severity: rule.severity,
    title: rule.title,
    message: `${rule.description} Found ${source}.`,
    file,
    line,
    commit,
    evidence: redactSecrets(truncate(evidenceLine, 200)),
    remediation: rule.remediation,
    fingerprint: `${rule.id}:${sha256(secret)}:${file ?? ""}`,
  };
}

export function checkSecretsWorkingTree(root: string, files: string[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const relative of files) {
    if (relative.startsWith(".git/") || relative === ".git") continue;
    const text = readTextFile(path.join(root, relative), 1_000_000);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line || line.length > 10_000) continue;

      for (const rule of SECRET_RULES) {
        rule.regex.lastIndex = 0;
        const match = rule.regex.exec(line);
        if (!match) continue;
        const raw = match[0];

        // Avoid double-reporting an Anthropic key as a generic OpenAI key.
        if (rule.id === "openai-key" && raw.startsWith("sk-ant-")) continue;

        const fingerprint = `${rule.id}:${sha256(raw)}:${relative}`;
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);

        findings.push(
          findingFor(rule, raw, line, relative, index + 1, undefined, "in the working tree"),
        );
      }
    }
  }

  return findings;
}

export async function checkSecretsHistory(
  root: string,
  maxCommits = 500,
  maxBytes = 100_000_000,
): Promise<SecretScanResult> {
  return new Promise((resolve) => {
    const findings: Finding[] = [];
    const seen = new Set<string>();
    let commits = 0;
    let bytes = 0;
    let truncated = false;
    let settled = false;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve({ findings, commits, truncated });
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        "git",
        [
          "log",
          "-p",
          "--all",
          `--max-count=${Math.max(1, Math.floor(maxCommits))}`,
          "--no-color",
          "--no-ext-diff",
          "--unified=0",
        ],
        { cwd: root, stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
      );
    } catch {
      finish();
      return;
    }

    child.on("error", finish);
    child.on("close", finish);

    if (!child.stdout) {
      finish();
      return;
    }

    let currentCommit: string | undefined;
    let currentFile: string | undefined;

    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => {
      bytes += line.length + 1;
      if (bytes > maxBytes) {
        truncated = true;
        child.kill();
        rl.close();
        return;
      }

      if (line.startsWith("commit ")) {
        currentCommit = line.slice(7).trim().slice(0, 40);
        currentFile = undefined;
        commits += 1;
        return;
      }

      if (line.startsWith("+++ b/")) {
        currentFile = line.slice(6);
        return;
      }

      if (line.startsWith("+++ ") || line.startsWith("--- ")) {
        currentFile = undefined;
        return;
      }

      const isAdded = line.startsWith("+") && !line.startsWith("+++");
      const isRemoved = line.startsWith("-") && !line.startsWith("---");
      if (!isAdded && !isRemoved) return;

      const content = line.slice(1);
      if (!content || content.length > 10_000) return;

      for (const rule of SECRET_RULES) {
        rule.regex.lastIndex = 0;
        const match = rule.regex.exec(content);
        if (!match) continue;
        const raw = match[0];

        if (rule.id === "openai-key" && raw.startsWith("sk-ant-")) continue;

        const fingerprint = `${rule.id}:${sha256(raw)}:${currentFile ?? ""}`;
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);

        findings.push(
          findingFor(rule, raw, content, currentFile, undefined, currentCommit, "in git history"),
        );
      }
    });

    rl.on("close", () => {
      // The process may still emit close; finish is idempotent.
      setTimeout(finish, 0);
    });
  });
}

export async function checkSecrets(
  root: string,
  files: string[],
  options: { history?: boolean; maxCommits?: number } = {},
): Promise<SecretScanResult> {
  const working = checkSecretsWorkingTree(root, files);
  if (!options.history) {
    return { findings: working, commits: 0, truncated: false };
  }
  const history = await checkSecretsHistory(root, options.maxCommits ?? 500);
  return {
    findings: [...working, ...history.findings],
    commits: history.commits,
    truncated: history.truncated,
  };
}
