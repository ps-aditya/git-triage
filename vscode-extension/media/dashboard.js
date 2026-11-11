const vscode = acquireVsCodeApi();
const app = document.getElementById("app");

const SEVERITIES = ["critical", "high", "medium", "low"];

const COMMANDS = [
  { category: "Inspect", title: "Status", syntax: "git status", description: "Show staged, unstaged, and untracked files." },
  { category: "Inspect", title: "Short status", syntax: "git status -sb", description: "Compact branch and file status." },
  { category: "Inspect", title: "Log graph", syntax: "git log --oneline --graph --decorate -n 20", description: "Recent commits as a compact graph." },
  { category: "Inspect", title: "Unstaged diff", syntax: "git diff", description: "Show changes not staged for commit." },
  { category: "Inspect", title: "Staged diff", syntax: "git diff --cached", description: "Show changes that will be committed." },
  { category: "Inspect", title: "Show commit", syntax: "git show HEAD", description: "Show the latest commit and its patch." },
  { category: "Inspect", title: "Blame file", syntax: "git blame <file>", description: "Show who last changed each line." },
  { category: "Inspect", title: "Reflog", syntax: "git reflog -n 20", description: "Show recent HEAD movements, including resets." },

  { category: "Stage & commit", title: "Stage all", syntax: "git add -A", description: "Stage every change, including deletions." },
  { category: "Stage & commit", title: "Stage file", syntax: "git add <file>", description: "Stage one file or path." },
  { category: "Stage & commit", title: "Patch mode", syntax: "git add -p", description: "Choose hunks interactively.", interactive: true },
  { category: "Stage & commit", title: "Commit", syntax: `git commit -m "message"`, description: "Commit staged changes with a message." },
  { category: "Stage & commit", title: "Amend", syntax: "git commit --amend --no-edit", description: "Add staged changes to the last commit." },
  { category: "Stage & commit", title: "Unstage file", syntax: "git restore --staged <file>", description: "Remove a file from the index." },

  { category: "Branch & merge", title: "List branches", syntax: "git branch -vv", description: "Local branches with upstream and last commit." },
  { category: "Branch & merge", title: "Switch", syntax: "git switch <branch>", description: "Check out an existing branch." },
  { category: "Branch & merge", title: "Create branch", syntax: "git switch -c <branch>", description: "Create and check out a branch." },
  { category: "Branch & merge", title: "Merge", syntax: "git merge <branch>", description: "Merge another branch into the current one." },
  { category: "Branch & merge", title: "Rebase", syntax: "git rebase <branch>", description: "Replay current commits on top of another branch." },
  { category: "Branch & merge", title: "Cherry-pick", syntax: "git cherry-pick <commit>", description: "Apply one commit onto the current branch." },
  { category: "Branch & merge", title: "Delete branch", syntax: "git branch -d <branch>", description: "Delete a merged local branch.", danger: true },

  { category: "Sync", title: "Fetch all", syntax: "git fetch --all --prune", description: "Update remote-tracking refs and prune deleted branches." },
  { category: "Sync", title: "Pull fast-forward", syntax: "git pull --ff-only", description: "Pull without creating a merge commit." },
  { category: "Sync", title: "Push", syntax: "git push", description: "Push the current branch to its upstream." },
  { category: "Sync", title: "Push upstream", syntax: "git push -u origin HEAD", description: "Set upstream and push the current branch." },
  { category: "Sync", title: "Remotes", syntax: "git remote -v", description: "List fetch and push URLs." },

  { category: "Undo & recovery", title: "Restore file", syntax: "git restore <file>", description: "Discard unstaged changes in a file.", danger: true },
  { category: "Undo & recovery", title: "Soft reset", syntax: "git reset --soft HEAD~1", description: "Undo the last commit but keep changes staged." },
  { category: "Undo & recovery", title: "Hard reset", syntax: "git reset --hard HEAD~1", description: "Discard the last commit and its changes.", danger: true },
  { category: "Undo & recovery", title: "Revert commit", syntax: "git revert <commit>", description: "Create a new commit that undoes an old one." },
  { category: "Undo & recovery", title: "Clean untracked", syntax: "git clean -fd", description: "Delete untracked files and directories.", danger: true },

  { category: "Stash", title: "Stash changes", syntax: `git stash push -m "message"`, description: "Save tracked changes and restore a clean tree." },
  { category: "Stash", title: "List stashes", syntax: "git stash list", description: "Show saved stashes." },
  { category: "Stash", title: "Pop stash", syntax: "git stash pop", description: "Apply the latest stash and remove it." },
  { category: "Stash", title: "Apply stash", syntax: "git stash apply", description: "Apply the latest stash but keep it." },

  { category: "Tags", title: "List tags", syntax: "git tag --sort=-creatordate", description: "Show tags, newest first." },
  { category: "Tags", title: "Create tag", syntax: `git tag -a v1.0.0 -m "v1.0.0"`, description: "Create an annotated tag." },
  { category: "Tags", title: "Push tags", syntax: "git push --tags", description: "Push local tags to the remote." },

  { category: "Config", title: "List config", syntax: "git config --list --show-origin", description: "Show config values and their source." },
  { category: "Config", title: "User name", syntax: "git config user.name", description: "Show the name used for commits." },
  { category: "Config", title: "User email", syntax: "git config user.email", description: "Show the email used for commits." },

  { category: "Worktree", title: "List worktrees", syntax: "git worktree list", description: "Show linked worktrees." },
  { category: "Worktree", title: "Add worktree", syntax: "git worktree add ../<dir> <branch>", description: "Check out a branch in another directory." },
];

