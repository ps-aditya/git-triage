# Git Triage

**GitLab patched the CVE. Your leaked token is still valid.**

Git Triage is a free, local-first VS Code extension for the 2026 GitLab credential leaks and the VS Code folder-open malware wave. It finds leaked GitLab credentials and hidden folder-open tasks, publishes them to the Problems panel and a dedicated view, and gives you a revoke → rotate → purge → verify runbook.

> This extension wraps the open-source [`git-triage`](https://www.npmjs.com/package/git-triage) scanner. It reads workspace files locally. No account, no telemetry, no network calls.

---

## Why this exists

GitLab shipped three CVSS 10.0 fixes in six weeks in 2026, including CVE-2026-85706, which let an unauthenticated attacker read `/etc/gitlab/gitlab-secrets.json` and decrypt CI/CD variables, deploy keys, and integration tokens.

Patching the server did not revoke the credentials that had already leaked.

The worst case is GitLab's incoming-email token: the `glimt-` string inside an `incoming+...@incoming.gitlab.com` address is account-wide, never expires, and is not checked against the sender. Change `-issue` to `-merge-request`, attach a `.patch`, and GitLab commits it as you and runs CI. It bypasses IP allow-lists and 2FA because it arrives by email.

GitLab's automatic revocation does not cover this token. The only fix is a manual reset.

Git Triage makes the credential and the execution surface visible before you trust the workspace.

Read the launch analysis: [GitLab patched the CVE. Your leaked token is still valid.](https://github.com/ps-aditya/git-triage/blob/main/blog/2026-11-01-gitlab-patched-the-cve-your-token-is-still-valid.md)

---

## Features

- **Find leaked GitLab credentials** in the working tree: `glimt-` incoming-email tokens, `glpat-` PATs, and other GitLab token prefixes.
- **Find other leaked credentials**: GitHub PATs, AWS access keys, npm tokens, OpenAI/Anthropic keys, SSH private keys.
- **Catch the folder-open malware pattern**: hidden `.vscode/tasks.json` tasks with `runOn: folderOpen`, fake fonts/images that are scripts, malicious Git hooks, dangerous `.git/config`, submodule commands, and CI exfiltration patterns.
- **Problems panel integration**: every finding with a file and line becomes a diagnostic.
- **Git Triage sidebar**: findings grouped by severity, plus a scan summary.
- **Folder-open warning**: a modal warning when the workspace contains a hidden task that runs a script disguised as an asset.
- **Fix runbook**: a Markdown checklist for revoke → rotate → purge → verify.
- **History scan**: optionally scan every commit with `git log -p`.
- **Secret-safe output**: values are masked, deduped by SHA-256 fingerprint, and never sent anywhere.
- **CI-friendly core**: the same engine powers the `git-triage` CLI and `--ci` mode.

---

## Dashboard

The activity bar opens a single **Git Triage** dashboard, styled after Redis State Explorer. It has five tabs:

- **Overview** — current branch, ahead/behind, staged/unstaged/untracked counts, latest commit, remotes, quick actions, and triage summary.
- **Changes** — every changed file with status, stage/unstage/diff actions, bulk stage/unstage, and a commit box.
- **Branches** — local branches with upstream and subject, checkout, and create-and-switch.
- **History** — recent commits with author, relative time, and a commit view.
- **Triage** — severity cards, findings, scan/scan-history, and the fix runbook.
- **Commands** — a searchable Git command helper with syntax, examples, copy/run actions, and a **git console** that executes `git` commands in the workspace. Includes an **Open Git Bash** button for interactive commands.

The **Findings** tree remains available below the dashboard, and file/line findings are also published to the Problems panel.

---

## Install

Search for **Git Triage** in the Extensions view of VS Code, VSCodium, Cursor, or any Open VSX-based editor, or install from the command line:

```bash
code --install-extension ps-aditya.git-triage
```

For Open VSX editors:

```bash
cursor --install-extension ps-aditya.git-triage
```

---

## Commands

| Command | What it does |
|---|---|
| **Git Triage: Open Dashboard** | Focus the Git Triage dashboard. |
| **Git Triage: Refresh** | Refresh status, changes, branches, history, and remotes. |
| **Git Triage: Commit…** | Prompt for a message and commit staged changes. |
| **Git Triage: Fetch** | Fetch all remotes and prune. |
| **Git Triage: Pull** | Pull the current branch. |
| **Git Triage: Push** | Push the current branch. |
| **Git Triage: Checkout Branch…** | Pick a local branch to check out. |
| **Git Triage: Create Branch…** | Create and switch to a new branch. |
| **Git Triage: Initialize Repository** | Run `git init` in the workspace. |
| **Git Triage: Open Terminal** | Open a terminal at the workspace root. |
| **Git Triage: Open Git Bash** | Open Git Bash at the workspace root (falls back to the default shell). |
| **Git Triage: Scan Workspace** | Scan the working tree. |
| **Git Triage: Scan Workspace + History** | Scan the working tree and up to 500 commits. |
| **Git Triage: Show Fix Runbook** | Open the remediation checklist as Markdown. |
| **Git Triage: Open Settings** | Jump to the Git Triage settings. |
| **Git Triage: Show Output** | Show the redacted scan log. |
| **Git Triage: Reload in Restricted Mode** | Explain how to reload without trusting the workspace. |

The extension adds a **Git Triage** activity bar view with the **Dashboard** and **Findings** views.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitTriage.scanOnOpen` | `true` | Scan when the extension activates. |
| `gitTriage.history` | `false` | Include git history in automatic scans. |
| `gitTriage.maxCommits` | `500` | Maximum commits to scan when history is enabled. |
| `gitTriage.showProblems` | `true` | Publish findings to the Problems panel. |
| `gitTriage.warnOnFolderOpen` | `true` | Warn when a hidden folder-open task or fake asset is found. |
| `gitTriage.pollInterval` | `3000` | Dashboard refresh interval while visible, in milliseconds. |
| `gitTriage.logLimit` | `20` | Number of recent commits in the History tab. |
| `gitTriage.openDashboardOnStartup` | `false` | Focus the dashboard when the extension activates. |

---

## What it detects

### Credentials

- GitLab incoming-email tokens (`glimt-`) and full incoming addresses
- GitLab PATs (`glpat-`) and other GitLab tokens (`glrt-`, `glcbt-`, `glptt-`, `gldt-`, `glsoat-`, `glffct-`)
- GitHub fine-grained PATs and classic tokens
- AWS access key IDs
- npm tokens
- OpenAI and Anthropic API keys
- SSH private keys

### VS Code execution surface

- Hidden `folderOpen` tasks that run a shell command
- Hidden `folderOpen` tasks that run a script disguised as a font/image
- Any `folderOpen` task
- Fonts/images that contain JavaScript, shell, or Node.js code
- Fonts/images that are ZIP archives or text mismatches

### Git configuration and hooks

- Non-sample Git hooks, especially `post-checkout`, `post-merge`, `pre-commit`, `pre-push`
- `core.fsmonitor`, `core.sshCommand`, `core.editor`, `core.pager`
- `include.path` / `includeIf`
- `url.*.insteadOf`
- Credential helpers that start with `!`
- Submodule `update = !command`, `ext::` URLs, and `file://` URLs

### CI exfiltration patterns

- `curl … | bash`, `wget … | sh`
- Base64-decoded execution
- CI token names near network commands
- History greps for credentials
- `runs-on: self-hosted`, `pull_request_target`, `secrets: inherit`, `permissions: write-all`

---

## Safety and limitations

- **Local-first:** the extension reads workspace files and prints findings. It does not upload code or telemetry.
- **No code execution:** it does not run repository tasks, scripts, hooks, or tests.
- **Detector, not sandbox:** it cannot stop a task from running if you trust the workspace and ignore the warning.
- **Not automatic:** v0.1 finds and guides. It does not revoke credentials, rotate them, or rewrite history.
- **Pattern-based:** a new loader with a different file name or task label may evade detection.
- **Single root:** v0.1 scans the first workspace folder. Multi-root support is on the roadmap.
- **Workspace Trust:** the folder-open task only executes after the workspace is trusted. The extension warns, but it cannot change VS Code's trust model.
- **Restricted git console:** the Commands tab only runs `git` commands, one at a time. Shell pipes, redirects, chaining, and non-`git` programs are rejected. Interactive commands (`git add -p`, `git rebase -i`, `git mergetool`, a `git commit` without `-m`, …) are routed to **Open Git Bash**.
- **Destructive commands ask first:** hard resets, forced cleans, force-pushes, branch deletes, restores, stash drops, and history rewrites require a modal confirmation before they run.

If you open an untrusted repository, review the findings before clicking **Trust**. If you already trusted a malicious repo, treat the credentials on that machine as exposed and rotate them from a clean machine.

---

## Development

```bash
cd vscode-extension
npm install
npm run typecheck
npm run test:dashboard
npm run build
npm run package
```

The extension bundles the published `git-triage` scanner. The source lives in [`ps-aditya/git-triage`](https://github.com/ps-aditya/git-triage).

### Package and publish

```bash
npm run package
npx ovsx publish git-triage-vscode.vsix -p "$OVSX_PAT"
```

Create the `ps-aditya` publisher namespace and a personal access token at <https://open-vsx.org>. In GitHub Actions, add `OVSX_PAT` as a repository secret and run the **Publish Open VSX** workflow, or run the command above locally.

---

## Links

- **GitHub:** https://github.com/ps-aditya/git-triage
- **npm CLI:** https://www.npmjs.com/package/git-triage
- **Launch post:** https://github.com/ps-aditya/git-triage/blob/main/blog/2026-11-01-gitlab-patched-the-cve-your-token-is-still-valid.md
- **Teardown:** https://github.com/ps-aditya/git-triage/blob/main/docs/gitlab-glimt-teardown.md

---

## License

MIT. See [LICENSE](LICENSE).

Git Triage is an independent project. It is not affiliated with GitLab, GitHub, GitKraken, Microsoft, or VS Code. “GitLab,” “GitHub,” and “VS Code” are trademarks of their respective owners.
