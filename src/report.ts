import { SECRET_RULES } from "./rules.js";
import type { Finding, ScanResult, Severity } from "./types.js";

let colorEnabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

const color = {
  reset: (s: string) => (colorEnabled ? `\u001b[0m${s}\u001b[0m` : s),
  bold: (s: string) => (colorEnabled ? `\u001b[1m${s}\u001b[0m` : s),
  dim: (s: string) => (colorEnabled ? `\u001b[2m${s}\u001b[0m` : s),
  red: (s: string) => (colorEnabled ? `\u001b[31m${s}\u001b[0m` : s),
  yellow: (s: string) => (colorEnabled ? `\u001b[33m${s}\u001b[0m` : s),
  cyan: (s: string) => (colorEnabled ? `\u001b[36m${s}\u001b[0m` : s),
  gray: (s: string) => (colorEnabled ? `\u001b[90m${s}\u001b[0m` : s),
  green: (s: string) => (colorEnabled ? `\u001b[32m${s}\u001b[0m` : s),
};

function severityLabel(severity: Severity): string {
  switch (severity) {
    case "critical":
      return color.red("CRITICAL");
    case "high":
      return color.yellow("HIGH    ");
    case "medium":
      return color.cyan("MEDIUM  ");
    default:
      return color.gray("LOW     ");
  }
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

export function formatPretty(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(
    `${color.bold("git-triage")} ${color.dim(result.version)} — scanning ${result.root}`,
  );
  lines.push("");

  if (result.findings.length === 0) {
    lines.push(color.green("No findings."));
  } else {
    for (const finding of result.findings) {
      const location = finding.file
        ? `${finding.file}${finding.line ? `:${finding.line}` : ""}${finding.commit ? ` @ ${finding.commit.slice(0, 8)}` : ""}`
        : "(repository)";
      lines.push(`${severityLabel(finding.severity)}  ${color.bold(finding.ruleId)}`);
      lines.push(`  ${color.dim(location)}`);
      lines.push(`  ${finding.title}`);
      lines.push(`  ${finding.message}`);
      if (finding.evidence) lines.push(`  ${color.gray(`evidence: ${finding.evidence}`)}`);
      if (finding.remediation) lines.push(`  ${color.dim(`fix: ${finding.remediation}`)}`);
      lines.push("");
    }
  }

  const counts = countBySeverity(result.findings);
  const summary = [
    `${result.findings.length} finding${result.findings.length === 1 ? "" : "s"}`,
    `${counts.critical} critical`,
    `${counts.high} high`,
    `${counts.medium} medium`,
    `${counts.low} low`,
  ].join(", ");

  lines.push(
    `${summary}. Scanned ${result.scanned.files} files` +
      (result.scanned.commits > 0
        ? ` and ${result.scanned.commits} commits`
        : " (history not scanned; use --history)") +
      (result.scanned.truncated ? "; scan truncated" : "") +
      ` in ${(result.durationMs / 1000).toFixed(1)}s.`,
  );

  if (result.findings.length > 0) {
    lines.push(color.dim("Run `git-triage fix` for a remediation plan."));
  }

  return lines.join("\n");
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatFixPlan(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(color.bold("Remediation plan"));
  lines.push("");

  const categories = new Set(result.findings.map((finding) => finding.category));
  let step = 0;
  const next = (): string => `${(step += 1)}. `;

  if (categories.has("malware")) {
    lines.push(color.bold(`${next()}Contain the repository`));
    lines.push("   - Open the repo in Restricted Mode (Workspace Trust: Don't Trust).");
    lines.push("   - Do not run tasks, tests, or scripts from the repo until you inspect them.");
    lines.push("   - Remove the flagged task/file from every branch, not just the default branch.");
    lines.push("   - Check for persistence:");
    lines.push("       crontab -l | grep -i ghc2");
    lines.push("       ls -la ~/.node_modules 2>/dev/null");
    lines.push("   - Rotate cloud, registry, Git, SSH, and AI-tool credentials from a clean machine.");
    lines.push("");
  }

  if (categories.has("secret")) {
    lines.push(color.bold(`${next()}Revoke and rotate the leaked credentials`));
    const reported = new Set<string>();
    for (const finding of result.findings) {
      if (finding.category !== "secret" || reported.has(finding.ruleId)) continue;
      reported.add(finding.ruleId);
      lines.push(`   - ${finding.title}: ${finding.remediation ?? "Revoke and rotate."}`);
    }
    lines.push("");
  }

  if (categories.has("config")) {
    lines.push(color.bold(`${next()}Clean Git configuration`));
    lines.push("   - Inspect .git/config and .gitmodules.");
    lines.push("   - Remove unknown core.fsmonitor, core.sshCommand, include.path, and url.*.insteadOf entries.");
    lines.push("   - Do not initialize submodules with an update command or ext:: URL.");
    lines.push("");
  }

  if (categories.has("ci")) {
    lines.push(color.bold(`${next()}Clean CI configuration`));
    lines.push("   - Remove the flagged workflow step.");
    lines.push("   - Rotate every token the job could read.");
    lines.push("   - Audit recent workflow runs for unexpected network calls.");
    lines.push("");
  }

  if (categories.has("secret")) {
    lines.push(color.bold(`${next()}Purge history (only after revocation)`));
    lines.push("   Rewriting history does not revoke a working credential. Revoke first.");
    lines.push("   Then, with a backup:");
    lines.push("     git bundle create ../repo-backup.bundle --all");
    lines.push("     git filter-repo --replace-text replacements.txt");
    lines.push("     git push --force-with-lease --atomic origin --all");
    lines.push("     git push --force-with-lease --atomic origin --tags");
    lines.push("   Re-scan every branch and tag afterwards. Check forks, mirrors, CI caches,");
    lines.push("   artifacts, wiki pages, issues, and merge request comments.");
    lines.push("");
  }

  lines.push(color.bold(`${next()}Prevent recurrence`));
  lines.push("   - Add a pre-commit/pre-push hook and enable push protection.");
  lines.push("   - Add custom rules for the token types you found.");
  lines.push("   - Keep secrets in a secret manager, not in the repo.");
  lines.push("");
  lines.push(color.dim("git-triage does not revoke credentials or rewrite history automatically."));

  return lines.join("\n");
}

export function formatRules(): string {
  const lines: string[] = [];
  lines.push(color.bold("Secret rules"));
  for (const rule of SECRET_RULES) {
    lines.push(`  ${rule.severity.padEnd(8)} ${rule.id.padEnd(32)} ${rule.title}`);
  }
  lines.push("");
  lines.push(color.bold("Other checks"));
  lines.push("  task-folder-open-asset-script   hidden folder-open task runs a script disguised as an asset");
  lines.push("  task-folder-open-hidden         hidden folder-open task runs a command");
  lines.push("  task-folder-open-command        folder-open task runs a shell command");
  lines.push("  asset-is-script                 font/image contains script code");
  lines.push("  git-hook                        non-sample Git hook installed");
  lines.push("  git-config-*                    dangerous .git/config key");
  lines.push("  gitmodule-command               submodule update executes a command");
  lines.push("  ci-*                            suspicious CI workflow pattern");
  return lines.join("\n");
}