let commandSearch = "";
let consoleLines = [];
let commandHistory = [];
let historyIndex = -1;
let commandRunning = false;

let state = {
  root: null,
  isRepo: false,
  branches: [],
  remotes: [],
  log: [],
  triage: null,
  pollInterval: 3000,
  logLimit: 20,
};
let activeTab = (vscode.getState() && vscode.getState().activeTab) || "overview";
let busy = false;
let lastRefresh = "";
let toastState = null;
let toastTimer = 0;

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function repoName() {
  if (!state.root) return "No folder";
  const parts = state.root.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || state.root;
}

function branchName() {
  return state.status && state.status.branch ? state.status.branch : "no branch";
}

function changeCount() {
  return state.status ? state.status.files.length : 0;
}

function triageCount() {
  return state.triage ? state.triage.findings.length : 0;
}

function severityCounts() {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  if (!state.triage) return counts;
  for (const finding of state.triage.findings) {
    if (counts[finding.severity] != null) counts[finding.severity] += 1;
  }
  return counts;
}

function syncText() {
  if (!state.status) return "";
  const parts = [];
  if (state.status.ahead) parts.push(`↑${state.status.ahead}`);
  if (state.status.behind) parts.push(`↓${state.status.behind}`);
  return parts.length ? parts.join(" ") : "up to date";
}

function tab(id, label, count) {
  const badge =
    count != null
      ? `<span class="count ${count > 0 && id === "triage" ? "alert" : ""}">${count}</span>`
      : "";
  return `<button class="tab ${activeTab === id ? "active" : ""}" data-action="tab" data-tab="${id}">${label}${badge}</button>`;
}

function render() {
  const commitEl = document.querySelector("#commit-message");
  const branchEl = document.querySelector("#new-branch");
  const commandEl = document.querySelector("#git-command");
  const searchEl = document.querySelector("#command-search");
  const commitValue = commitEl ? commitEl.value : "";
  const branchValue = branchEl ? branchEl.value : "";
  const commandValue = commandEl ? commandEl.value : "";
  const searchValue = searchEl ? searchEl.value : "";
  const focusId = document.activeElement ? document.activeElement.id : "";
  const main = document.querySelector(".main");
  const scrollTop = main ? main.scrollTop : 0;

  const counts = severityCounts();
  const toastHtml = toastState
    ? `<div id="toast" class="toast ${toastState.kind}">${escapeHtml(toastState.text)}</div>`
    : `<div id="toast" class="toast hidden"></div>`;

  app.innerHTML = `
    <header class="header">
      <div class="brand-mark">◆</div>
      <div class="brand">
        <div class="brand-title">Git Triage</div>
        <div class="brand-sub">${escapeHtml(repoName())}${state.isRepo ? ` · ${escapeHtml(branchName())}` : ""}</div>
      </div>
      <div class="header-actions">
        <button class="icon-btn" data-action="openGitBash" title="Open Git Bash">⌘</button>
        <button class="icon-btn" data-action="refresh" title="Refresh">↻</button>
        <button class="icon-btn" data-action="openSettings" title="Settings">⚙</button>
      </div>
    </header>

    <nav class="tabs">
      ${tab("overview", "Overview")}
      ${tab("changes", "Changes", changeCount())}
      ${tab("branches", "Branches")}
      ${tab("history", "History")}
      ${tab("triage", "Triage", triageCount())}
      ${tab("commands", "Commands")}
    </nav>

    <main class="main">${content(counts)}</main>

    <footer class="footer">
      <div class="footer-left">
        <span id="busy-indicator" class="spinner ${busy ? "" : "hidden"}"></span>
        <span class="footer-branch">${escapeHtml(branchName())}</span>
        ${state.isRepo ? `<span>· ${escapeHtml(syncText())}</span>` : ""}
      </div>
      <span>${lastRefresh ? `updated ${escapeHtml(lastRefresh)}` : "starting…"}</span>
    </footer>
    ${toastHtml}
  `;

  if (commitValue) {
    const el = document.querySelector("#commit-message");
    if (el) el.value = commitValue;
  }
  if (branchValue) {
    const el = document.querySelector("#new-branch");
    if (el) el.value = branchValue;
  }
  if (commandValue) {
    const el = document.querySelector("#git-command");
    if (el) el.value = commandValue;
  }
  if (searchValue) {
    const el = document.querySelector("#command-search");
    if (el) el.value = searchValue;
  }
  if (scrollTop && main) {
    const next = document.querySelector(".main");
    if (next) next.scrollTop = scrollTop;
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) el.focus();
  }
}

