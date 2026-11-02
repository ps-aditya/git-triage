# Launch Copy — Ready to Use

> **Main launch:** use §11 (the GitLab-led angle). §1 is the second act (the folder-open payload). Do not lead with §1; lead with "GitLab patched the CVE. Your leaked token is still valid."

Replace `[BRACKETS]` with real values. Do not invent numbers. If a number is unknown, remove it rather than guess.

---

## 1. Hacker News

### Title options (pick one)

1. `A repo can run a credential stealer when you open it in VS Code`
2. `We found 17,000 repos that run code when you open them in VS Code`
3. `The fake font that steals your AWS keys when you open a repo`
4. `VS Code's Workspace Trust is not enough: the folder-open malware wave`

### First comment (post immediately after submitting)

```
Author here. I built this because the payload doesn't run in CI — it runs on
the developer's machine, from .vscode/tasks.json, after the workspace is
trusted. GitHub's workflow hold doesn't cover it.

What we found: GhostAction/PolinRider pushed 72,026 commits across 22,964
repos in October; 17,667 carried a fake font plus a hidden folder-open task.
The stealer reads ~/.aws/credentials, .npmrc, .git-credentials, ~/.claude,
~/.gemini, .kube/config, SSH keys, and posts them to a C2. It also installs
a cron job that survives repo cleanup.

How the scanner works: it parses .vscode/tasks.json, flags runOn:folderOpen
and hidden tasks, checks "fonts" for script content, inspects hooks and
.git/config, and scans the working tree/history for leaked tokens. Local-first,
no telemetry.

Limitations: Workspace Trust must be granted for the task to run; we only
catch known patterns; false positives are possible; this is a detector, not a
sandbox. The demo repo uses a harmless fake payload.

Demo repo (safe): [LINK]
Scanner: [LINK]
Happy to answer questions about the detection rules or the incident response.
```

### Rules

- Do not ask for upvotes.
- Do not use vote rings or bots.
- Respond to every substantive comment for the first 3 hours.
- If it doesn't hit the front page in 60–90 minutes, let it go; try a different angle in 2–4 weeks.

---

## 2. Product Hunt

### Tagline

`Stop a repo from stealing your credentials.`

### Short description

`Git Triage scans a repository before you open it — hidden folder-open tasks, fake fonts that are scripts, malicious hooks, dangerous git config, and leaked tokens. Free, local-first, no telemetry.`

### Gallery (5–7 images)

1. **The attack:** diff showing `.vscode/tasks.json` with `"runOn": "folderOpen"` and `"hide": true`, plus `public/fonts/fa-solid-400.woff2` that is actually JS.
2. **The warning:** VS Code notification: "This repo contains a hidden task that runs when the folder opens."
3. **The scan:** CLI output with CRITICAL/HIGH findings, masked secrets.
4. **The fix:** the remediation plan (revoke → rotate → purge → verify).
5. **The proof:** incident report with timeline and residual risk.
6. **The claim:** "17,667 repos carried this payload in October 2026" with source.
7. **The CTA:** `npx git-triage scan .` + GitHub link.

### Maker's first comment

```
Hi Product Hunt! I built Git Triage after seeing how the GhostAction/PolinRider
campaign worked: a repo ships a fake font and a hidden VS Code task, and when
you open the folder, it reads your cloud keys, npm tokens, SSH keys, and AI
tool credentials — then installs a cron job that survives cleanup.

The scanner is free and local-first. No account, no telemetry. It checks
.vscode/tasks.json, fake assets, git hooks, .git/config, CI workflows, and
leaked credentials. The demo repo uses a harmless fake payload so you can try
it safely.

I'd love feedback on false positives and on the fix workflow. What would make
you trust a tool like this?
```

### Launch day checklist

- [ ] 12:01am PT launch.
- [ ] Logo 240×240, gallery 1270×760, video 30–60s.
- [ ] First comment posted immediately.
- [ ] Email list at 6:00am PT.
- [ ] X/Bluesky/LinkedIn posts with the video.
- [ ] Post in relevant Slack/Discord communities (no spam).
- [ ] Respond to every comment within 30 minutes.
- [ ] No paid upvotes, no vote pods.

---

## 3. Press pitch

### Subject line options

1. `Free scanner for the VS Code folder-open stealer (17k+ repos)`
2. `The fake font that steals cloud keys when you open a repo`
3. `GitLab's leak wave has a developer-endpoint problem`

### Email

