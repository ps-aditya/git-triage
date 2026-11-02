#!/usr/bin/env node
import { scan } from "./scanner.js";
import {
  formatFixPlan,
  formatJson,
  formatPretty,
  formatRules,
  setColorEnabled,
} from "./report.js";
import { SEVERITY_RANK, type Severity } from "./types.js";
import { VERSION } from "./version.js";

type Command = "scan" | "fix" | "rules";

interface Args {
  command: Command;
  path: string;
  json: boolean;
  history: boolean;
  maxCommits: number;
  ci: boolean;
  failOn?: Severity;
  noColor: boolean;
  help: boolean;
  version: boolean;
}

const HELP = `repo-trust ${VERSION}

Scan a repository for malicious folder-open tasks, fake assets, and leaked
credentials before you open it.

Usage:
  repo-trust scan [path] [options]
  repo-trust fix [path]
  repo-trust rules

Options:
  --json                 Machine-readable output
  --history              Scan git history (slower)
  --max-commits <n>      Limit history scan (default: 500)
  --ci                   Exit 1 if high or critical findings are present
  --fail-on <severity>   Exit 1 at or above this severity (critical|high|medium|low)
  --no-color             Disable ANSI colors
  -h, --help             Show this help
  -v, --version          Show the version

Examples:
  npx repo-trust scan .
  npx repo-trust scan . --history --json
  npx repo-trust fix .
`;

function isSeverity(value: string): value is Severity {
  return value === "critical" || value === "high" || value === "medium" || value === "low";
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: "scan",
    path: ".",
    json: false,
    history: false,
    maxCommits: 500,
    ci: false,
    noColor: false,
    help: false,
    version: false,
  };

  let commandSet = false;
  let pathSet = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "-v" || arg === "--version") {
      args.version = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--history") {
      args.history = true;
      continue;
    }
    if (arg === "--ci") {
      args.ci = true;
      continue;
    }
    if (arg === "--no-color") {
      args.noColor = true;
      continue;
    }
    if (arg === "--max-commits") {
      const value = argv[i + 1];
      if (!value) throw new Error("--max-commits requires a number");
      args.maxCommits = Number.parseInt(value, 10);
      i += 1;
      continue;
    }
    if (arg.startsWith("--max-commits=")) {
      args.maxCommits = Number.parseInt(arg.slice("--max-commits=".length), 10);
      continue;
    }
    if (arg === "--fail-on") {
      const value = argv[i + 1];
      if (!value || !isSeverity(value)) {
        throw new Error("--fail-on requires one of: critical, high, medium, low");
      }
      args.failOn = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--fail-on=")) {
      const value = arg.slice("--fail-on=".length);
      if (!isSeverity(value)) {
        throw new Error("--fail-on requires one of: critical, high, medium, low");
      }
      args.failOn = value;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (!commandSet && (arg === "scan" || arg === "fix" || arg === "rules")) {
      args.command = arg;
      commandSet = true;
      continue;
    }

    if (!pathSet) {
      args.path = arg;
      pathSet = true;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!Number.isFinite(args.maxCommits) || args.maxCommits < 1) {
    throw new Error("--max-commits must be a positive number");
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.noColor || process.env.NO_COLOR) setColorEnabled(false);

  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args.version) {
    console.log(VERSION);
    return;
  }
  if (args.command === "rules") {
    console.log(formatRules());
    return;
  }

  const result = await scan({
    cwd: args.path,
    history: args.history,
    maxCommits: args.maxCommits,
  });

  if (args.command === "fix") {
    console.log(formatFixPlan(result));
    return;
  }

  console.log(args.json ? formatJson(result) : formatPretty(result));

  const threshold = args.failOn ?? (args.ci ? "high" : undefined);
  if (threshold) {
    const failed = result.findings.some(
      (finding) => SEVERITY_RANK[finding.severity] <= SEVERITY_RANK[threshold],
    );
    if (failed) process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`repo-trust: ${message}`);
  process.exitCode = 2;
});
