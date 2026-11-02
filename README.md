# repo-trust

**Scan a repository for malicious folder-open tasks, fake assets, and leaked credentials before you open it.**

[![npm](https://img.shields.io/npm/v/repo-trust)](https://www.npmjs.com/package/repo-trust)
[![CI](https://github.com/yourname/repo-trust/actions/workflows/ci.yml/badge.svg)](https://github.com/yourname/repo-trust/actions)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

In October 2026, GhostAction/PolinRider pushed **72,026 commits** across **22,964 repositories**. **17,667** carried a fake font and a hidden `.vscode/tasks.json` task that ran a credential stealer when the folder was opened. GitHub's workflow hold did not apply — the payload ran on the developer's machine.

`repo-trust` checks for that pattern, plus the other places a repo can execute code or leak credentials.

```bash
npx repo-trust scan .
```

No account. No telemetry. No secrets leave your machine.

---

## What it catches

| Check | Example |
|---|---|
| **Hidden folder-open tasks** | `.vscode/tasks.json` with `"runOn": "folderOpen"` and `"hide": true` |
| **Fake assets** | a `.woff2`, `.ttf`, `.png`, or `.svg` that is actually a Node.js or shell script |
| **Git hooks** | non-sample `post-checkout`, `post-merge`, `pre-commit`, `pre-push` |
| **Dangerous git config** | `core.fsmonitor`, `core.sshCommand`, `include.path`, `url.*.insteadOf` |
| **Submodule commands** | `update = !command` or an `ext::` URL |
| **CI exfiltration** | `curl … \| bash`, base64 execution, history greps, self-hosted runners |
| **Leaked credentials** | GitLab `glimt-` / `glpat-`, GitHub PATs, AWS keys, npm tokens, AI keys, SSH keys |

## Why this matters

- **17,667 repos** carried the folder-open stealer in October 2026.
- Cleaning the repo does **not** remove the cron job the payload installs.
- **64%** of secrets leaked in 2022 were still valid in 2026 (GitGuardian).
- GitHub's workflow hold does **not** cover `.vscode/tasks.json`; the payload runs on the developer machine.

## Install

```bash
# one-off
npx repo-trust scan .

# or install it
npm install -g repo-trust
repo-trust scan .
```

Requires Node.js 20+.

## Usage

```bash
repo-trust scan [path] [options]
repo-trust fix [path]
repo-trust rules
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
repo-trust scan .

# scan the last 2,000 commits and emit JSON
repo-trust scan . --history --max-commits 2000 --json

# fail CI on any high or critical finding
repo-trust scan . --ci

# print a remediation plan
repo-trust fix .
```

## Example output

```
repo-trust 0.1.0 — scanning /path/to/repo

CRITICAL  task-folder-open-asset-script
  .vscode/tasks.json:16
  Hidden folder-open task runs a script disguised as an asset
  Task "eslint-check" runs on folder open and executes
  ./public/fonts/fa-solid-400.woff2, which is a script, not a valid font.

CRITICAL  gitlab-incoming-email-token
  README.md:16
  GitLab incoming email token
  Account-wide, non-expiring token hidden inside a GitLab issue-by-email address.

2 findings, 2 critical. Scanned 8 files in 0.1s.
Run `repo-trust fix` for a remediation plan.
```

## Safe demo

The [`demo-repo/`](https://github.com/yourname/repo-trust/tree/main/demo-repo) folder contains the same shape as the GhostAction attack with a **harmless** payload and fake credentials. Try it:

```bash
npx repo-trust scan demo-repo
```

See [`demo-repo/SAFETY.md`](https://github.com/yourname/repo-trust/blob/main/demo-repo/SAFETY.md).

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
| **repo-trust** | Yes | Yes | Guidance (v0.1) | Yes |
| gitleaks | No | Yes | No | Yes |
| TruffleHog | No | Yes | No | Yes |
| Leak Lock | No | Yes | History rewrite | Yes |
| GitGuardian | No | Yes | Platform workflow | Cloud |

## CI

```yaml
- name: repo-trust
  run: npx repo-trust scan . --ci
```

## Contributing

Issues and pull requests are welcome. If you find a false positive, include the file and the rule ID (redact any real secret).

- [Open an issue](https://github.com/yourname/repo-trust/issues)
- [Contributing guide](https://github.com/yourname/repo-trust/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/yourname/repo-trust/blob/main/SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).

---

If this saved you from a bad repo, **star the repo** — it helps other developers find it.