function content(counts) {
  if (!state.root) {
    return `<div class="welcome"><h2>Open a folder</h2><p>Git Triage needs a workspace folder to inspect.</p></div>`;
  }
  if (!state.isRepo) {
    return `
      <div class="welcome">
        <h2>No Git repository</h2>
        <p>Initialize a repository here to see status, changes, branches, history, and sync state.</p>
        <div class="actions" style="justify-content:center">
          <button class="btn primary" data-action="init">Initialize repository</button>
          <button class="btn ghost" data-action="scan">Scan for leaks</button>
        </div>
      </div>
      ${state.triage ? triageCard(state.triage) : ""}
    `;
  }

  switch (activeTab) {
    case "changes":
      return changesView();
    case "branches":
      return branchesView();
    case "history":
      return historyView();
    case "triage":
      return triageView();
    case "commands":
      return commandsView();
    default:
      return overviewView(counts);
  }
}

function overviewView(counts) {
  const s = state.status;
  const staged = s ? s.stagedCount : 0;
  const unstaged = s ? s.unstagedCount : 0;
  const untracked = s ? s.untrackedCount : 0;
  const latest = state.log && state.log[0];

  return `
    <div class="card hero">
      <div class="hero-row">
        <span class="branch">${escapeHtml(s ? s.branch : "no branch")}</span>
        <span class="sync">${escapeHtml(syncText())}</span>
      </div>
      <div class="hero-sub">
        ${s && s.clean ? "Working tree clean" : `${changeCount()} changed file${changeCount() === 1 ? "" : "s"}`}
        · ${s && s.upstream ? `tracking ${escapeHtml(s.upstream)}` : "no upstream"}
      </div>
    </div>

    <div class="metrics">
      <div class="metric ${staged ? "warn" : ""}"><div class="metric-value">${staged}</div><div class="metric-label">Staged</div></div>
      <div class="metric ${unstaged ? "warn" : ""}"><div class="metric-value">${unstaged}</div><div class="metric-label">Unstaged</div></div>
      <div class="metric ${untracked ? "warn" : ""}"><div class="metric-value">${untracked}</div><div class="metric-label">Untracked</div></div>
      <div class="metric ${triageCount() ? "danger" : "ok"}"><div class="metric-value">${triageCount()}</div><div class="metric-label">Triage</div></div>
    </div>

    <div class="card">
      <div class="card-title">Actions</div>
      <div class="actions">
        <button class="btn primary" data-action="scan">Scan</button>
        <button class="btn" data-action="runbook">Runbook</button>
        <button class="btn" data-action="fetch">Fetch</button>
        <button class="btn" data-action="pull">Pull</button>
        <button class="btn" data-action="push">Push</button>
        <button class="btn ghost" data-action="tab" data-tab="changes">Commit…</button>
        <button class="btn ghost" data-action="tab" data-tab="commands">Commands</button>
        <button class="btn ghost" data-action="openGitBash">Git Bash</button>
      </div>
    </div>

    ${
      latest
        ? `<div class="card">
            <div class="card-title">Latest commit</div>
            <div class="row clickable" data-action="showCommit" data-hash="${escapeHtml(latest.hash)}">
              <div class="row-main">
                <div class="row-title">${escapeHtml(latest.subject)}</div>
                <div class="row-sub"><span class="mono">${escapeHtml(latest.shortHash)}</span> · ${escapeHtml(latest.author)} · ${escapeHtml(latest.relativeDate)}</div>
              </div>
            </div>
          </div>`
        : ""
    }

    <div class="card">
      <div class="card-title">Remotes <span class="count">${state.remotes.length}</span></div>
      ${
        state.remotes.length
          ? `<div class="list">${state.remotes
              .map(
                (remote) => `<div class="row">
                  <div class="row-main">
                    <div class="row-title">${escapeHtml(remote.name)}</div>
                    <div class="row-sub mono">${escapeHtml(remote.fetchUrl || remote.pushUrl)}</div>
                  </div>
                </div>`,
              )
              .join("")}</div>`
          : `<div class="empty">No remotes configured.</div>`
      }
    </div>

    <div class="card">
      <div class="card-title">Triage snapshot <button class="btn small ghost" data-action="tab" data-tab="triage">Open</button></div>
      ${
        state.triage
          ? `<div class="severity-summary">
              ${SEVERITIES.map(
                (severity) =>
                  `<div class="sev ${severity}"><div class="sev-value">${counts[severity]}</div><div class="sev-label">${severity}</div></div>`,
              ).join("")}
            </div>
            ${
              state.triage.findings.length
                ? `<div class="list">${state.triage.findings
                    .slice()
                    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
                    .slice(0, 3)
                    .map(findingRow)
                    .join("")}</div>`
                : `<div class="empty">No findings in the last scan.</div>`
            }`
          : `<div class="empty"><strong>No scan yet</strong>Run a triage scan to look for leaked credentials and folder-open tasks.</div>`
      }
    </div>
  `;
}

