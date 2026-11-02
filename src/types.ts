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
  /** Stable, non-reversible fingerprint for dedupe. Never the raw secret. */
  fingerprint?: string;
}

export interface ScanOptions {
  cwd: string;
  history?: boolean;
  maxCommits?: number;
  maxFiles?: number;
  maxFileBytes?: number;
}

export interface ScanResult {
  tool: "repo-trust";
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

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function compareFindings(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;
  const byFile = (a.file ?? "").localeCompare(b.file ?? "");
  if (byFile !== 0) return byFile;
  return (a.line ?? 0) - (b.line ?? 0);
}