```
Hi [name],

I'm [name], a developer who built [tool]. I saw your coverage of [specific
article] and thought this follow-up might be useful.

GhostAction/PolinRider pushed 72,026 commits across 22,964 repos in October;
17,667 carried a fake font plus a hidden .vscode/tasks.json task that runs a
credential stealer when the folder is opened. GitHub's workflow hold doesn't
apply because no workflow is involved.

I built a free, local-first scanner that detects the folder-open task, the
fake asset, the hooks/config patterns, and leaked GitLab tokens. Demo repo
(safe, fake payload): [LINK]. 45-second video: [LINK].

I can share the detection methodology, a quote, or a demo. No embargo needed,
but I can give you first look if you want it.

Thanks,
[name]
[LINK] · [GITHUB] · [X]
```

### Follow-up (3–4 days later)

```
Hi [name], just floating this once more in case it's useful. Happy to send a
2-minute demo or a quote. If it's not a fit, no worries — I'll stop here.
```

### Do not

- Send live tokens, private data, or unredacted victim names.
- Claim "zero-click" or "all VS Code users are affected."
- Spam 20 outlets with the same email in one day.
- Offer an exclusive and then send it to everyone.

---

## 4. README outline (CLI repo)

```markdown
# Git Triage

**Scan a repo for malicious folder-open tasks, fake assets, and leaked
credentials before you open it.**

[badges: npm, CI, license, stars]

![demo](docs/demo.gif)

## Try it

```bash
npx git-triage scan .
```

## What it catches

| Check | Example |
|---|---|
| Hidden folder-open tasks | `.vscode/tasks.json` with `runOn: folderOpen` |
| Fake assets | `.woff2` that is a Node.js script |
| Git hooks | non-sample `post-checkout` / `pre-push` |
| Dangerous git config | `core.fsmonitor`, `core.sshCommand`, `include.path` |
| CI exfiltration | `curl ... | bash`, history grep, token POST |
| Leaked credentials | GitLab `glimt-`, `glpat-`, GitHub PATs, AWS keys, npm tokens |

## Why this matters

- 17,667 repos carried the GhostAction folder-open stealer in October 2026.
- Cleaning the repo does not remove the cron job it installs.
- GitHub's workflow hold doesn't apply; the payload runs on the developer machine.

## How it works

Local-first, no telemetry, no account. Reads the repo, parses the files,
prints findings. `--json` for CI.

## VS Code extension

[LINK] — warns before tasks run, quarantines suspicious files, and guides the fix.

## GitHub Action

```yaml
- uses: [org]/git-triage@v1
```

## Comparison

| Tool | Detects folder-open malware | Fixes leaked tokens | Local-first |
|---|---|---|---|
| gitleaks | No | No | Yes |
| TruffleHog | No | No | Yes |
| Leak Lock | No | Rewrites history | Yes |
| Git Triage | Yes | Yes (guided) | Yes |

## Contributing

See `CONTRIBUTING.md`. Good first issues are labeled.

## Star the repo

If this saved you from a bad repo, a star helps other developers find it.
```

---

## 5. Landing page copy

### Hero

**Your repo can run code when you open it in VS Code.**

A fake font. A hidden task. Your AWS keys, npm token, SSH keys, and AI credentials — gone before you notice.

**Check any repo in 10 seconds.**

`npx git-triage scan .`

[Install for VS Code] [Star on GitHub]

### Section: What it catches

- Hidden `.vscode/tasks.json` tasks that run on folder open.
- "Fonts" and images that are actually scripts.
- Git hooks and `.git/config` keys that execute code.
- CI workflows that grep your history and POST secrets.
- Leaked GitLab `glimt-` tokens, PATs, AWS keys, npm tokens.

### Section: Why now

In October 2026, GhostAction/PolinRider pushed 72,026 commits across 22,964 repos. 17,667 carried a folder-open stealer. Cleaning the repo did not remove the cron job.

### Section: Free and local

No account. No telemetry. No secrets leave your machine. Open source.

### CTA

**Scan your next repo before you trust it.**

[Install] [CLI] [GitHub]

---

## 6. Social posts

### X / Bluesky

```
A repo can run code when you open it in VS Code.

Fake font → hidden .vscode/tasks.json → reads ~/.aws, .npmrc, SSH keys, AI creds → installs a cron job.

17,667 repos carried this in October.

Free scanner, 10 seconds, local-first:
npx git-triage scan .

[LINK]
```

### LinkedIn

```
Most developers trust a repo by opening it.

In October, 17,667 repos carried a fake font and a hidden VS Code task that
ran a credential stealer on folder open. GitHub's workflow hold didn't apply —
the payload runs on the developer's machine.

I built a free, local-first scanner that checks for the folder-open task, fake
assets, hooks, dangerous git config, CI exfiltration patterns, and leaked
tokens before you trust the workspace.

No account, no telemetry. Try it on a repo:
npx git-triage scan .

[LINK]
```