function changesView() {
  const s = state.status;
  const files = s ? s.files : [];
  const staged = s ? s.stagedCount : 0;

  if (!files.length) {
    return `<div class="empty"><strong>Working tree clean</strong>No staged, unstaged, or untracked changes.</div>`;
  }

  return `
    <div class="card">
      <div class="card-title">Changes <span class="count">${files.length}</span></div>
      <div class="actions">
        <button class="btn" data-action="stageAll">Stage all</button>
        <button class="btn" data-action="unstageAll">Unstage all</button>
        <button class="btn ghost" data-action="refresh">Refresh</button>
      </div>
    </div>

    <div class="card">
      <div class="list">${files.map(fileRow).join("")}</div>
    </div>

    <div class="card">
      <div class="card-title">Commit</div>
      <div class="commit-box">
        <textarea id="commit-message" placeholder="Commit message"></textarea>
        <div class="commit-actions">
          <span class="hint">${staged} staged file${staged === 1 ? "" : "s"}</span>
          <button class="btn primary" data-action="commit" ${staged === 0 ? "disabled" : ""}>Commit</button>
        </div>
      </div>
    </div>
  `;
}

function fileRow(file) {
  const letter = file.status === "?" ? "?" : file.status || "M";
  const badgeClass = letter === "?" ? "q" : letter;
  const label = file.origPath
    ? `${file.origPath} → ${file.path}`
    : file.path;

  const actions = [];
  if (file.unstaged || file.untracked) {
    actions.push(
      `<button class="btn small" data-action="stage" data-path="${escapeHtml(file.path)}">Stage</button>`,
    );
  }
  if (file.staged) {
    actions.push(
      `<button class="btn small" data-action="unstage" data-path="${escapeHtml(file.path)}">Unstage</button>`,
    );
  }
  actions.push(
    `<button class="btn small ghost" data-action="diff" data-path="${escapeHtml(file.path)}">Diff</button>`,
  );

  return `<div class="row file-row" data-action="openFile" data-path="${escapeHtml(file.path)}" data-line="1">
    <span class="status-badge ${badgeClass}">${escapeHtml(letter)}</span>
    <div class="row-main">
      <div class="path">${escapeHtml(label)}</div>
    </div>
    <div class="row-actions">${actions.join("")}</div>
  </div>`;
}

