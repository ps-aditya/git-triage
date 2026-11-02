import path from "node:path";
import { checkAssets } from "./checks/assets.js";
import { checkCi } from "./checks/ci.js";
import { checkGit } from "./checks/git.js";
import { checkSecrets } from "./checks/secrets.js";
import { checkTasks } from "./checks/tasks.js";
import { compareFindings, type Finding, type ScanOptions, type ScanResult } from "./types.js";
import { dirExists, walkFiles } from "./util.js";
import { VERSION } from "./version.js";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const finding of findings) {
    const key = [
      finding.ruleId,
      finding.file ?? "",
      finding.line ?? "",
      finding.commit ?? "",
      finding.evidence ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(finding);
  }
  return out;
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const started = Date.now();
  const root = path.resolve(options.cwd);

  if (!dirExists(root)) {
    throw new Error(`Not a directory: ${root}`);
  }

  const walked = walkFiles(root, { maxFiles: options.maxFiles ?? 50_000 });
  const files = walked.files;

  const findings: Finding[] = [];
  findings.push(...safe(() => checkTasks(root, files), []));
  findings.push(...safe(() => checkAssets(root, files), []));
  findings.push(...safe(() => checkGit(root), []));
  findings.push(...safe(() => checkCi(root, files), []));

  let secretCommits = 0;
  let secretTruncated = false;
  try {
    const secrets = await checkSecrets(root, files, {
      history: options.history,
      maxCommits: options.maxCommits,
    });
    findings.push(...secrets.findings);
    secretCommits = secrets.commits;
    secretTruncated = secrets.truncated;
  } catch {
    // A secret-scan failure should not hide the other checks.
  }

  const unique = dedupe(findings).sort(compareFindings);

  return {
    tool: "git-triage",
    version: VERSION,
    root,
    findings: unique,
    scanned: {
      files: files.length,
      commits: secretCommits,
      skipped: walked.skipped,
      truncated: walked.truncated || secretTruncated,
    },
    durationMs: Date.now() - started,
  };
}