### Reddit r/vscode (use "I built this" flair)

```
Title: I built a free scanner for the hidden VS Code folder-open malware

Body:
I kept seeing the GhostAction/PolinRider pattern: a repo ships a fake font and
a .vscode/tasks.json task with runOn: folderOpen. When you open the folder and
trust the workspace, it runs a credential stealer and installs a cron job.

I built a CLI + extension that scans for that pattern, plus fake assets, hooks,
dangerous .git/config, CI exfiltration, and leaked tokens. Local-first, no
telemetry, MIT.

Demo repo with a harmless fake payload: [LINK]
CLI: npx git-triage scan .
Extension: [LINK]

Happy to answer questions or take false-positive reports.
```

### Reddit r/netsec (research angle, disclose affiliation)

```
Title: GhostAction's VS Code folder-open loader: 17,667 repos, and a scanner

Body:
[Technical summary of the attack, the task JSON, the fake font, the stealer,
the cron persistence, and the detection approach. Disclose that you built the
scanner. Link the demo repo and the write-up, not the Marketplace listing.]
```

---

## 7. Newsletter blurbs

### Console.dev (email hello@console.dev)

```
Tool: Git Triage
What: Scans a Git repo for malicious VS Code folder-open tasks, fake assets,
hooks, dangerous git config, CI exfiltration patterns, and leaked credentials.
Why: GhostAction/PolinRider used this exact pattern in 17,667 repos in October.
Free, local-first, CLI + VS Code extension.
Link: [LINK]
```

### VSCode.Email (DM @LouisLazaris)

```
New extension: Git Triage — warns before a repo's hidden folder-open task runs,
quarantines fake assets, and scans for leaked tokens. Free, local-first.
Link: [LINK]
```

### TLDR / DevOps'ish / Security Weekly

```
Story pitch: A free scanner for the VS Code folder-open credential stealer
behind 17,000+ compromised repos. Built by [name], open source, local-first.
Demo: [LINK]. Write-up: [LINK].
```

---

## 8. Submission tracker

| Channel | URL / contact | Date submitted | Status | Result |
|---|---|---|---|---|
| Hacker News | https://news.ycombinator.com/submit | | | |
| Lobsters | https://lobste.rs/submit | | | |
| Product Hunt | https://www.producthunt.com/posts/new | | | |
| Console.dev | hello@console.dev | | | |
| VSCode.Email | DM @LouisLazaris | | | |
| TLDR | [editorial contact] | | | |
| DevOps'ish | [contact] | | | |
| Changelog | https://changelog.com/contact | | | |
| Security Weekly | https://securityweekly.com/contact/ | | | |
| The Hacker News | https://thehackernews.com/p/submit-news.html | | | |
| BleepingComputer | https://www.bleepingcomputer.com/submit-news/ | | | |
| The Register | https://www.theregister.com/contact/ | | | |
| Cybernews | https://cybernews.com/contact/ | | | |
| SecurityWeek | https://www.securityweek.com/contact/ | | | |
| Help Net Security | https://www.helpnetsecurity.com/contact/ | | | |
| DevOps.com | https://devops.com/contact/ | | | |

> Verify every URL/email before sending.

---

## 9. 10-second demo script (video)

1. **0–2s:** Show a normal-looking repo: `README.md`, `public/fonts/fa-solid-400.woff2`.
2. **2–5s:** Open `.vscode/tasks.json`; highlight `"runOn": "folderOpen"`, `"hide": true`, `node ./public/fonts/fa-solid-400.woff2`.
3. **5–8s:** Run `npx git-triage scan .`; show the CRITICAL finding and the "this file is a script, not a font" line.
4. **8–10s:** Show the warning: "This repo contains a hidden task that runs when the folder opens." Buttons: Inspect / Quarantine / Open in Restricted Mode.
5. **End card:** `[YOUR DOMAIN]` — "Check before you trust."

Keep it silent-friendly with captions; most people watch without sound.

---

## 10. One-line pitch

**Git Triage is the 10-second safety check before you open a repository — it catches hidden folder-open tasks, fake assets, malicious hooks, and leaked credentials before they run.**

---

## 11. GitLab-led angle (the main launch)

This is the driving narrative. It is accurate, timely, and specific.

### The line

> **GitLab patched the CVE. Your leaked token is still valid.**
>
> Patching the server doesn't revoke the credentials that already leaked.

### Why this works

- GitLab's 2026 run is real: three CVSS 10.0s, two CISA KEV entries, public exploits, 86,000+ exposed hosts.
- It is a **gap story**, not a vulnerability claim: the patch is necessary, but it is not the fix.
- It leads naturally to the product: find the leaked GitLab token, revoke it, rotate it, purge it, verify it.
- It gives you a second act: stolen token → malicious commit → VS Code folder-open stealer.
- It is defensible on a resume: "Built the remediation layer for the 2026 GitLab credential leaks."

