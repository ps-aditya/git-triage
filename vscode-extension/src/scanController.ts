import * as vscode from "vscode";
import { scan, type ScanResult } from "git-triage";
import {
  getConfig,
  getWorkspaceFolderCount,
  getWorkspaceRoot,
} from "./config.js";
import { DiagnosticsManager } from "./diagnostics.js";
import { FindingsProvider } from "./findingsProvider.js";
import { SummaryProvider } from "./summaryProvider.js";
import { StatusBar } from "./statusBar.js";
import { TaskWarner } from "./taskWarning.js";

export class ScanController {
  private result: ScanResult | undefined;
  private scanning = false;
  private multiRootNotified = false;

  constructor(
    private readonly output: vscode.OutputChannel,
    private readonly diagnostics: DiagnosticsManager,
    private readonly findings: FindingsProvider,
    private readonly summary: SummaryProvider,
    private readonly status: StatusBar,
    private readonly taskWarner: TaskWarner,
  ) {}

  getResult(): ScanResult | undefined {
    return this.result;
  }

  getRoot(): string | undefined {
    return this.result?.root ?? getWorkspaceRoot();
  }

  async scan(options: { history?: boolean; manual?: boolean } = {}): Promise<ScanResult | undefined> {
    const root = getWorkspaceRoot();
    if (!root) {
      void vscode.window.showInformationMessage("Git Triage: open a folder before scanning.");
      return undefined;
    }

    if (getWorkspaceFolderCount() > 1 && !this.multiRootNotified) {
      this.multiRootNotified = true;
      void vscode.window.showInformationMessage(
        "Git Triage v0.1 scans the first workspace folder. Multi-root support is on the roadmap.",
      );
    }

    if (this.scanning) {
      void vscode.window.showInformationMessage("Git Triage: a scan is already running.");
      return this.result;
    }

    const config = getConfig();
    const history = options.history ?? config.history;
    this.scanning = true;

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Git Triage: scanning workspace",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: history ? "working tree + git history" : "working tree" });
          return await scan({
            cwd: root,
            history,
            maxCommits: config.maxCommits,
          });
        },
      );

      this.result = result;

      if (config.showProblems) {
        this.diagnostics.update(result);
      } else {
        this.diagnostics.clear();
      }

      this.findings.setResult(result);
      this.summary.setResult(result);
      this.status.setResult(result);

      const counts = {
        critical: result.findings.filter((finding) => finding.severity === "critical").length,
        high: result.findings.filter((finding) => finding.severity === "high").length,
        medium: result.findings.filter((finding) => finding.severity === "medium").length,
        low: result.findings.filter((finding) => finding.severity === "low").length,
      };
      this.output.appendLine(
        `[${new Date().toISOString()}] scan root=${result.root} files=${result.scanned.files} ` +
          `commits=${result.scanned.commits} findings=${result.findings.length} ` +
          `(${counts.critical}C/${counts.high}H/${counts.medium}M/${counts.low}L) ` +
          `duration=${result.durationMs}ms`,
      );
      console.log(
        `[git-triage] scan root=${result.root} files=${result.scanned.files} ` +
          `commits=${result.scanned.commits} findings=${result.findings.length}`,
      );

      await this.taskWarner.maybeWarn(result);

      if (options.manual) {
        if (result.findings.length === 0) {
          void vscode.window.showInformationMessage(
            `Git Triage: no findings in ${result.scanned.files} files.`,
          );
        } else {
          void vscode.window.showInformationMessage(
            `Git Triage: ${result.findings.length} finding${result.findings.length === 1 ? "" : "s"}. See the Git Triage view.`,
          );
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[${new Date().toISOString()}] scan failed: ${message}`);
      void vscode.window.showErrorMessage(`Git Triage scan failed: ${message}`);
      return undefined;
    } finally {
      this.scanning = false;
    }
  }
}
