import path from "node:path";
import { redactSecrets } from "../redact.js";
import { CI_PATTERNS } from "../rules.js";
import type { Finding } from "../types.js";
import { readTextFile, truncate } from "../util.js";

const REMEDIATION: Record<string, string> = {
  "ci-curl-pipe-shell":
    "Vendor or pin the script instead of piping remote content to a shell. Remove the step if you do not recognize it.",
  "ci-base64-exec":
    "Vendor and review the code. Base64 is often used to hide a payload from reviewers.",
  "ci-token-exfil":
    "Remove the step, rotate the referenced token, and audit recent workflow runs for exfiltration.",
  "ci-history-grep":
    "Remove the step. A CI job that greps history for credentials is a common exfiltration pattern.",
  "ci-self-hosted":
    "Isolate self-hosted runners and never run untrusted workflows on them. Rotate credentials stored on the runner.",
  "ci-pull-request-target":
    "Do not check out and execute untrusted pull request code under pull_request_target. Use pull_request with a read-only token.",
  "ci-secrets-inherit":
    "Pass only the secrets the called workflow needs instead of inheriting all of them.",
  "ci-write-all":
    "Use least-privilege permissions for the workflow token.",
};

export function checkCi(root: string, files: string[]): Finding[] {
  const workflowFiles = files.filter((file) => {
    const lower = file.toLowerCase();
    return (
      /^\.github\/workflows\/[^/]+\.ya?ml$/.test(lower) ||
      lower === ".gitlab-ci.yml" ||
      lower === ".gitlab-ci.yaml"
    );
  });

  const findings: Finding[] = [];

  for (const relative of workflowFiles) {
    const text = readTextFile(path.join(root, relative), 2_000_000);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);

    for (const pattern of CI_PATTERNS) {
      const index = lines.findIndex((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return false;
        return pattern.regex.test(line);
      });
      if (index === -1) continue;

      findings.push({
        ruleId: pattern.id,
        category: "ci",
        severity: pattern.severity,
        title: pattern.title,
        message: pattern.message,
        file: relative,
        line: index + 1,
        evidence: redactSecrets(truncate(lines[index], 180)),
        remediation: REMEDIATION[pattern.id],
      });
    }
  }

  return findings;
}
