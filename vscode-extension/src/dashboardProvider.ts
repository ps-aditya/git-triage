import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { Finding, ScanResult } from "git-triage";
import { getConfig, getWorkspaceRoot } from "./config.js";
import {
  GitService,
  type GitBranch,
  type GitCommit,
  type GitRemote,
  type GitStatus,
} from "./gitService.js";
import { openRunbook } from "./runbook.js";
import type { ScanController } from "./scanController.js";

interface DashboardState {
  root: string | null;
  isRepo: boolean;
  status?: GitStatus;
  branches: GitBranch[];
  remotes: GitRemote[];
  log: GitCommit[];
  triage?: ScanResult;
  pollInterval: number;
  logLimit: number;
  error?: string;
}

interface WebviewMessage {
  type: string;
  path?: string;
  line?: number;
  branch?: string;
  message?: string;
  hash?: string;
  command?: string;
  text?: string;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (quote) throw new Error("Unclosed quote in command.");
  if (escaped) current += "\\";
  if (current) tokens.push(current);
  return tokens;
}

function isDangerous(args: string[]): boolean {
  if (!args.length) return false;
  if (args[0] === "reset" && args.includes("--hard")) return true;
  if (args[0] === "clean" && args.some((arg) => /^-[a-z]*f/.test(arg))) return true;
  if (args[0] === "push" && args.some((arg) => arg === "-f" || arg.startsWith("--force"))) return true;
  if (args[0] === "branch" && args.some((arg) => arg === "-D" || arg === "-d")) return true;
  if (args[0] === "checkout" && args.includes("--")) return true;
  if (args[0] === "restore" && !args.includes("--staged")) return true;
  if (args[0] === "stash" && (args.includes("drop") || args.includes("clear"))) return true;
  if (args[0] === "filter-branch" || args[0] === "filter-repo") return true;
  return false;
}

function isInteractive(args: string[]): boolean {
  if (!args.length) return false;
  if (args[0] === "add" && (args.includes("-p") || args.includes("--patch"))) return true;
  if (args[0] === "commit" && !args.some((arg) => arg === "-m" || arg.startsWith("--message"))) return true;
  if (args[0] === "rebase" && (args.includes("-i") || args.includes("--interactive"))) return true;
  if (args[0] === "mergetool" || args[0] === "difftool") return true;
  if (args[0] === "config" && (args.includes("--edit") || args.includes("-e"))) return true;
  return false;
}

