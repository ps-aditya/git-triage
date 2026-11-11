import * as vscode from "vscode";
import type { Category, Finding, ScanResult, Severity } from "git-triage";

const CATEGORY_LABELS: Record<Category, string> = {
  secret: "Leaked credentials",
  malware: "VS Code execution surface",
  config: "Git configuration and hooks",
  ci: "CI exfiltration patterns",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function location(finding: Finding): string {
  if (!finding.file) return "repository";
  const line = finding.line ? `:${finding.line}` : "";
  const commit = finding.commit ? ` (commit ${finding.commit.slice(0, 8)})` : "";
  return `${finding.file}${line}${commit}`;
}

function findingBlock(finding: Finding): string {
  const lines: string[] = [];
  lines.push(`### [${finding.severity.toUpperCase()}] ${finding.title}`);
  lines.push("");
  lines.push(`**Location:** \`${location(finding)}\``);
  lines.push("");
  lines.push(finding.message);
  if (finding.evidence) {
    lines.push("");
    lines.push(`> ${finding.evidence.replace(/\r?\n/g, " ")}`);
  }
  if (finding.remediation) {
    lines.push("");
    lines.push(`**Fix:** ${finding.remediation}`);
  }
  return lines.join("\n");
}

export function buildRunbook(result: ScanResult): string {
  const lines: string[] = [];
  lines.push("# Git Triage — fix runbook");
  lines.push("");
  lines.push(`**Workspace:** \`${result.root}\``);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(
    `**Scanned:** ${result.scanned.files} files` +
      (result.scanned.commits > 0 ? `, ${result.scanned.commits} commits` : ", working tree only") +
      `, ${result.findings.length} finding${result.findings.length === 1 ? "" : "s"}.`,
  );
  lines.push("");
  lines.push("> This runbook does not change anything. It is a checklist, not an automated fix.");
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("## No findings");
    lines.push("");
    lines.push("Nothing to fix in the scanned scope. Re-run with history enabled if you need a deeper check.");
    return lines.join("\n");
  }

  lines.push("## Order of operations");
  lines.push("");
  lines.push("1. **Contain** — do not run tasks, tests, or scripts from an untrusted repo.");
  lines.push("2. **Revoke** the credential at the provider. Purging before revocation is theater.");
  lines.push("3. **Rotate** the replacement and update the dependent system.");
  lines.push("4. **Purge** history only after revocation, with a backup and a dry run.");
  lines.push("5. **Verify** the old credential is dead and every ref is clean.");
  lines.push("6. **Prevent** recurrence with hooks, push protection, and custom rules.");
  lines.push("");

  for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
    const findings = result.findings.filter((finding) => finding.category === category);
    if (findings.length === 0) continue;

    lines.push(`## ${CATEGORY_LABELS[category]}`);
    lines.push("");
    for (const severity of SEVERITY_ORDER) {
      for (const finding of findings.filter((item) => item.severity === severity)) {
        lines.push(findingBlock(finding));
        lines.push("");
      }
    }
  }

  lines.push("## What this does not do");
  lines.push("");
  lines.push("- It does not revoke credentials.");
  lines.push("- It does not rewrite git history.");
  lines.push("- It does not guarantee the repository is safe.");
  lines.push("");
  lines.push("See the [Git Triage README](https://github.com/ps-aditya/git-triage#readme) for the full limitations.");
  return lines.join("\n");
}

export async function openRunbook(result: ScanResult): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content: buildRunbook(result),
    language: "markdown",
  });
  await vscode.window.showTextDocument(document, { preview: false });
}
