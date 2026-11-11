import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { Finding, ScanResult, Severity } from "git-triage";

function severityOf(finding: Finding): vscode.DiagnosticSeverity {
  switch (finding.severity) {
    case "critical":
    case "high":
      return vscode.DiagnosticSeverity.Error;
    case "medium":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

function messageOf(finding: Finding): string {
  const parts = [finding.title, finding.message];
  if (finding.evidence) parts.push(`Evidence: ${finding.evidence}`);
  if (finding.remediation) parts.push(`Fix: ${finding.remediation}`);
  return parts.join("\n\n");
}

export class DiagnosticsManager implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection("git-triage");
  }

  update(result: ScanResult): void {
    this.collection.clear();
    const byFile = new Map<string, vscode.Diagnostic[]>();

    for (const finding of result.findings) {
      if (!finding.file) continue;
      // History findings do not point at a line in the working tree.
      if (finding.commit) continue;

      const absolute = path.join(result.root, finding.file);
      if (!fs.existsSync(absolute)) continue;

      const line = Math.max(0, (finding.line ?? 1) - 1);
      const range = new vscode.Range(line, 0, line, 500);
      const diagnostic = new vscode.Diagnostic(
        range,
        messageOf(finding),
        severityOf(finding),
      );
      diagnostic.source = "Git Triage";
      diagnostic.code = finding.ruleId;

      const list = byFile.get(absolute) ?? [];
      list.push(diagnostic);
      byFile.set(absolute, list);
    }

    for (const [file, diagnostics] of byFile) {
      this.collection.set(vscode.Uri.file(file), diagnostics);
    }
  }

  clear(): void {
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }
}

export function maxSeverity(findings: Finding[]): Severity | undefined {
  const order: Severity[] = ["critical", "high", "medium", "low"];
  for (const severity of order) {
    if (findings.some((finding) => finding.severity === severity)) return severity;
  }
  return undefined;
}
