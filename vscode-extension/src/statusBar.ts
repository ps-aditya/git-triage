import * as vscode from "vscode";
import type { ScanResult } from "git-triage";
import { maxSeverity } from "./diagnostics.js";

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.name = "Git Triage";
    this.item.command = "gitTriage.scan";
    this.item.text = "$(shield) Git Triage";
    this.item.tooltip = "Git Triage: scan this workspace for leaked credentials and hidden folder-open tasks.";
    this.item.show();
  }

  setResult(result: ScanResult | undefined): void {
    if (!result) {
      this.item.text = "$(shield) Git Triage";
      this.item.tooltip = "Git Triage: scan this workspace.";
      this.item.backgroundColor = undefined;
      return;
    }

    const count = result.findings.length;
    const severity = maxSeverity(result.findings);
    const counts = {
      critical: result.findings.filter((finding) => finding.severity === "critical").length,
      high: result.findings.filter((finding) => finding.severity === "high").length,
      medium: result.findings.filter((finding) => finding.severity === "medium").length,
      low: result.findings.filter((finding) => finding.severity === "low").length,
    };

    this.item.text = count === 0 ? "$(shield) Git Triage: clean" : `$(shield) Git Triage: ${count}`;
    this.item.tooltip = [
      `Git Triage — ${count} finding${count === 1 ? "" : "s"}`,
      `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low`,
      `Scanned ${result.scanned.files} files${result.scanned.commits > 0 ? ` and ${result.scanned.commits} commits` : ""}.`,
      "Click to rescan.",
    ].join("\n");

    if (severity === "critical") {
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    } else if (severity === "high" || severity === "medium") {
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
      this.item.backgroundColor = undefined;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
