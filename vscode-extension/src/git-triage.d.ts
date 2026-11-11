declare module "git-triage" {
  export type Severity = "critical" | "high" | "medium" | "low";
  export type Category = "malware" | "secret" | "config" | "ci";

  export interface Finding {
    ruleId: string;
    category: Category;
    severity: Severity;
    title: string;
    message: string;
    file?: string;
    line?: number;
    commit?: string;
    evidence?: string;
    remediation?: string;
    fingerprint?: string;
  }

  export interface ScanResult {
    tool: "git-triage";
    version: string;
    root: string;
    findings: Finding[];
    scanned: {
      files: number;
      commits: number;
      skipped: number;
      truncated: boolean;
    };
    durationMs: number;
  }

  export interface ScanOptions {
    cwd: string;
    history?: boolean;
    maxCommits?: number;
    maxFiles?: number;
    maxFileBytes?: number;
  }

  export function scan(options: ScanOptions): Promise<ScanResult>;
}