function findGitBash(): string | undefined {
  if (process.platform !== "win32") return undefined;
  const candidates = [
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "bin", "bash.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "bin", "bash.exe"),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}


export class DashboardProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private timer: NodeJS.Timeout | undefined;
  private refreshing = false;
  private lastSummary = "";

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly output: vscode.OutputChannel,
    private readonly scanController: ScanController,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };
    view.webview.html = this.getHtml(view.webview);
    view.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    });
    view.onDidChangeVisibility(() => {
      if (view.visible) {
        void this.refresh();
        this.startPolling();
      } else {
        this.stopPolling();
      }
    });
    view.onDidDispose(() => this.stopPolling());

    void this.refresh();
    this.startPolling();
  }

  dispose(): void {
    this.stopPolling();
  }

  async refresh(): Promise<void> {
    if (!this.view) return;
    if (this.refreshing) return;
    this.refreshing = true;
    this.post({ type: "busy", busy: true });

    try {
      const state = await this.getState();
      const summary = `${state.root}|${state.status?.branch ?? ""}|${state.status?.files.length ?? 0}`;
      if (summary !== this.lastSummary) {
        this.lastSummary = summary;
        this.output.appendLine(
          `[${new Date().toISOString()}] dashboard root=${state.root ?? "(none)"} ` +
            `branch=${state.status?.branch ?? "(none)"} changes=${state.status?.files.length ?? 0} ` +
            `triage=${state.triage?.findings.length ?? 0}`,
        );
      }
      this.post({ type: "state", state });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[${new Date().toISOString()}] dashboard refresh failed: ${message}`);
      this.post({
        type: "state",
        state: {
          root: getWorkspaceRoot() ?? null,
          isRepo: false,
          branches: [],
          remotes: [],
          log: [],
          pollInterval: getConfig().pollInterval,
          logLimit: getConfig().logLimit,
          error: message,
        },
      });
      this.toast("error", message);
    } finally {
      this.refreshing = false;
      this.post({ type: "busy", busy: false });
    }
  }

  async runGitAction(action: "fetch" | "pull" | "push"): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }
    await this.gitWithProgress(root, action, async (git) => {
      if (action === "fetch") await git.fetch();
      else if (action === "pull") await git.pull();
      else await git.push();
    });
  }

  async promptCommit(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }
    const message = await vscode.window.showInputBox({
      prompt: "Commit message",
      placeHolder: "Describe the change",
      ignoreFocusOut: true,
    });
    if (!message) return;
    await this.gitWithProgress(root, "commit", async (git) => {
      await git.commit(message);
    });
  }

  async promptCheckout(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }
    try {
      const branches = await new GitService(root).getBranches();
      const pick = await vscode.window.showQuickPick(
        branches.map((branch) => ({
          label: branch.name,
          description: branch.current ? "current" : branch.upstream ?? "",
          detail: branch.subject,
        })),
        { placeHolder: "Checkout a branch", ignoreFocusOut: true },
      );
      if (!pick) return;
      await this.gitWithProgress(root, "checkout", async (git) => {
        await git.checkout(pick.label);
      });
    } catch (error) {
      this.toast("error", error instanceof Error ? error.message : String(error));
    }
  }

  async promptCreateBranch(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }
    const name = await vscode.window.showInputBox({
      prompt: "New branch name",
      placeHolder: "feature/name",
      ignoreFocusOut: true,
    });
    if (!name) return;
    await this.gitWithProgress(root, "create branch", async (git) => {
      await git.createBranch(name);
    });
  }

  async initRepository(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      `Initialize a Git repository in ${root}?`,
      { modal: true },
      "Initialize",
    );
    if (choice !== "Initialize") return;
    await this.gitWithProgress(root, "init", async (git) => {
      await git.init();
    });
  }

  async openGitBash(): Promise<void> {
    const root = getWorkspaceRoot();
    const bash = findGitBash();
    const terminal = vscode.window.createTerminal({
      name: bash ? "Git Bash" : "Git Triage Terminal",
      cwd: root,
      shellPath: bash,
    });
    terminal.show();
  }

  private async runGitCommand(command: string): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }

    const trimmed = command.trim();
    if (!trimmed) return;
    if (/[|&;<>]/.test(trimmed)) {
      this.post({
        type: "commandResult",
        command: trimmed,
        stdout: "",
        stderr: "Pipes, redirects, and chained commands are not supported here. Use Open Git Bash.",
        code: 1,
      });
      return;
    }

    let tokens: string[];
    try {
      tokens = tokenize(trimmed);
    } catch (error) {
      this.post({
        type: "commandResult",
        command: trimmed,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        code: 1,
      });
      return;
    }

    if (tokens[0] !== "git") {
      this.post({
        type: "commandResult",
        command: trimmed,
        stdout: "",
        stderr: "Commands must start with `git`.",
        code: 1,
      });
      return;
    }

    const args = tokens.slice(1);
    if (!args.length) {
      this.post({
        type: "commandResult",
        command: trimmed,
        stdout: "",
        stderr: "Add a Git subcommand.",
        code: 1,
      });
      return;
    }

    if (isDangerous(args)) {
      const choice = await vscode.window.showWarningMessage(
        `This command can discard work or rewrite history:\n\n${trimmed}\n\nRun it anyway?`,
        { modal: true },
        "Run anyway",
      );
      if (choice !== "Run anyway") {
        this.post({
          type: "commandResult",
          command: trimmed,
          stdout: "",
          stderr: "Canceled.",
          code: 1,
        });
        return;
      }
    }

    if (isInteractive(args)) {
      this.post({
        type: "commandResult",
        command: trimmed,
        stdout: "",
        stderr: "This command is interactive. Use Open Git Bash for it.",
        code: 1,
      });
      return;
    }

    this.post({ type: "commandRunning", command: trimmed });
    try {
      const stdout = await new GitService(root).runCommand(args);
      this.post({ type: "commandResult", command: trimmed, stdout, stderr: "", code: 0 });
      await this.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: "commandResult", command: trimmed, stdout: "", stderr: message, code: 1 });
    }
  }

  private runInTerminal(command: string): void {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }
    const terminal = vscode.window.createTerminal({
      name: "Git Triage",
      cwd: root,
      shellPath: findGitBash(),
    });
    terminal.show();
    terminal.sendText(command, true);
  }

  private async copyText(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);
    this.toast("success", "Copied to clipboard.");
  }

  private async getState(): Promise<DashboardState> {
    const config = getConfig();
    const root = getWorkspaceRoot();
    if (!root) {
      return {
        root: null,
        isRepo: false,
        branches: [],
        remotes: [],
        log: [],
        pollInterval: config.pollInterval,
        logLimit: config.logLimit,
      };
    }

    const git = new GitService(root);
    const isRepo = await git.isRepo();
    if (!isRepo) {
      return {
        root,
        isRepo: false,
        branches: [],
        remotes: [],
        log: [],
        pollInterval: config.pollInterval,
        logLimit: config.logLimit,
      };
    }

    const [status, branches, remotes, log] = await Promise.all([
      git.getStatus(),
      git.getBranches().catch(() => [] as GitBranch[]),
      git.getRemotes().catch(() => [] as GitRemote[]),
      git.getLog(config.logLimit).catch(() => [] as GitCommit[]),
    ]);

    const triage =
      this.scanController.getResult()?.root === root
        ? this.scanController.getResult()
        : undefined;

    return {
      root,
      isRepo: true,
      status,
      branches,
      remotes,
      log,
      triage,
      pollInterval: config.pollInterval,
      logLimit: config.logLimit,
    };
  }

  private async gitWithProgress(
    root: string,
    label: string,
    action: (git: GitService) => Promise<void>,
  ): Promise<void> {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Git Triage: ${label}`,
          cancellable: false,
        },
        async () => {
          await action(new GitService(root));
        },
      );
      this.toast("success", `${label} completed.`);
      await this.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[${new Date().toISOString()}] ${label} failed: ${message}`);
      this.toast("error", message);
    }
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      this.toast("error", "Open a folder first.");
      return;
    }

    try {
      switch (message.type) {
        case "ready":
        case "refresh":
          await this.refresh();
          break;
        case "scan":
          await this.scanController.scan({ history: false, silent: true });
          await this.refresh();
          break;
        case "scanHistory":
          await this.scanController.scan({ history: true, silent: true });
          await this.refresh();
          break;
        case "runbook": {
          const result = this.scanController.getResult() ?? (await this.scanController.scan({ silent: true }));
          if (result) await openRunbook(result);
          break;
        }
        case "stage":
          if (message.path) {
            await this.gitWithProgress(root, "stage", (git) => git.stage([message.path!]));
          }
          break;
        case "unstage":
          if (message.path) {
            await this.gitWithProgress(root, "unstage", (git) => git.unstage([message.path!]));
          }
          break;
        case "stageAll":
          await this.gitWithProgress(root, "stage all", (git) => git.stageAll());
          break;
        case "unstageAll":
          await this.gitWithProgress(root, "unstage all", (git) => git.unstageAll());
          break;
        case "commit":
          if (message.message) {
            await this.gitWithProgress(root, "commit", (git) => git.commit(message.message!));
          }
          break;
        case "checkout":
          if (message.branch) {
            await this.gitWithProgress(root, "checkout", (git) => git.checkout(message.branch!));
          }
          break;
        case "createBranch":
          if (message.branch) {
            await this.gitWithProgress(root, "create branch", (git) => git.createBranch(message.branch!));
          }
          break;
        case "fetch":
          await this.runGitAction("fetch");
          break;
        case "pull":
          await this.runGitAction("pull");
          break;
        case "push":
          await this.runGitAction("push");
          break;
        case "init":
          await this.initRepository();
          break;
        case "openFile":
          if (message.path) await this.openFile(root, message.path, message.line);
          break;
        case "diff":
          if (message.path) {
            const text = await new GitService(root).diff(message.path);
            await this.openVirtualDoc(`Git Triage: diff — ${message.path}`, text, "diff");
          }
          break;
        case "showCommit":
          if (message.hash) {
            const text = await new GitService(root).showCommit(message.hash);
            await this.openVirtualDoc(`Git Triage: commit ${message.hash.slice(0, 8)}`, text, "plaintext");
          }
          break;
        case "runCommand":
          if (message.command) await this.runGitCommand(message.command);
          break;
        case "runInTerminal":
          if (message.command) this.runInTerminal(message.command);
          break;
        case "copy":
          if (message.text) await this.copyText(message.text);
          break;
        case "openGitBash":
          await this.openGitBash();
          break;
        case "openSettings":
          await vscode.commands.executeCommand("workbench.action.openSettings", "gitTriage");
          break;
        case "openTerminal": {
          const terminal = vscode.window.createTerminal({ name: "Git Triage", cwd: root });
          terminal.show();
          break;
        }
        case "showOutput":
          this.output.show(true);
          break;
        default:
          break;
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[${new Date().toISOString()}] ${message.type} failed: ${text}`);
      this.toast("error", text);
    }
  }

  private async openFile(root: string, relative: string, line?: number): Promise<void> {
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
      this.toast("error", `Could not open ${relative}.`);
    }
  }

  private async openVirtualDoc(title: string, content: string, language: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({ content, language });
    await vscode.window.showTextDocument(document, { preview: true });
    this.output.appendLine(`[${new Date().toISOString()}] opened ${title}`);
  }

  private startPolling(): void {
    this.stopPolling();
    const interval = Math.max(1000, getConfig().pollInterval);
    this.timer = setInterval(() => {
      if (this.view?.visible) void this.refresh();
    }, interval);
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private post(message: unknown): void {
    void this.view?.webview.postMessage(message);
  }

  private toast(kind: "success" | "error" | "info", text: string): void {
    this.post({ type: "toast", kind, text });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "dashboard.css"),
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "dashboard.js"),
    );
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Git Triage</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
