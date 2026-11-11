import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  runScripts: "outside-only",
  url: "https://example.com",
});
const messages = [];
dom.window.acquireVsCodeApi = () => ({
  postMessage: (message) => messages.push(message),
  getState: () => null,
  setState: () => {},
});
dom.window.eval(fs.readFileSync("media/dashboard.js", "utf8"));
const state = {
  root: "C:\\repo",
  isRepo: true,
  status: {
    branch: "main",
    detached: false,
    upstream: "origin/main",
    ahead: 1,
    behind: 0,
    stagedCount: 1,
    unstagedCount: 1,
    untrackedCount: 1,
    clean: false,
    files: [
      { path: "src/a.ts", index: "M", worktree: ".", status: "M", staged: true, unstaged: false, untracked: false, unmerged: false },
      { path: "b.md", index: ".", worktree: "M", status: "M", staged: false, unstaged: true, untracked: false, unmerged: false },
      { path: "new.txt", index: "?", worktree: "?", status: "?", staged: false, unstaged: false, untracked: true, unmerged: false },
    ],
  },
  branches: [{ name: "main", current: true, upstream: "origin/main", oid: "abc123", subject: "init" }],
  remotes: [{ name: "origin", fetchUrl: "git@github.com:ps-aditya/git-triage.git", pushUrl: "git@github.com:ps-aditya/git-triage.git" }],
  log: [{ hash: "abc123", shortHash: "abc123", author: "Ada", relativeDate: "2 hours ago", subject: "init" }],
  triage: {
    tool: "git-triage",
    version: "0.1.0",
    root: "C:\\repo",
    findings: [
      { ruleId: "gitlab-incoming-email-token", category: "secret", severity: "critical", title: "GitLab incoming email token", message: "Account-wide, non-expiring token.", file: "README.md", line: 3, evidence: "glimt-…1234", remediation: "Reset it." },
    ],
    scanned: { files: 10, commits: 0, skipped: 0, truncated: false },
    durationMs: 100,
  },
  pollInterval: 3000,
  logLimit: 20,
};
dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data: { type: "state", state } }));
const text = () => dom.window.document.body.textContent;
if (!text().includes("Git Triage")) throw new Error("header missing");
if (!text().includes("main")) throw new Error("branch missing");
if (!text().includes("Triage")) throw new Error("triage tab missing");
dom.window.document.querySelector('[data-tab="changes"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
if (!text().includes("Commit")) throw new Error("changes tab missing");
if (!text().includes("Stage")) throw new Error("stage action missing");
dom.window.document.querySelector('[data-tab="commands"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
if (!text().includes("Git console")) throw new Error("commands console missing");
if (!text().includes("git status")) throw new Error("command reference missing");
const use = dom.window.document.querySelector('[data-action="useCommand"]');
if (use) use.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const commandInput = dom.window.document.querySelector("#git-command");
if (!commandInput || !commandInput.value) throw new Error("useCommand did not fill input");
const run = dom.window.document.querySelector('.console-input [data-action="runCommand"]');
if (!run) throw new Error("console run button missing");
run.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
if (!messages.some((message) => message.type === "runCommand")) throw new Error("runCommand message missing");
dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data: { type: "commandResult", command: "git status", stdout: "On branch main", stderr: "", code: 0 } }));
if (!text().includes("On branch main")) throw new Error("command output missing");
console.log("dashboard smoke OK");
console.log("messages:", messages.map((message) => message.type).join(", "));
