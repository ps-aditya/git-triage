import * as vscode from "vscode";

export interface GitTriageConfig {
  scanOnOpen: boolean;
  history: boolean;
  maxCommits: number;
  showProblems: boolean;
  warnOnFolderOpen: boolean;
  pollInterval: number;
  logLimit: number;
  openDashboardOnStartup: boolean;
}

export function getConfig(): GitTriageConfig {
  const config = vscode.workspace.getConfiguration("gitTriage");
  return {
    scanOnOpen: config.get<boolean>("scanOnOpen", true),
    history: config.get<boolean>("history", false),
    maxCommits: config.get<number>("maxCommits", 500),
    showProblems: config.get<boolean>("showProblems", true),
    warnOnFolderOpen: config.get<boolean>("warnOnFolderOpen", true),
    pollInterval: config.get<number>("pollInterval", 3000),
    logLimit: config.get<number>("logLimit", 20),
    openDashboardOnStartup: config.get<boolean>("openDashboardOnStartup", false),
  };
}

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getWorkspaceFolderCount(): number {
  return vscode.workspace.workspaceFolders?.length ?? 0;
}