function branchesView() {
  const branches = state.branches || [];
  return `
    <div class="card">
      <div class="card-title">Local branches <span class="count">${branches.length}</span></div>
      ${
        branches.length
          ? `<div class="list">${branches
              .map(
                (branch) => `<div class="row">
                  <div class="row-main">
                    <div class="row-title">${escapeHtml(branch.name)} ${branch.current ? '<span class="count">current</span>' : ""}</div>
                    <div class="row-sub">${escapeHtml(branch.upstream || "no upstream")}${branch.subject ? ` · ${escapeHtml(branch.subject)}` : ""}</div>
                  </div>
                  ${
                    branch.current
                      ? ""
                      : `<div class="row-actions"><button class="btn small" data-action="checkout" data-branch="${escapeHtml(branch.name)}">Checkout</button></div>`
                  }
                </div>`,
              )
              .join("")}</div>`
          : `<div class="empty">No local branches yet.</div>`
      }
    </div>

    <div class="card">
      <div class="card-title">Create branch</div>
      <div class="commit-box">
        <input id="new-branch" type="text" placeholder="feature/name" />
        <div class="commit-actions">
          <span class="hint">Creates and checks out a new branch.</span>
          <button class="btn primary" data-action="createBranch">Create</button>
        </div>
      </div>
    </div>
  `;
}

