import * as path from "node:path";
import * as vscode from "vscode";
import type { Finding } from "git-triage";
import { getConfig } from "./config.js";
import { DiagnosticsManager } from "./diagnostics.js";
import { FindingsProvider } from "./findingsProvider.js";
import { openRunbook } from "./runbook.js";
import { ScanController } from "./scanController.js";
import { StatusBar } from "./statusBar.js";
import { SummaryProvider } from "./summaryProvider.js";
import { TaskWarner } from "./taskWarning.js";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Git Triage");
  output.appendLine(`[${new Date().toISOString()}] Git Triage activated (v${context.extension.packageJSON.version})`);
  console.log("[git-triage] activated");
  const diagnostics = new DiagnosticsManager();
  const findings = new FindingsProvider();
  const summary = new SummaryProvider();
  const status = new StatusBar();
  const taskWarner = new TaskWarner(context);
  const controller = new ScanController(output, diagnostics, findings, summary, status, taskWarner);

  const findingsView = vscode.window.createTreeView("gitTriage.findings", {
    treeDataProvider: findings,
    showCollapseAll: true,
  });
  const summaryView = vscode.window.createTreeView("gitTriage.summary", {
    treeDataProvider: summary,
    showCollapseAll: false,
  });

  context.subscriptions.push(
    output,
    diagnostics,
    status,
    findingsView,
    summaryView,
    findings,
    summary,
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gitTriage.scan", () => {
      void controller.scan({ manual: true });
    }),
    vscode.commands.registerCommand("gitTriage.scanHistory", () => {
      void controller.scan({ history: true, manual: true });
    }),
    vscode.commands.registerCommand("gitTriage.showRunbook", async () => {
      const result = controller.getResult() ?? (await controller.scan({ manual: true }));
      if (result) await openRunbook(result);
    }),
    vscode.commands.registerCommand("gitTriage.openSettings", () => {
      void vscode.commands.executeCommand("workbench.action.openSettings", "gitTriage");
    }),
    vscode.commands.registerCommand("gitTriage.showOutput", () => {
      output.show(true);
    }),
    vscode.commands.registerCommand("gitTriage.openFinding", (finding: Finding) => {
      void openFinding(finding, controller.getRoot());
    }),
    vscode.commands.registerCommand(
      "gitTriage.inspectTask",
      (file?: string, line?: number) => {
        void openTask(controller.getRoot(), file, line);
      },
    ),
    vscode.commands.registerCommand("gitTriage.openRestricted", async () => {
      const choice = await vscode.window.showWarningMessage(
        "Reload the window and choose \"Don't Trust\" when VS Code asks. The workspace will open in Restricted Mode, and folder-open tasks will not run.",
        { modal: true },
        "Reload Window",
        "Cancel",
      );
      if (choice === "Reload Window") {
        void vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void controller.scan();
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void controller.scan();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("gitTriage")) {
        output.appendLine(`[${new Date().toISOString()}] configuration changed`);
      }
    }),
  );

  if (getConfig().scanOnOpen) {
    void controller.scan();
  }
}

async function openFinding(finding: Finding, root: string | undefined): Promise<void> {
  if (!root) {
    void vscode.window.showInformationMessage("Git Triage: open a folder first.");
    return;
  }
  if (!finding.file) {
    void vscode.window.showInformationMessage(
      `${finding.title}: ${finding.message}`,
    );
    return;
  }

  const absolute = path.join(root, finding.file);
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolute));
    const line = Math.max(0, (finding.line ?? 1) - 1);
    await vscode.window.showTextDocument(document, {
      preview: true,
      selection: new vscode.Range(line, 0, line, 0),
    });
    if (finding.commit) {
      void vscode.window.showInformationMessage(
        `Git Triage: this finding also exists in commit ${finding.commit.slice(0, 8)}.`,
      );
    }
  } catch {
    void vscode.window.showInformationMessage(
      `Git Triage could not open ${finding.file}. It may have been removed from the working tree.`,
    );
  }
}

async function openTask(
  root: string | undefined,
  file?: string,
  line?: number,
): Promise<void> {
  if (!root) {
    void vscode.window.showInformationMessage("Git Triage: open a folder first.");
    return;
  }
  const relative = file ?? ".vscode/tasks.json";
  try {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(path.join(root, relative)),
    );
    const target = Math.max(0, (line ?? 1) - 1);
    await vscode.window.showTextDocument(document, {
      preview: true,
      selection: new vscode.Range(target, 0, target, 0),
    });
  } catch {
    void vscode.window.showInformationMessage(
      `Git Triage could not open ${relative}. Inspect it manually before trusting the workspace.`,
    );
  }
}

export function deactivate(): void {
  // Disposables are handled by the extension context.
}