### HN titles

1. `GitLab patched the CVE. Your leaked token is still valid.`
2. `GitLab's leak wave has a second act: the token.`
3. `The GitLab leak isn't the CVE. It's the token that never expires.`
4. `GitLab's glimt token is account-wide, never expires, and GitLab won't revoke it.`

### HN first comment

```
Author here. GitLab shipped three CVSS 10.0 fixes in six weeks
(CVE-2026-85706, CVE-2026-97229, CVE-2026-110264), plus several 9.9s.
Two are in CISA KEV. Patching the server doesn't revoke the credentials
that already leaked.

CVE-2026-85706 alone let an unauthenticated attacker read
/etc/gitlab/gitlab-secrets.json, which decrypts CI/CD variables, deploy
keys, and integration tokens. Censys found 86,231 exposed GitLab hosts;
ShadowServer found ~13,700 still vulnerable.

The worst token is the incoming-email one: the glimt- string inside
incoming+...-glimt-...-issue@incoming.gitlab.com is account-wide, never
expires, and isn't checked against the sender. Change -issue to
-merge-request, attach a .patch, and GitLab commits it as you and runs CI.
It bypasses IP allow-lists and 2FA because it arrives by email.

GitLab's automatic revocation doesn't cover this token; the only fix is a
manual reset. I built Git Triage to find these tokens, show the blast
radius, and walk you through the fix: revoke, rotate, purge, verify, report.
It also catches the folder-open malware that spreads after a token is stolen.

Demo (fake token): [LINK]
Clarification: this is not a GitLab CVE; it's the credential-leak layer that
patching doesn't fix.
```

### Product Hunt

**Tagline:** `GitLab patched the CVE. Your leaked token is still valid.`

**Short description:** `Git Triage finds leaked GitLab tokens (glimt-, glpat-), shows the blast radius, and walks you through revoke → rotate → purge → verify. It also catches the hidden VS Code folder-open tasks that spread after a token is stolen. Free, local-first.`

**Maker's first comment:**

```
GitLab shipped three CVSS 10.0 fixes in six weeks. Patching the server was
necessary. It didn't revoke a single token that had already leaked.

The worst one is the glimt- incoming-email token: account-wide, never
expires, can push code and run CI, and bypasses IP allow-lists and 2FA.
GitLab's automatic revocation doesn't cover it. The only fix is a manual
reset.

I built Git Triage to start that layer: find the token, show what it can
reach, and give you a runbook for revoke → rotate → purge → verify. It also
catches the folder-open malware that spreads after a token is stolen.

Free, local-first, no account. The demo uses a fake token and a harmless
payload.
```

### X / LinkedIn

```
GitLab shipped three CVSS 10.0 fixes in six weeks.

Patching the server doesn't revoke the tokens that already leaked.

The worst: the glimt- incoming-email token.
Account-wide. Never expires. Can push code and run CI.
Bypasses IP allow-lists and 2FA.

GitLab's auto-revocation doesn't cover it.

I built the first step:
npx git-triage scan .
then revoke → rotate → purge → verify

[LINK]
```

### The three-post sequence

1. **Launch:** "GitLab patched the CVE. Your leaked token is still valid."  
   Link the GitLab post. This is the HN/press/PH hook.
2. **Follow-up (1–2 weeks):** "The stolen token becomes a developer laptop."  
   Link the folder-open post. This is the technical second act and the demo.
3. **Depth (2–4 weeks):** "We fixed a leaked GitLab token in 11 minutes."  
   A case study of the workflow. This converts attention into installs.

### Resume line

> "Built the remediation layer for the 2026 GitLab credential leaks: a free VS Code extension + CLI that finds leaked `glimt-`/PAT tokens and drives revoke → rotate → purge → verify. **X+ installs**, **Y+ GitHub stars**, Hacker News front page, Product Hunt top 5."

Or, if you do the technical teardown:

> "Reverse-engineered GitLab's `glimt-` incoming-email token and shipped an open-source scanner/fix with **X+ installs** and **Y+ GitHub stars**."

Use "reverse-engineered" only if you actually document the token format and reproduce the email-to-MR path. Otherwise "built the remediation layer" is accurate and still strong.

### The one thing not to write

- Do **not** say "GitLab is leaking tokens" as if the platform is currently exfiltrating them. The leaks are specific CVEs and exposed credentials.
- Do **not** claim the product patches GitLab. It fixes the credential leak that the patch leaves behind.
- Do **not** use "GitLens." That was the typo; GitLens is a different product and has no 2026 leak.