function historyView() {
  const log = state.log || [];
  if (!log.length) {
    return `<div class="empty"><strong>No commits yet</strong>Make a commit to see history here.</div>`;
  }
  return `
    <div class="card">
      <div class="card-title">Recent commits <span class="count">${log.length}</span></div>
      <div class="list">
        ${log
          .map(
            (commit) => `<div class="row clickable" data-action="showCommit" data-hash="${escapeHtml(commit.hash)}">
              <div class="row-main">
                <div class="row-title">${escapeHtml(commit.subject)}</div>
                <div class="row-sub"><span class="mono">${escapeHtml(commit.shortHash)}</span> · ${escapeHtml(commit.author)} · ${escapeHtml(commit.relativeDate)}</div>
              </div>
              <div class="row-actions"><button class="btn small ghost" data-action="showCommit" data-hash="${escapeHtml(commit.hash)}">View</button></div>
            </div>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function triageView() {
  if (!state.triage) {
    return `
      <div class="empty"><strong>No scan yet</strong>Scan the working tree for leaked credentials and hidden folder-open tasks.</div>
      <div class="actions" style="justify-content:center">
        <button class="btn primary" data-action="scan">Scan workspace</button>
        <button class="btn" data-action="scanHistory">Scan + history</button>
      </div>
    `;
  }
  return triageCard(state.triage);
}

function triageCard(triage) {
  const counts = severityCounts();
  const findings = triage.findings
    .slice()
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  return `
    <div class="card">
      <div class="card-title">Triage <button class="btn small ghost" data-action="runbook">Runbook</button></div>
      <div class="severity-summary">
        ${SEVERITIES.map(
          (severity) =>
            `<div class="sev ${severity}"><div class="sev-value">${counts[severity]}</div><div class="sev-label">${severity}</div></div>`,
        ).join("")}
      </div>
      <div class="hint">Scanned ${triage.scanned.files} files${triage.scanned.commits ? ` and ${triage.scanned.commits} commits` : ""}.</div>
      <div class="actions" style="margin-top:6px">
        <button class="btn primary" data-action="scan">Scan</button>
        <button class="btn" data-action="scanHistory">Scan + history</button>
      </div>
    </div>

    ${
      findings.length
        ? `<div class="card"><div class="list">${findings.map(findingRow).join("")}</div></div>`
        : `<div class="empty"><strong>No findings</strong>Nothing matched in the scanned scope.</div>`
    }
  `;
}

function commandsView() {
  return `
    <div class="card">
      <div class="card-title">Git console <button class="btn small ghost" data-action="openGitBash">Open Git Bash</button></div>
      <div class="console" id="console-output">${consoleHtml()}</div>
      <div class="console-input">
        <span class="prompt">git&gt;</span>
        <input id="git-command" type="text" placeholder="status" autocomplete="off" spellcheck="false" />
        <button class="btn primary" data-action="runCommand">Run</button>
        <button class="btn small ghost" data-action="clearConsole" title="Clear console">Clear</button>
      </div>
      <div class="hint">Runs git commands in this workspace. Pipes, redirects, and interactive commands belong in Git Bash.</div>
    </div>
    <div class="card">
      <div class="card-title">Command helper <span class="count">${COMMANDS.length}</span></div>
      <input id="command-search" type="text" placeholder="Search commands…" autocomplete="off" spellcheck="false" />
      <div id="command-list" class="command-list">${renderCommandList()}</div>
    </div>
  `;
}

function consoleHtml() {
  if (!consoleLines.length) {
    return `<span class="console-muted">Run a command to see output here.</span>`;
  }
  return consoleLines
    .map(
      (line) =>
        `<div class="console-line ${line.kind}">${escapeHtml(line.text)}</div>`,
    )
    .join("");
}

function renderCommandList() {
  const query = commandSearch.trim().toLowerCase();
  const items = COMMANDS.filter((command) => {
    if (!query) return true;
    return `${command.category} ${command.title} ${command.syntax} ${command.description}`
      .toLowerCase()
      .includes(query);
  });

  if (!items.length) {
    return `<div class="empty">No matching commands.</div>`;
  }

  const categories = [];
  for (const item of items) {
    if (!categories.includes(item.category)) categories.push(item.category);
  }

  return categories
    .map(
      (category) => `<div class="command-group">
        <div class="command-category">${escapeHtml(category)}</div>
        ${items
          .filter((item) => item.category === category)
          .map(commandCard)
          .join("")}
      </div>`,
    )
    .join("");
}

function commandCard(command) {
  const incomplete = /<[^>]+>/.test(command.syntax);
  const badges = [
    command.danger ? `<span class="badge danger">danger</span>` : "",
    command.interactive ? `<span class="badge">interactive</span>` : "",
    incomplete ? `<span class="badge">template</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `<div class="command-card">
    <div class="command-title">${escapeHtml(command.title)} ${badges}</div>
    <code class="command-syntax">${escapeHtml(command.syntax)}</code>
    <div class="command-desc">${escapeHtml(command.description)}</div>
    <div class="command-actions">
      <button class="btn small" data-action="useCommand" data-command="${escapeHtml(command.syntax)}">Use</button>
      <button class="btn small ghost" data-action="copyCommand" data-command="${escapeHtml(command.syntax)}">Copy</button>
      ${
        command.interactive
          ? `<button class="btn small ghost" data-action="runInTerminal" data-command="${escapeHtml(command.syntax)}">Git Bash</button>`
          : incomplete
            ? ""
            : `<button class="btn small primary" data-action="runCommand" data-command="${escapeHtml(command.syntax)}">Run</button>`
      }
    </div>
  </div>`;
}

function updateConsoleDom() {
  const el = document.getElementById("console-output");
  if (!el) return;
  el.innerHTML = consoleHtml();
  el.scrollTop = el.scrollHeight;
}

function appendConsole(text, kind) {
  consoleLines.push({ text, kind: kind || "output" });
  if (consoleLines.length > 200) consoleLines = consoleLines.slice(-200);
  updateConsoleDom();
}

function setCommandBusy(value) {
  commandRunning = value;
  document.body.classList.toggle("command-busy", value);
  const input = document.getElementById("git-command");
  if (input) input.disabled = value;
  document.querySelectorAll('[data-action="runCommand"]').forEach((button) => {
    button.disabled = value;
  });
}

function runCommandValue(command) {
  const trimmed = command.trim();
  if (!trimmed || commandRunning) return;
  const input = document.getElementById("git-command");
  if (input) input.value = trimmed;
  commandHistory = commandHistory.filter((item) => item !== trimmed);
  commandHistory.unshift(trimmed);
  commandHistory = commandHistory.slice(0, 50);
  historyIndex = -1;
  appendConsole(`git> ${trimmed}`, "command");
  setCommandBusy(true);
  post({ type: "runCommand", command: trimmed });
}

function findingRow(finding) {
  const location = finding.file
    ? `${finding.file}${finding.line ? `:${finding.line}` : ""}`
    : "repository";
  return `<div class="finding" data-action="${finding.file ? "openFile" : ""}" data-path="${escapeHtml(finding.file || "")}" data-line="${finding.line || 1}" title="${escapeHtml(finding.message)}">
    <span class="dot ${finding.severity}"></span>
    <div class="row-main">
      <div class="finding-title">${escapeHtml(finding.title)}</div>
      <div class="finding-sub">${escapeHtml(location)} · ${escapeHtml(finding.message)}</div>
    </div>
  </div>`;
}

function setBusy(value) {
  busy = value;
  document.body.classList.toggle("busy", busy);
  const spinner = document.getElementById("busy-indicator");
  if (spinner) spinner.classList.toggle("hidden", !busy);
}

function showToast(kind, text) {
  toastState = { kind, text };
  const el = document.getElementById("toast");
  if (el) {
    el.className = `toast ${kind}`;
    el.textContent = text;
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastState = null;
    if (el) el.classList.add("hidden");
  }, 4500);
}

function post(message) {
  vscode.postMessage(message);
}

function isEditing() {
  const el = document.activeElement;
  return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT");
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.getAttribute("data-action");
  if (!action) return;

  if (action === "tab") {
    activeTab = target.getAttribute("data-tab") || "overview";
    vscode.setState({ activeTab });
    render();
    return;
  }

  if (action === "commit") {
    const input = document.querySelector("#commit-message");
    const message = input && "value" in input ? input.value : "";
    if (!message.trim()) {
      showToast("error", "Commit message is required.");
      return;
    }
    post({ type: "commit", message });
    return;
  }

  if (action === "createBranch") {
    const input = document.querySelector("#new-branch");
    const branch = input && "value" in input ? input.value.trim() : "";
    if (!branch) {
      showToast("error", "Branch name is required.");
      return;
    }
    post({ type: "createBranch", branch });
    return;
  }

  if (action === "runCommand") {
    const command = target.getAttribute("data-command");
    if (command) {
      runCommandValue(command);
      return;
    }
    const input = document.querySelector("#git-command");
    if (input && "value" in input) runCommandValue(input.value);
    return;
  }

  if (action === "runInTerminal") {
    const command = target.getAttribute("data-command");
    if (command) post({ type: "runInTerminal", command });
    return;
  }

  if (action === "copyCommand") {
    const text = target.getAttribute("data-command");
    if (text) post({ type: "copy", text });
    return;
  }

  if (action === "useCommand") {
    const command = target.getAttribute("data-command");
    const input = document.querySelector("#git-command");
    if (command && input && "value" in input) {
      input.value = command;
      input.focus();
      input.scrollIntoView?.({ block: "center" });
    }
    return;
  }

  if (action === "clearConsole") {
    consoleLines = [];
    updateConsoleDom();
    return;
  }

  const payload = { type: action };
  const path = target.getAttribute("data-path");
  const line = target.getAttribute("data-line");
  const branch = target.getAttribute("data-branch");
  const hash = target.getAttribute("data-hash");
  if (path) payload.path = path;
  if (line) payload.line = Number(line);
  if (branch) payload.branch = branch;
  if (hash) payload.hash = hash;
  post(payload);
});

app.addEventListener("input", (event) => {
  if (event.target.id === "command-search") {
    commandSearch = event.target.value;
    const list = document.getElementById("command-list");
    if (list) list.innerHTML = renderCommandList();
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && event.target.id === "new-branch") {
    event.preventDefault();
    const input = event.target;
    const branch = input.value.trim();
    if (branch) post({ type: "createBranch", branch });
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && event.target.id === "commit-message") {
    event.preventDefault();
    const input = event.target;
    if (input.value.trim()) post({ type: "commit", message: input.value });
  }
  if (event.key === "Enter" && event.target.id === "git-command") {
    event.preventDefault();
    const input = event.target;
    runCommandValue(input.value);
  }
  if (event.target.id === "git-command" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    if (!commandHistory.length) return;
    const input = event.target;
    if (event.key === "ArrowUp") {
      historyIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
    } else {
      historyIndex = Math.max(-1, historyIndex - 1);
    }
    input.value = historyIndex === -1 ? "" : commandHistory[historyIndex];
  }
});

document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (!isEditing()) render();
  }, 0);
});

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "state") {
    state = message.state || state;
    lastRefresh = new Date().toLocaleTimeString();
    if (!isEditing()) render();
    if (state.error) showToast("error", state.error);
  } else if (message.type === "busy") {
    setBusy(Boolean(message.busy));
  } else if (message.type === "commandRunning") {
    setCommandBusy(true);
  } else if (message.type === "commandResult") {
    setCommandBusy(false);
    const output = [message.stdout, message.stderr].filter(Boolean).join("\n").trim();
    appendConsole(
      output || (message.code === 0 ? "(no output)" : `exit ${message.code}`),
      message.code === 0 ? "output" : "error",
    );
  } else if (message.type === "toast") {
    showToast(message.kind, message.text);
  }
});

render();
post({ type: "ready" });
