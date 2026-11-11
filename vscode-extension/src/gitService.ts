import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitFileChange {
  path: string;
  origPath?: string;
  index: string;
  worktree: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  unmerged: boolean;
}

export interface GitStatus {
  branch: string;
  detached: boolean;
  oid?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  files: GitFileChange[];
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  clean: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  upstream?: string;
  oid: string;
  subject: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  relativeDate: string;
  subject: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

function statusLabel(index: string, worktree: string, untracked: boolean, unmerged: boolean): string {
  if (unmerged) return "U";
  if (untracked) return "?";
  if (index === "R" || worktree === "R") return "R";
  if (index === "C" || worktree === "C") return "C";
  if (index === "A" || worktree === "A") return "A";
  if (index === "D" || worktree === "D") return "D";
  if (index === "M" || worktree === "M") return "M";
  return "•";
}

function parseStatus(stdout: string): GitStatus {
  const status: GitStatus = {
    branch: "(unknown)",
    detached: false,
    ahead: 0,
    behind: 0,
    files: [],
    stagedCount: 0,
    unstagedCount: 0,
    untrackedCount: 0,
    clean: true,
  };

  const tokens = stdout.split("\0").filter((token) => token.length > 0);
  for (let i = 0; i < tokens.length; i += 1) {
    const line = tokens[i];

    if (line.startsWith("# branch.head ")) {
      const head = line.slice("# branch.head ".length);
      status.branch = head === "(detached)" ? "detached HEAD" : head;
      status.detached = head === "(detached)";
      continue;
    }
    if (line.startsWith("# branch.oid ")) {
      status.oid = line.slice("# branch.oid ".length);
      continue;
    }
    if (line.startsWith("# branch.upstream ")) {
      status.upstream = line.slice("# branch.upstream ".length);
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(\d+)\s+-(\d+)/);
      if (match) {
        status.ahead = Number.parseInt(match[1], 10);
        status.behind = Number.parseInt(match[2], 10);
      }
      continue;
    }

    if (line.startsWith("1 ")) {
      const parts = line.split(" ");
      const index = parts[1]?.[0] ?? ".";
      const worktree = parts[1]?.[1] ?? ".";
      const path = parts.slice(8).join(" ");
      const change: GitFileChange = {
        path,
        index,
        worktree,
        status: statusLabel(index, worktree, false, false),
        staged: index !== "." && index !== " ",
        unstaged: worktree !== "." && worktree !== " ",
        untracked: false,
        unmerged: false,
      };
      status.files.push(change);
      continue;
    }

    if (line.startsWith("2 ")) {
      const parts = line.split(" ");
      const index = parts[1]?.[0] ?? ".";
      const worktree = parts[1]?.[1] ?? ".";
      const path = parts.slice(9).join(" ");
      const origPath = tokens[i + 1];
      if (origPath) i += 1;
      const change: GitFileChange = {
        path,
        origPath,
        index,
        worktree,
        status: "R",
        staged: index !== "." && index !== " ",
        unstaged: worktree !== "." && worktree !== " ",
        untracked: false,
        unmerged: false,
      };
      status.files.push(change);
      continue;
    }

    if (line.startsWith("u ")) {
      const parts = line.split(" ");
      const index = parts[1]?.[0] ?? "U";
      const worktree = parts[1]?.[1] ?? "U";
      const path = parts.slice(10).join(" ");
      status.files.push({
        path,
        index,
        worktree,
        status: "U",
        staged: false,
        unstaged: true,
        untracked: false,
        unmerged: true,
      });
      continue;
    }

    if (line.startsWith("? ")) {
      const path = line.slice(2);
      status.files.push({
        path,
        index: "?",
        worktree: "?",
        status: "?",
        staged: false,
        unstaged: false,
        untracked: true,
        unmerged: false,
      });
    }
  }

  status.stagedCount = status.files.filter((file) => file.staged).length;
  status.unstagedCount = status.files.filter((file) => file.unstaged).length;
  status.untrackedCount = status.files.filter((file) => file.untracked).length;
  status.clean = status.files.length === 0;
  return status;
}

export class GitService {
  constructor(private readonly root: string) {}

