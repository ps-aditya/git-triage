# Git Triage

**GitLab patched the CVE. Your leaked token is still valid.**

[![CI](https://github.com/ps-aditya/git-triage/actions/workflows/ci.yml/badge.svg)](https://github.com/ps-aditya/git-triage/actions)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

**Git Triage** is a free, local-first incident-triage tool for leaked GitLab credentials and malicious VS Code folder-open tasks. It finds the leak, shows the blast radius, and gives you a runbook for the fix: **revoke → rotate → purge → verify**.

```bash
npx git-triage scan .
```

No account. No telemetry. No secrets leave your machine.

> **Status:** v0.1. The scanner is usable today. The npm package is **not published yet** — use the source install below until it is. Automated revocation, history rewriting, and the VS Code extension are on the roadmap. Everything the tool finds is explained; nothing is changed automatically.

---

## Table of contents

- [Why Git Triage](#why-git-triage)
- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Demo](#demo)
- [Commands](#commands)
- [Options](#options)
- [Exit codes](#exit-codes)
- [What it detects](#what-it-detects)
- [Example output](#example-output)
- [How it works](#how-it-works)
- [The GitLab `glimt-` token](#the-gitlab-glimt--token)
- [The folder-open attack](#the-folder-open-attack)
- [CI usage](#ci-usage)
- [Security and privacy](#security-and-privacy)
- [What it does not do](#what-it-does-not-do)
- [Development](#development)
- [Publishing](#publishing)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)
- [References](#references)

---

## Why Git Triage

Between 10 September and 21 October 2026, GitLab shipped three CVSS 10.0 fixes and several 9.9s:

| CVE | What it is | Score |
|---|---|---:|
| CVE-2026-85706 | Path traversal in the repository commits API; unauthenticated file read | 10.0 |
| CVE-2026-97229 | Unauthenticated RCE via the CI/CD regex compiler | 10.0 |
| CVE-2026-110264 | Unauthenticated RCE; affects every version back to 7.0 | 10.0 |

CVE-2026-85706 let an unauthenticated attacker read `/etc/gitlab/gitlab-secrets.json`, which decrypts CI/CD variables, deploy keys, and integration tokens. It was exploited in the wild and added to CISA KEV. CVE-2026-97229 was also added to KEV. Censys found **86,231 exposed GitLab hosts**; ShadowServer found **~13,700 still vulnerable**.

Patching the server was necessary. It did not revoke a single credential that had already leaked.

That is the gap Git Triage is built for:

- GitGuardian's 2026 report found that **64% of secrets leaked in 2022 were still valid in January 2026**.
- GitLab's automatic token revocation is Ultimate-tier, limited to specific providers, and does not cover the incoming-email `glimt-` token.
- History rewrites do not revoke a working credential. Revocation has to come first.
- A stolen token becomes a malicious commit; the commit becomes a developer laptop.

Git Triage is the first step: **find the credential, understand what it can reach, and get a concrete fix plan.**

Read the full write-up: [GitLab patched the CVE. Your leaked token is still valid.](blog/2026-11-01-gitlab-patched-the-cve-your-token-is-still-valid.md)  
Read the technical teardown: [GitLab `glimt-` incoming-email token](docs/gitlab-glimt-teardown.md).

---

## What it does

- **Finds leaked GitLab credentials** in the working tree and, with `--history`, in every commit: `glimt-` incoming-email tokens, `glpat-` PATs, and other GitLab token prefixes.
- **Finds other leaked credentials**: GitHub PATs, AWS access keys, npm tokens, OpenAI/Anthropic keys, SSH private keys.
- **Finds the 2026 folder-open malware pattern**: hidden `.vscode/tasks.json` tasks with `runOn: folderOpen`, fake fonts/images that are scripts, malicious Git hooks, dangerous `.git/config` keys, submodule commands, and CI exfiltration patterns.
- **Explains the blast radius** in plain English: what the credential can reach, why it matters, and what to do next.
- **Produces a runbook**: `git-triage fix` prints the contain → revoke → rotate → purge → verify steps.
- **Masks every secret** in output. Raw values are never written to logs, JSON, or reports.
- **Runs locally**: no account, no telemetry, no network calls.

---

## Quick start

Requires **Node.js 20 or newer**.

### From source (npm publish pending)

```bash
git clone https://github.com/ps-aditya/git-triage.git
cd git-triage
npm install
npm run build

# scan the current directory
node dist/cli.js scan .

# scan a specific repository
node dist/cli.js scan /path/to/repo

# scan the working tree and the last 2,000 commits
node dist/cli.js scan . --history --max-commits 2000

# print the remediation runbook
node dist/cli.js fix .

# list every detection rule
node dist/cli.js rules
```

### Once published to npm

```bash
# one-off scan
npx git-triage scan .

# or install it globally
npm install -g git-triage
git-triage scan .
```

The same commands are used in both cases. The binary is `git-triage`; the npm package is `git-triage`; the product is **Git Triage**.

---

## Demo

The [`demo-repo/`](demo-repo) folder is a safe, intentionally suspicious repository. It contains:

- a fake `glimt-` token in `README.md`;
- a fake font that is actually a harmless Node.js script;
- a hidden folder-open task, shipped as `.vscode/tasks.json.example`;
- a CI workflow with a `curl | bash` string inside an `echo` (not executed).

The task ships as `.example` so antivirus does not quarantine it and VS Code does not run it by accident.

```powershell
cd demo-repo
pwsh ./enable-demo.ps1
cd ..
node dist/cli.js scan demo-repo
```

Once the npm package is published, `npx git-triage scan demo-repo` is equivalent.

Expected highlights:

```text
CRITICAL  gitlab-incoming-email-token
  README.md:16
  Account-wide, non-expiring token hidden inside a GitLab issue-by-email address.

CRITICAL  task-folder-open-asset-script
  .vscode/tasks.json:16
  Hidden folder-open task runs a script disguised as an asset.

CRITICAL  asset-is-script
  public/fonts/fa-solid-400.woff2:1
  Asset is actually a script.
```

Disable the demo task when you are done:

```powershell
cd demo-repo
pwsh ./disable-demo.ps1
```

See [`demo-repo/SAFETY.md`](demo-repo/SAFETY.md) for the safety notes. The payload is harmless and the tokens are fake.

---

## Commands

| Command | What it does |
|---|---|
| `git-triage scan [path]` | Scan a repository. Defaults to the current directory. |
| `git-triage fix [path]` | Scan and print a remediation runbook. Does not change anything. |
| `git-triage rules` | List the secret rules and other checks. |
| `git-triage --version` | Print the version. |
| `git-triage --help` | Print usage. |

---

## Options

| Option | Description |
|---|---|
| `--json` | Emit machine-readable JSON. Raw secrets are still masked. |
| `--history` | Scan git history. Slower; use `--max-commits` to bound it. |
| `--max-commits <n>` | Limit the history scan. Default: `500`. |
| `--ci` | Exit `1` if any high or critical finding is present. |
| `--fail-on <severity>` | Exit `1` at or above `critical`, `high`, `medium`, or `low`. |
| `--no-color` | Disable ANSI colors. |
| `-h`, `--help` | Show help. |
| `-v`, `--version` | Show the version. |

Examples:

```bash
# JSON for a dashboard or a script
git-triage scan . --json

# Fail CI on any high or critical finding
git-triage scan . --ci

# Fail only on critical findings
git-triage scan . --fail-on critical

# Scan the last 10,000 commits
git-triage scan . --history --max-commits 10000

# Scan a repo with spaces in the path
git-triage scan "C:\Users\me\My Repo"
```

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Scan completed and no finding met the failure threshold. |
| `1` | Scan completed and a finding met the threshold (`--ci` or `--fail-on`). |
| `2` | The scanner could not run (bad path, bad option, unexpected error). |

Without `--ci` or `--fail-on`, findings do not change the exit code.

---

## What it detects

### Leaked credentials

| Rule ID | Severity | What it matches |
|---|---|---|
| `gitlab-incoming-email-token` | critical | `glimt-…` tokens, including those embedded in `incoming+…@incoming.gitlab.com` |
| `gitlab-incoming-email-address` | critical | Full GitLab issue/merge-request email addresses |
| `gitlab-pat` | critical | `glpat-…` personal access tokens |
| `gitlab-token` | critical | `glrt-`, `glcbt-`, `glptt-`, `gldt-`, `glsoat-`, `glffct-` tokens |
| `github-fine-grained-pat` | critical | `github_pat_…` |
| `github-pat` | critical | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` tokens |
| `aws-access-key` | critical | `AKIA…` / `ASIA…` access key IDs |
| `npm-token` | high | `npm_…` registry tokens |
| `anthropic-key` | high | `sk-ant-…` |
| `openai-key` | high | `sk-…` / `sk-proj-…` |
| `ssh-private-key` | critical | `-----BEGIN … PRIVATE KEY-----` |

### VS Code execution surface

| Rule ID | Severity | What it matches |
|---|---|---|
| `task-folder-open-asset-script` | critical | A hidden `folderOpen` task that runs a file with a font/image extension which is actually a script |
| `task-folder-open-hidden` | critical | A hidden `folderOpen` task that runs a shell command |
| `task-folder-open-command` | high | A `folderOpen` task that runs a shell command |
| `task-folder-open` | medium | Any `folderOpen` task |
| `task-hidden-command` | medium | A hidden task that runs a shell command |
| `tasks-json-parse` | low | `.vscode/tasks.json` that cannot be parsed |
| `asset-is-script` | critical | A font/image file that contains JavaScript, shell, or Node.js code |
| `asset-is-archive` | high | A font/image file that is actually a ZIP archive |
| `asset-mismatch` | medium | A font/image file that is text, not a valid asset |

### Git configuration and hooks

| Rule ID | Severity | What it matches |
|---|---|---|
| `git-hook` | high/medium | Non-sample Git hooks, especially `post-checkout`, `post-merge`, `pre-commit`, `pre-push` |
| `git-config-fsmonitor` | high | `core.fsmonitor` — can execute a command on file-system events |
| `git-config-sshcommand` | high | `core.sshCommand` — can execute an arbitrary command |
| `git-config-path` | high | `include.path` / `includeIf` — can load attacker-controlled config |
| `git-config-helper` | high | A credential helper that starts with `!` (shell command) |
| `git-config-editor` | medium | `core.editor` |
| `git-config-pager` | medium | `core.pager` |
| `git-config-proxy` | medium | `http.proxy` |
| `git-config-insteadof` | medium | `url.*.insteadOf` — can redirect Git traffic |
| `gitmodule-command` | critical | A submodule `update` strategy that starts with `!` |
| `gitmodule-ext-transport` | critical | A submodule URL using `ext::` |
| `gitmodule-file-url` | medium | A submodule URL using `file://` |

### CI exfiltration patterns

| Rule ID | Severity | What it matches |
|---|---|---|
| `ci-token-exfil` | critical | A CI token name near a network command on the same line |
| `ci-curl-pipe-shell` | high | `curl … \| bash` / `wget … \| sh` |
| `ci-base64-exec` | high | Base64-decoded code piped to a shell |
| `ci-history-grep` | high | A CI job that greps the working tree/history for credentials |
| `ci-self-hosted` | medium | `runs-on: self-hosted` |
| `ci-pull-request-target` | medium | `pull_request_target` |
| `ci-secrets-inherit` | medium | `secrets: inherit` |
| `ci-write-all` | medium | `permissions: write-all` |

> Detections are pattern-based. They are designed to be explainable, not exhaustive. A new loader with a different file name or task label may evade them. See [What it does not do](#what-it-does-not-do).

---

## Example output

### Human-readable

```text
git-triage 0.1.0 — scanning /path/to/repo

CRITICAL  gitlab-incoming-email-token
  README.md:42
  GitLab incoming email token
  Account-wide, non-expiring token hidden inside a GitLab issue-by-email address.
  evidence: GitLab incoming email token: glimt-…7f3a
  fix: Reset it at GitLab → User settings → Personal access tokens → Incoming email token.

CRITICAL  task-folder-open-asset-script
  .vscode/tasks.json:16
  Hidden folder-open task runs a script disguised as an asset
  Task "eslint-check" runs on folder open and executes
  ./public/fonts/fa-solid-400.woff2, which is a script, not a valid font.
  evidence: label="eslint-check" runOn="folderOpen" hide=true command="node …"
  fix: Do not trust this workspace. Open it in Restricted Mode and remove the task.

2 findings, 2 critical, 0 high, 0 medium, 0 low.
Scanned 8 files (history not scanned; use --history) in 0.1s.
Run `git-triage fix` for a remediation plan.
```

### JSON

```json
{
  "tool": "git-triage",
  "version": "0.1.0",
  "root": "/path/to/repo",
  "findings": [
    {
      "ruleId": "gitlab-incoming-email-token",
      "category": "secret",
      "severity": "critical",
      "title": "GitLab incoming email token",
      "message": "Account-wide, non-expiring token hidden inside a GitLab issue-by-email address. Found in the working tree.",
      "file": "README.md",
      "line": 42,
      "evidence": "GitLab incoming email token: glimt-…7f3a",
      "remediation": "Reset it at GitLab → User settings → Personal access tokens → Incoming email token…",
      "fingerprint": "gitlab-incoming-email-token:<sha256>:README.md"
    }
  ],
  "scanned": {
    "files": 8,
    "commits": 0,
    "skipped": 0,
    "truncated": false
  },
  "durationMs": 104
}
```

Raw secret values never appear in JSON. Evidence lines are redacted, and the fingerprint is a SHA-256 hash.

---

## How it works

```text
CLI
 │
 ├─ walkFiles() ── skips .git, node_modules, dist, build, vendor, binaries, large files
 │
 ├─ checkTasks() ── parses .vscode/tasks.json (JSONC), flags folderOpen/hidden tasks
 ├─ checkAssets() ── checks font/image magic bytes, flags scripts/ZIPs/text
 ├─ checkGit() ───── hooks, .git/config, .gitmodules
 ├─ checkCi() ────── .github/workflows/*.yml, .gitlab-ci.yml
 └─ checkSecrets() ─ regex rules over the working tree (+ git history)
 │
 ├─ dedupe + sort by severity
 └─ report (pretty, JSON, or fix runbook)
```

### 1. File walking

The scanner walks the repository once and skips:

- `.git`, `node_modules`, `dist`, `build`, `out`, `.next`, `.nuxt`, `coverage`, `vendor`, `target`, `.venv`, `venv`, `__pycache__`, `.idea`, `.cache`;
- symlinks;
- files larger than the text-scan limit (1 MB for secrets, 2 MB for `.vscode/tasks.json`, 512 KB for Git config and hooks).

It stops after 50,000 files and marks the scan as truncated.

### 2. Task parsing

`.vscode/tasks.json` is JSONC, so the scanner strips comments and trailing commas before parsing. It then evaluates each task:

- `runOptions.runOn === "folderOpen"` → the task runs when the folder opens;
- `hide: true` or `presentation.reveal: "never"` → the task is hidden;
- a shell command that invokes `node`, `curl`, `powershell`, `bash`, `python`, etc.;
- a reference to a file with a font/image extension that is actually a script.

The highest-severity condition produces the finding, so one task does not generate five duplicates.

### 3. Asset inspection

For every `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`, `.png`, `.jpg`, `.gif`, `.svg`, `.ico`, `.webp`, or `.bmp`:

- read the first 8 KB;
- compare the magic bytes to the expected format;
- if the file is text and contains script indicators (`#!`, `require(`, `import`, `child_process`, `fetch(`, `eval(`, etc.), flag it as a script;
- if it is a ZIP, flag it;
- if it is text but not a script, flag a mismatch.

### 4. Git checks

- Hooks: every non-`.sample` file in `.git/hooks` is reported; `post-checkout`, `post-merge`, `pre-commit`, `pre-push`, etc. are high severity.
- Config: `core.fsmonitor`, `core.sshCommand`, `core.editor`, `core.pager`, `include.path`, `http.proxy`, `url.*.insteadOf`, and `!` credential helpers.
- Submodules: `update = !command`, `ext::` URLs, and `file://` URLs.
- Worktrees: `.git` can be a file (`gitdir: …`); the scanner resolves the common dir for config and hooks.

### 5. CI checks

It reads `.github/workflows/*.yml|yaml`, `.gitlab-ci.yml`, and `.gitlab-ci.yaml`, then flags:

- remote scripts piped to a shell;
- base64-decoded execution;
- CI token names near network commands;
- history greps for credentials;
- self-hosted runners, `pull_request_target`, `secrets: inherit`, `permissions: write-all`.

### 6. Secret scanning

The working-tree scan reads text files and applies the rules in [`src/rules.ts`](src/rules.ts). The history scan runs:

```bash
git log -p --all --max-count=<n> --no-color --no-ext-diff --unified=0
```

It parses `commit`, `+++ b/<path>`, and added/removed lines. Findings are deduped by `rule + SHA-256(secret) + file`. The history scan stops at 100 MB of output and marks the result as truncated.

### 7. Redaction

- `maskSecret()` keeps the prefix and the last four characters: `glimt-…7f3a`, `AKIA…9Q2X`.
- `sha256()` creates a stable fingerprint for dedupe without storing the secret.
- `redactSecrets()` masks every known pattern in evidence lines.
- Raw secrets are never written to JSON, logs, reports, or telemetry.

### 8. Failure isolation

Each check is wrapped so one failure does not hide the others. If a check throws, the scan continues and the other findings are still reported.

---

## The GitLab `glimt-` token

GitLab gives every user an address for filing work items by email:

```text
incoming+<project-path>-<project-id>-glimt-<token>-issue@incoming.gitlab.com
```

It looks like an email address. It is an account-wide, non-expiring credential.

- The same `glimt-` token is used in every project.
- GitLab does not verify the sender.
- The address can create issues and merge requests, push code, run CI/CD jobs, read CI variables, and reach private projects.
- It bypasses IP allow-lists and 2FA because it arrives by email.
- The only fix is a manual reset: **User settings → Personal access tokens → Incoming email token → Reset**.

GitLab's automatic revocation does not cover this token. A reset invalidates every project address for the account.

Full technical teardown: [`docs/gitlab-glimt-teardown.md`](docs/gitlab-glimt-teardown.md).

---

## The folder-open attack

In October 2026, GhostAction/PolinRider pushed **72,026 commits** across **22,964 repositories** in nine days. **17,667** carried:

- `.vscode/tasks.json` with a hidden task named `eslint-check` and `"runOn": "folderOpen"`;
- `public/fonts/fa-solid-400.woff2` — a Node.js credential stealer.

When a developer opened the repo and trusted the workspace, the task ran the "font." It read AWS credentials, npm tokens, `.git-credentials`, SSH keys, Claude/Gemini credentials, and Kubernetes config, posted them to a C2, and installed a cron job that survived cleanup.

GitHub's workflow hold did not apply. No Actions workflow was involved. The payload ran on the developer's machine.

Git Triage flags the task, the fake asset, the hooks, the config, and the CI patterns before you trust the workspace.

Read the second act: [A repo can run a credential stealer when you open it in VS Code.](blog/2026-11-01-repo-can-run-code-when-you-open-it.md)

---

## CI usage

### GitHub Actions

```yaml
name: Git Triage

on:
  push:
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # needed for --history
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx git-triage scan . --history --ci
```

### GitLab CI

```yaml
stages:
  - security

git-triage:
  stage: security
  image: node:20
  variables:
    GIT_DEPTH: "0" # needed for --history
  script:
    - npx git-triage scan . --history --ci
```

### Pre-commit hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx git-triage scan . --fail-on critical
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

> The scanner is a detector, not a sandbox. It makes the dangerous parts visible; it does not stop a task from running if you ignore the warning and trust the workspace.

---

## Security and privacy

- **Local-first:** the scanner reads files in the repository and prints findings. It does not upload code, secrets, or telemetry.
- **No account:** there is no signup, API key, or cloud service.
- **No network calls:** the scanner does not make HTTP requests.
- **Secret masking:** every finding is masked; raw values are never stored.
- **Fingerprints:** dedupe uses SHA-256 hashes, not raw secrets.
- **Read-only:** `scan` and `fix` do not modify the repository. `fix` prints a runbook.
- **No code execution:** the scanner does not run repository tasks, scripts, hooks, or tests.
- **Dependency-light:** the published package has no runtime dependencies.

### If you scan an untrusted repository

The scanner reads files, so treat it like any other parser. For a hostile repo, run it in a container or VM:

```bash
docker run --rm -v "$PWD:/repo" -w /repo node:20 npx git-triage scan .
```

Do not open the repo in VS Code with Workspace Trust until you have reviewed the findings.

---

## What it does not do

- **It does not patch GitLab.** GitLab server CVEs are GitLab's responsibility. Git Triage fixes the credential-leak layer.
- **It does not revoke credentials.** Revocation needs provider-specific scopes and a human decision. `fix` prints the steps and links.
- **It does not rewrite git history.** History rewriting is destructive and must happen after revocation. The runbook covers the commands; the tool does not run them.
- **It does not guarantee a repository is safe.** It catches known patterns. A new loader, a different file name, or a different task label may evade it.
- **It is not a sandbox.** It cannot stop VS Code from running a task if you trust the workspace.
- **It does not scan binary secrets.** It focuses on text files and asset magic bytes.
- **It does not verify tokens against providers.** There is no API call to GitLab, GitHub, AWS, or npm in v0.1.

---

## Development

```bash
git clone https://github.com/ps-aditya/git-triage.git
cd git-triage
npm install

# run the CLI from source
npm run dev -- scan demo-repo

# typecheck
npm run typecheck

# build
npm run build

# test (builds first)
npm test
```

### Project structure

```text
src/
  cli.ts            argument parsing, commands, exit codes
  scanner.ts        orchestrates checks, dedupes, sorts
  report.ts         pretty output, JSON, fix runbook, rules
  rules.ts          secret rules, CI patterns, config keys
  redact.ts         secret masking for evidence
  util.ts           file walking, JSONC, INI, git dir resolution
  types.ts          Finding, ScanOptions, ScanResult
  checks/
    tasks.ts        .vscode/tasks.json
    assets.ts       font/image magic bytes and script content
    git.ts          hooks, .git/config, .gitmodules
    ci.ts           GitHub Actions and GitLab CI
    secrets.ts      working tree + git history
tests/
  scanner.test.mjs  node:test fixtures
demo-repo/          safe demo with a fake token and harmless payload
docs/               technical teardown
blog/               launch posts
research/           product, distribution, and spec notes
```

### Adding a secret rule

1. Add a `SecretRule` to `SECRET_RULES` in [`src/rules.ts`](src/rules.ts).
2. Include a stable `id`, severity, regex, description, and remediation.
3. Add a test fixture in [`tests/scanner.test.mjs`](tests/scanner.test.mjs).
4. Run `npm test`.

### Adding a check

1. Create `src/checks/<name>.ts` that returns `Finding[]`.
2. Wire it into `scan()` in [`src/scanner.ts`](src/scanner.ts).
3. Add a fixture and a test.
4. Run `npm run typecheck` and `npm test`.

### Conventions

- Never include a raw secret in a `Finding`.
- Use `redactSecrets()` for evidence lines.
- Use `compareFindings()` for sorting.
- Keep checks independent and failure-isolated.
- Prefer false negatives over noisy false positives, but explain every finding.

---

## Publishing

```bash
# check what will be published
npm pack --dry-run

# build happens automatically via prepublishOnly
npm publish --access public
```

The package contains only `dist/`, `README.md`, `LICENSE`, and `package.json`. The demo, docs, blog, and research folders stay in the repository and are not published to npm.

Before publishing a new version:

1. Update `src/version.ts` and `package.json` together.
2. Run `npm test`.
3. Run `npm pack --dry-run` and inspect the file list.
4. Publish.
5. Tag the release: `git tag v0.1.0 && git push --tags`.

---

## Roadmap

### v0.2 — VS Code extension

- Warn before a folder-open task runs.
- Quarantine fake assets.
- Show findings in the Problems panel.
- “Open in Restricted Mode” action.
- One-click `fix` runbook.

### v0.3 — Fix workflow

- Provider-aware revocation (GitLab PATs, GitHub PATs, AWS keys, npm tokens).
- Rotation checklist.
- Safe history rewrite with a checkpoint, dry run, atomic force-push, and verification.
- Incident report export.

### v0.4 — Team and CI

- SARIF output.
- GitHub Action and GitLab CI component.
- Config file (`.git-triage.yml`).
- Custom rules and ignores.
- Self-managed GitLab support.

### Later

- Multi-repo dashboard.
- Team audit trail and approvals.
- More providers (GCP, Azure, Stripe, Slack, PyPI, Docker Hub, Hugging Face).
- Signed rule-pack updates.

---

## FAQ

**Does Git Triage patch GitLab?**  
No. It fixes the credential-leak layer that patching leaves behind. GitLab server CVEs are GitLab's responsibility.

**Does it send my code or secrets anywhere?**  
No. It runs locally, makes no network calls, and has no telemetry. Findings are masked.

**Does it revoke tokens?**  
Not in v0.1. `git-triage fix` prints a provider-specific runbook. Automated revocation is on the roadmap.

**Does it rewrite history?**  
Not in v0.1. The runbook covers `git filter-repo`, force-pushing, and verification. History rewriting must happen after revocation.

**Why is the demo task an `.example` file?**  
So antivirus does not quarantine it and VS Code does not run it by accident. Run `enable-demo.ps1` to activate it for the demo, then `disable-demo.ps1`.

**Does it work on private repositories?**  
Yes. It reads the local working tree and, with `--history`, the local git history. No remote access is needed.

**Does it scan binary files?**  
It checks the magic bytes of font/image assets. It skips binary files for text/secret scanning.

**Why does `--history` take so long?**  
It runs `git log -p --all` and scans every added/removed line. Use `--max-commits` to bound it. The scan stops at 100 MB of diff output.

**Can I use it in CI?**  
Yes. Use `--ci` to fail on high/critical findings. For history scanning, fetch the full history (`fetch-depth: 0` in GitHub Actions, `GIT_DEPTH: 0` in GitLab CI).

**Is it safe to run on a malicious repository?**  
It does not execute repository code. It only reads files. For a hostile repo, run it in a container or VM as an extra precaution.

**What is the `glimt-` token?**  
An account-wide, non-expiring GitLab credential hidden inside an issue-by-email address. See [the teardown](docs/gitlab-glimt-teardown.md).

---

## Contributing

Issues and pull requests are welcome. If you find a false positive, include:

- the rule ID;
- the file and line;
- a redacted snippet;
- why the behavior is legitimate.

Do not paste real credentials. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

---

## License

MIT. See [LICENSE](LICENSE).

---

## References

### GitLab

- GitLab 19.5.1 patch release: <https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-5-1-released/>
- GitLab 19.3.2 patch release (CVE-2026-85706): <https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-3-2-released/>
- GitLab 19.4.2 patch release (CVE-2026-97229): <https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-4-2-released/>
- GitLab secret detection automatic response: <https://docs.gitlab.com/user/application_security/secret_detection/automatic_response/>
- GitLab incoming email documentation: <https://docs.gitlab.com/administration/incoming_email/>

### Research and reporting

- Rapid7, CVE-2026-85706: <https://www.rapid7.com/blog/post/etr-cve-2026-85706-critical-gitlab-path-traversal-exploited-in-the-wild/>
- Rapid7, CVE-2026-97229: <https://www.rapid7.com/blog/post/etr-cve-2026-97229-critical-unauthenticated-remote-code-execution-in-gitlab/>
- Aikido, "Send GitLab an email, push to main": <https://www.aikido.dev/blog/gitlab-email-push-to-main>
- GitGuardian, Red Hat GitLab breach: <https://blog.gitguardian.com/red-hat-gitlab-breach-the-crimson-collectives-attack/>
- GitGuardian, State of Secrets Sprawl 2026: <https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/>
- GitGuardian, GhostAction x PolinRider: <https://blog.gitguardian.com/ghostaction-x-polinrider/>
- Cybernews, exposed GitLab servers: <https://cybernews.com/security/gitlab-attackers-find-thousands-exposed-servers/>
- VS Code 1.141.1 security release: <https://code.visualstudio.com/updates/v1_141>

---

## Disclaimer

Git Triage is an independent open-source project. It is not affiliated with GitLab, GitHub, GitKraken, Microsoft, or VS Code. “GitLab,” “GitHub,” and “VS Code” are trademarks of their respective owners.

The scanner is a detector, not a guarantee. Always review findings, revoke credentials first, and test any history rewrite on a backup.
