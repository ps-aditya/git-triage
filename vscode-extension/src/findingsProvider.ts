import * as vscode from "vscode";
import type { Finding, ScanResult, Severity } from "git-triage";

type Node = GroupNode | FindingNode | InfoNode;

interface GroupNode {
  kind: "group";
  severity: Severity;
  label: string;
  findings: Finding[];
}

interface FindingNode {
  kind: "finding";
  finding: Finding;
}

interface InfoNode {
  kind: "info";
  label: string;
  description?: string;
  command?: string;
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

function labelFor(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function iconFor(severity: Severity): vscode.ThemeIcon {
  const color =
    severity === "critical"
      ? "charts.red"
      : severity === "high"
        ? "charts.orange"
        : severity === "medium"
          ? "charts.yellow"
          : "charts.blue";
  return new vscode.ThemeIcon("shield", new vscode.ThemeColor(color));
}

function locationOf(finding: Finding): string {
  if (!finding.file) return "repository";
  const line = finding.line ? `:${finding.line}` : "";
  const commit = finding.commit ? ` @ ${finding.commit.slice(0, 8)}` : "";
  return `${finding.file}${line}${commit}`;
}

function tooltipFor(finding: Finding): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  md.appendMarkdown(`**${finding.title}** — ${finding.severity}\n\n`);
  md.appendText(finding.message);
  if (finding.evidence) {
    md.appendMarkdown("\n\n");
    md.appendText(`Evidence: ${finding.evidence}`);
  }
  if (finding.remediation) {
    md.appendMarkdown("\n\n");
    md.appendText(`Fix: ${finding.remediation}`);
  }
  return md;
}

export class FindingsProvider implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  private result: ScanResult | undefined;

  setResult(result: ScanResult | undefined): void {
    this.result = result;
    this.changed.fire(undefined);
  }

  dispose(): void {
    this.changed.dispose();
  }

  getChildren(element?: Node): Node[] {
    if (!element) {
      if (!this.result) {
        return [
          {
            kind: "info",
            label: "Run a scan",
            description: "No scan has run in this workspace yet.",
            command: "gitTriage.scan",
          },
        ];
      }
      if (this.result.findings.length === 0) {
        return [
          {
            kind: "info",
            label: "No findings",
            description: `Scanned ${this.result.scanned.files} files${this.result.scanned.commits ? ` and ${this.result.scanned.commits} commits` : ""}.`,
          },
        ];
      }

      return SEVERITIES.map((severity) => {
        const findings = this.result!.findings.filter((finding) => finding.severity === severity);
        return findings.length > 0
          ? {
              kind: "group" as const,
              severity,
              label: `${labelFor(severity)} (${findings.length})`,
              findings,
            }
          : undefined;
      }).filter((group): group is GroupNode => Boolean(group));
    }

    if (element.kind === "group") {
      return element.findings.map((finding) => ({ kind: "finding", finding }));
    }

    return [];
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if (element.kind === "group") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = iconFor(element.severity);
      item.contextValue = "gitTriage.group";
      return item;
    }

    if (element.kind === "info") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.iconPath = new vscode.ThemeIcon("info");
      if (element.command) item.command = { command: element.command, title: element.label };
      return item;
    }

    const finding = element.finding;
    const item = new vscode.TreeItem(finding.title, vscode.TreeItemCollapsibleState.None);
    item.description = locationOf(finding);
    item.tooltip = tooltipFor(finding);
    item.iconPath = iconFor(finding.severity);
    item.contextValue = "gitTriage.finding";
    item.command = {
      command: "gitTriage.openFinding",
      title: "Open finding",
      arguments: [finding],
    };
    return item;
  }
}
