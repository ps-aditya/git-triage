import * as path from "node:path";
import * as vscode from "vscode";
import type { Finding, ScanResult } from "git-triage";
import { getConfig } from "./config.js";

function isFolderOpenDanger(finding: Finding): boolean {
  return (
    (finding.ruleId === "task-folder-open-asset-script" ||
      finding.ruleId === "task-folder-open-hidden" ||
      finding.ruleId === "task-folder-open-command") &&
    (finding.severity === "critical" || finding.severity === "high")
  );
}

export class TaskWarner {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async maybeWarn(result: ScanResult): Promise<void> {
    if (!getConfig().warnOnFolderOpen) return;

    const dangerous = result.findings.filter(isFolderOpenDanger);
    if (dangerous.length === 0) return;

    const finding = dangerous[0];
    const key = `warned:${result.root}:${finding.ruleId}:${finding.file ?? ""}`;
    if (this.context.workspaceState.get<boolean>(key)) return;
    await this.context.workspaceState.update(key, true);

    const what =
      finding.ruleId === "task-folder-open-asset-script"
        ? "a hidden folder-open task that runs a script disguised as an asset"
        : "a hidden folder-open task";

    const choice = await vscode.window.showWarningMessage(
      `Git Triage: this workspace contains ${what}. Review it before you trust the workspace or run its tasks.`,
      { modal: true },
      "Inspect Task",
      "Show Runbook",
    );

    if (choice === "Inspect Task") {
      await this.openTask(result.root, finding);
    } else if (choice === "Show Runbook") {
      await vscode.commands.executeCommand("gitTriage.showRunbook");
    }
  }

  private async openTask(root: string, finding: Finding): Promise<void> {
    const relative = finding.file ?? ".vscode/tasks.json";
    const absolute = path.join(root, relative);
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolute));
      const line = Math.max(0, (finding.line ?? 1) - 1);
      await vscode.window.showTextDocument(document, {
        preview: true,
        selection: new vscode.Range(line, 0, line, 0),
      });
    } catch {
      void vscode.window.showInformationMessage(
        `Git Triage could not open ${relative}. Inspect .vscode/tasks.json manually before trusting the workspace.`,
      );
    }
  }
}