  private async run(args: string[], maxBuffer = 20_000_000): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd: this.root,
        windowsHide: true,
        maxBuffer,
        timeout: 30_000,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_EDITOR: "true",
          GIT_PAGER: "cat",
        },
      });
      return stdout;
    } catch (error) {
      const err = error as { stderr?: string; stdout?: string; message?: string };
      const detail = (err.stderr || err.stdout || err.message || "git command failed").trim();
      throw new Error(detail);
    }
  }

  /** Runs a raw `git` argument vector and returns stdout. */
  async runCommand(args: string[]): Promise<string> {
    return this.run(args, 5_000_000);
  }

  async isRepo(): Promise<boolean> {
    try {
      const out = await this.run(["rev-parse", "--is-inside-work-tree"]);
      return out.trim() === "true";
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<GitStatus> {
    return parseStatus(await this.run(["status", "--porcelain=v2", "--branch", "-z"]));
  }

  async getBranches(): Promise<GitBranch[]> {
    const out = await this.run([
      "for-each-ref",
      "--format=%(refname:short)%09%(HEAD)%09%(upstream:short)%09%(objectname:short)%09%(subject)",
      "refs/heads",
    ]);
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, head, upstream, oid, ...subjectParts] = line.split("\t");
        return {
          name,
          current: head === "*",
          upstream: upstream || undefined,
          oid,
          subject: subjectParts.join("\t"),
        };
      })
      .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
  }

  async getLog(limit = 20): Promise<GitCommit[]> {
    const out = await this.run([
      "log",
      `-n`,
      String(limit),
      "--date=relative",
      "--pretty=format:%H%x00%h%x00%an%x00%ar%x00%s",
    ]);
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, author, relativeDate, ...subjectParts] = line.split("\0");
        return {
          hash,
          shortHash,
          author,
          relativeDate,
          subject: subjectParts.join("\0"),
        };
      });
  }

  async getRemotes(): Promise<GitRemote[]> {
    const out = await this.run(["remote", "-v"]);
    const map = new Map<string, GitRemote>();
    for (const line of out.split(/\r?\n/)) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (!match) continue;
      const [, name, url, kind] = match;
      const remote = map.get(name) ?? { name, fetchUrl: "", pushUrl: "" };
      if (kind === "fetch") remote.fetchUrl = url;
      else remote.pushUrl = url;
      map.set(name, remote);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async stage(paths: string[]): Promise<void> {
    await this.run(["add", "-A", "--", ...paths]);
  }

  async unstage(paths: string[]): Promise<void> {
    try {
      await this.run(["restore", "--staged", "--", ...paths]);
    } catch {
      await this.run(["reset", "HEAD", "--", ...paths]);
    }
  }

  async stageAll(): Promise<void> {
    await this.run(["add", "-A"]);
  }

  async unstageAll(): Promise<void> {
    try {
      await this.run(["restore", "--staged", "."]);
    } catch {
      await this.run(["reset"]);
    }
  }

  async commit(message: string): Promise<void> {
    if (!message.trim()) throw new Error("Commit message is required.");
    await this.run(["commit", "-m", message]);
  }

  async checkout(branch: string): Promise<void> {
    await this.run(["checkout", branch]);
  }

  async createBranch(branch: string): Promise<void> {
    if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.startsWith("-") || branch.includes("..")) {
      throw new Error("Invalid branch name.");
    }
    await this.run(["switch", "-c", branch]);
  }

  async fetch(): Promise<void> {
    await this.run(["fetch", "--all", "--prune"]);
  }

  async pull(): Promise<void> {
    await this.run(["pull", "--no-edit"]);
  }

  async push(): Promise<void> {
    await this.run(["push"]);
  }

  async init(): Promise<void> {
    await this.run(["init"]);
  }

  async diff(path: string): Promise<string> {
    const unstaged = await this.run(["diff", "--no-color", "--", path]);
    if (unstaged.trim()) return unstaged;
    const staged = await this.run(["diff", "--cached", "--no-color", "--", path]);
    if (staged.trim()) return staged;
    return `No diff for ${path}. It may be untracked or unchanged.`;
  }

  async showCommit(hash: string): Promise<string> {
    return this.run(["show", "--stat", "--patch", "--no-color", "--format=fuller", hash], 50_000_000);
  }
}
