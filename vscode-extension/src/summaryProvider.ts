import * as path from "node:path";
import * as vscode from "vscode";
import type { ScanResult } from "git-triage";

interface SummaryNode {
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  command?: string;
}

export class SummaryProvider implements vscode.TreeDataProvider<SummaryNode> {
  private readonly changed = new vscode.EventEmitter<SummaryNode | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  private result: ScanResult | undefined;

  setResult(result: ScanResult | undefined): void {
    this.result = result;
    this.changed.fire(undefined);
  }

  dispose(): void {
    this.changed.dispose();
  }

  getChildren(): SummaryNode[] {
    if (!this.result) {
      return [
        {
          label: "Not scanned yet",
          description: "Run a scan to inspect this workspace.",
          icon: "info",
        },
        {
          label: "Scan workspace",
          icon: "search",
          command: "gitTriage.scan",
        },
      ];
    }

    const result = this.result;
    const counts = {
      critical: result.findings.filter((finding) => finding.severity === "critical").length,
      high: result.findings.filter((finding) => finding.severity === "high").length,
      medium: result.findings.filter((finding) => finding.severity === "medium").length,
      low: result.findings.filter((finding) => finding.severity === "low").length,
    };

    return [
      {
        label: "Last scan",
        description: new Date().toLocaleTimeString(),
        tooltip: `Scan completed in ${(result.durationMs / 1000).toFixed(1)}s`,
        icon: "clock",
      },
      {
        label: "Workspace",
        description: path.basename(result.root),
        tooltip: result.root,
        icon: "folder",
      },
      {
        label: "Files scanned",
        description: `${result.scanned.files}`,
        icon: "file",
      },
      {
        label: "Commits scanned",
        description: result.scanned.commits > 0 ? `${result.scanned.commits}` : "history off",
        icon: "git-commit",
      },
      {
        label: "Findings",
        description: `${result.findings.length} (${counts.critical}C / ${counts.high}H / ${counts.medium}M / ${counts.low}L)`,
        tooltip: `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low`,
        icon: result.findings.length > 0 ? "warning" : "pass",
      },
      {
        label: "Scan workspace",
        icon: "search",
        command: "gitTriage.scan",
      },
      {
        label: "Show fix runbook",
        icon: "book",
        command: "gitTriage.showRunbook",
      },
    ];
  }

  getTreeItem(element: SummaryNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;
    item.tooltip = element.tooltip;
    if (element.icon) item.iconPath = new vscode.ThemeIcon(element.icon);
    if (element.command) item.command = { command: element.command, title: element.label };
    return item;
  }
}
