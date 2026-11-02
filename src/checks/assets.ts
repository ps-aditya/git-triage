import path from "node:path";
import { redactSecrets } from "../redact.js";
import { SCRIPT_INDICATORS } from "../rules.js";
import type { Finding } from "../types.js";
import {
  extensionOf,
  fileExists,
  isAssetFile,
  looksLikeText,
  readHead,
  truncate,
} from "../util.js";

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function isExpectedMagic(file: string, head: Buffer): boolean {
  const ext = extensionOf(file);
  switch (ext) {
    case ".woff2":
      return head.subarray(0, 4).toString("ascii") === "wOF2";
    case ".woff":
      return head.subarray(0, 4).toString("ascii") === "wOFF";
    case ".ttf":
      return (
        startsWith(head, [0x00, 0x01, 0x00, 0x00]) ||
        head.subarray(0, 4).toString("ascii") === "true" ||
        head.subarray(0, 4).toString("ascii") === "ttcf"
      );
    case ".otf":
      return head.subarray(0, 4).toString("ascii") === "OTTO";
    case ".png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47]);
    case ".jpg":
    case ".jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case ".gif":
      return head.subarray(0, 4).toString("ascii") === "GIF8";
    case ".ico":
      return startsWith(head, [0x00, 0x00, 0x01, 0x00]);
    case ".bmp":
      return head.subarray(0, 2).toString("ascii") === "BM";
    case ".webp":
      return (
        head.subarray(0, 4).toString("ascii") === "RIFF" &&
        head.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case ".svg": {
      const text = head.toString("utf8").trimStart().toLowerCase();
      return text.startsWith("<svg") || text.startsWith("<?xml");
    }
    default:
      return false;
  }
}

export function looksLikeScript(file: string): boolean {
  if (!fileExists(file)) return false;
  const head = readHead(file, 8192);
  if (!head) return false;

  // A real font/image magic number wins; don't flag valid assets.
  if (isExpectedMagic(file, head)) return false;

  if (!looksLikeText(head)) return false;
  const text = head.toString("utf8");
  return SCRIPT_INDICATORS.some((pattern) => pattern.test(text));
}

function firstLine(value: string): string {
  return truncate(value.split(/\r?\n/).find((line) => line.trim().length > 0) ?? value, 120);
}

export function checkAssets(root: string, files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const relative of files) {
    if (!isAssetFile(relative)) continue;
    const absolute = path.join(root, relative);
    const head = readHead(absolute, 8192);
    if (!head || head.length === 0) continue;
    if (isExpectedMagic(relative, head)) continue;

    const text = looksLikeText(head) ? head.toString("utf8") : "";
    const evidence = text ? redactSecrets(firstLine(text)) : undefined;

    if (looksLikeScript(absolute)) {
      findings.push({
        ruleId: "asset-is-script",
        category: "malware",
        severity: "critical",
        title: "Asset is actually a script",
        message: `${relative} has a font/image extension but contains executable script code.`,
        file: relative,
        line: 1,
        evidence,
        remediation:
          "Do not open the repository in a trusted workspace. Quarantine the file, remove it from every branch, and rotate any credentials that may have been exposed.",
      });
      continue;
    }

    if (head.subarray(0, 4).toString("binary") === "PK\u0003\u0004") {
      findings.push({
        ruleId: "asset-is-archive",
        category: "malware",
        severity: "high",
        title: "Asset is a ZIP archive",
        message: `${relative} is a ZIP archive, not a valid ${extensionOf(relative)} file.`,
        file: relative,
        line: 1,
        remediation:
          "Inspect the archive contents before opening the repository. Remove it if it is not expected.",
      });
      continue;
    }

    if (text.trim().length > 0) {
      findings.push({
        ruleId: "asset-mismatch",
        category: "malware",
        severity: "medium",
        title: "Asset does not match its extension",
        message: `${relative} is text, not a valid ${extensionOf(relative)} file.`,
        file: relative,
        line: 1,
        evidence,
        remediation:
          "Inspect the file. If it contains script code, treat the repository as untrusted.",
      });
    }
  }
  return findings;
}
