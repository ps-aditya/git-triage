# Git Triage

**GitLab patched the CVE. Your leaked token is still valid.**

[![npm](https://img.shields.io/npm/v/git-triage)](https://www.npmjs.com/package/git-triage)
[![CI](https://github.com/yourname/git-triage/actions/workflows/ci.yml/badge.svg)](https://github.com/yourname/git-triage/actions)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Git Triage** finds leaked GitLab tokens (`glimt-`, `glpat-`), shows the blast radius, and gives you a runbook for the fix: **revoke → rotate → purge → verify**. It also catches the hidden VS Code folder-open tasks that spread after a token is stolen. v0.1 detects and guides; automated revocation and history rewrite are next.

In October 2026, GhostAction/PolinRider pushed **72,026 commits** across **22,964 repositories**. **17,667** carried a fake font and a hidden `.vscode/tasks.json` task that ran a credential stealer when the folder was opened. GitHub's workflow hold did not apply — the payload ran on the developer's machine.

```bash
npx git-triage scan .
```

No account. No telemetry. No secrets leave your machine.

---

## Why GitLab leaks need a second step

Patching GitLab was necessary. It did not revoke the credentials that already leaked.

- **CVE-2026-85706** (CVSS 10.0) let an unauthenticated attacker read `/etc/gitlab/gitlab-secrets.json`, which decrypts CI/CD variables, deploy keys, and integration tokens. It was exploited in the wild and added to CISA KEV.
- **CVE-2026-97229** (CVSS 10.0) was an unauthenticated RCE in the CI/CD regex compiler. Also in KEV.
- **CVE-2026-110264** (CVSS 10.0) affected every GitLab version back to 7.0.
- GitLab's `glimt-` incoming-email token is **account-wide**, **never expires**, can **push code and run CI**, and **bypasses IP allow-lists and 2FA**. GitLab's automatic revocation does not cover it; the only fix is a manual reset.
- **64%** of secrets leaked in 2022 were still valid in 2026 (GitGuardian).

The patch is the first step. Revocation is the fix. History cleanup is the cleanup.

- Full teardown: [`docs/gitlab-glimt-teardown.md`](https://github.com/yourname/git-triage/blob/main/docs/gitlab-glimt-teardown.md)
- Launch post: [GitLab patched the CVE. Your leaked token is still valid.](https://github.com/yourname/git-triage/blob/main/blog/2026-11-01-gitlab-patched-the-cve-your-token-is-still-valid.md)

---

## What it catches

| Check | Example |
|---|---|
| **Leaked GitLab credentials** | `glimt-` incoming-email tokens, `glpat-`, `glrt-`, `glcbt-`, `glptt-` |
| **Other leaked credentials** | GitHub PATs, AWS keys, npm tokens, OpenAI/Anthropic keys, SSH keys |
| **Hidden folder-open tasks** | `.vscode/tasks.json` with `"runOn": "folderOpen"` and `"hide": true` |
| **Fake assets** | a `.woff2`, `.ttf`, `.png`, or `.svg` that is actually a Node.js or shell script |
| **Git hooks** | non-sample `post-checkout`, `post-merge`, `pre-commit`, `pre-push` |
| **Dangerous git config** | `core.fsmonitor`, `core.sshCommand`, `include.path`, `url.*.insteadOf` |
| **Submodule commands** | `update = !command` or an `ext::` URL |
| **CI exfiltration** | `curl … \| bash`, base64 execution, history greps, self-hosted runners |

## The second act: the repo that owns your laptop

- **17,667 repos** carried the folder-open stealer in October 2026.
- Cleaning the repo does **not** remove the cron job the payload installs.
- GitHub's workflow hold does **not** cover `.vscode/tasks.json`; the payload runs on the developer machine.
- The task runs after Workspace Trust; the scanner warns before you click Trust.

## Install

```bash
# one-off
npx git-triage scan .

# or install it
npm install -g git-triage
git-triage scan .
```

Requires Node.js 20+.

## Usage

```bash
git-triage scan [path] [options]
git-triage fix [path]
git-triage rules
```

### Options

| Option | Description |
|---|---|
| `--json` | Machine-readable output |
| `--history` | Scan git history (slower) |
| `--max-commits <n>` | Limit the history scan (default: 500) |
| `--ci` | Exit 1 if high or critical findings are present |
| `--fail-on <severity>` | Exit 1 at or above `critical`, `high`, `medium`, or `low` |
| `--no-color` | Disable ANSI colors |

### Examples

```bash
# scan the current repo
git-triage scan .

# scan the last 2,000 commits and emit JSON
git-triage scan . --history --max-commits 2000 --json

# fail CI on any high or critical finding
git-triage scan . --ci

# print a remediation plan
git-triage fix .
```

## Example output

```
git-triage 0.1.0 — scanning /path/to/repo

CRITICAL  gitlab-incoming-email-token
  README.md:16
  GitLab incoming email token
  Account-wide, non-expiring token hidden inside a GitLab issue-by-email address.

CRITICAL  task-folder-open-asset-script
  .vscode/tasks.json:16
  Hidden folder-open task runs a script disguised as an asset
  Task "eslint-check" runs on folder open and executes
  ./public/fonts/fa-solid-400.woff2, which is a script, not a valid font.

2 findings, 2 critical. Scanned 8 files in 0.1s.
Run `git-triage fix` for a remediation plan.
```

## Safe demo

The [`demo-repo/`](https://github.com/yourname/git-triage/tree/main/demo-repo) folder contains the same shape as the GhostAction attack with a **harmless** payload and fake credentials. The task ships as `.vscode/tasks.json.example` so antivirus does not quarantine it. Enable it first:

```powershell
cd demo-repo
pwsh ./enable-demo.ps1
cd ..
npx git-triage scan demo-repo
```

Disable it when you are done:

```powershell
cd demo-repo
pwsh ./disable-demo.ps1
```

See [`demo-repo/SAFETY.md`](https://github.com/yourname/git-triage/blob/main/demo-repo/SAFETY.md).

## How it works

- Local-first: reads the repository, parses files, prints findings.
- No account, no telemetry, no network calls.
- Secrets are masked in output and never stored.
- The scanner is a detector, not a sandbox. It warns; you decide.

## What it does not do

- It does not revoke credentials.
- It does not rewrite git history.
- It does not guarantee a repo is safe.
- It only catches known patterns; new loaders may evade it.

The full remediation workflow (revoke → rotate → purge → verify → report) is the next version.

## Comparison

| Tool | Detects folder-open malware | Detects secrets | Fixes / rewrites | Local-first |
|---|---|---|---|---|
| **Git Triage** | Yes | Yes | Guidance (v0.1) | Yes |
| gitleaks | No | Yes | No | Yes |
| TruffleHog | No | Yes | No | Yes |
| Leak Lock | No | Yes | History rewrite | Yes |
| GitGuardian | No | Yes | Platform workflow | Cloud |

## CI

```yaml
- name: git-triage
  run: npx git-triage scan . --ci
```

## Contributing

Issues and pull requests are welcome. If you find a false positive, include the file and the rule ID (redact any real secret).

- [Open an issue](https://github.com/yourname/git-triage/issues)
- [Contributing guide](https://github.com/yourname/git-triage/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/yourname/git-triage/blob/main/SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).

---

If this saved you from a bad repo, **star the repo** — it helps other developers find it.
