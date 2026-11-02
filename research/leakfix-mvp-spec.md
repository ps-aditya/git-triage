# LeakFix — MVP Product Spec

**Version:** 0.1 (build spec)  
**Date:** 1 November 2026  
**Product:** VS Code extension for fixing leaked Git credentials  
**Positioning:** *Detection tools tell you what leaked. LeakFix fixes it.*

---

## 1. Product statement

LeakFix is a local-first VS Code extension that takes a leaked credential from **finding** to **verified fix**:

> **Contain → Rotate → Purge → Verify → Prevent → Prove**

It does not try to replace gitleaks, TruffleHog, GitLab Secret Detection, or GitGuardian. It consumes their findings and owns the part they stop short of: **revocation, rotation, history purge, verification, and an audit trail**.

### One-line job

> "I leaked a token. Tell me exactly what to do, in what order, do the dangerous parts safely, and prove the old credential is dead."

---

## 2. Goals and non-goals

### Goals (MVP)

1. Import or detect a leaked credential in a local Git repo.
2. Explain the **real blast radius** in plain English.
3. Guide the user through **revoke → rotate → purge → verify → prevent**.
4. Make the destructive step (history rewrite + force-push) **safe, previewable, and reversible**.
5. Produce a **timestamped incident report** with evidence and residual risk.
6. Warn on repo-open about the new class of **malicious `.vscode/tasks.json` / folder-open** attacks.

### Non-goals (MVP)

- A new secret-detection engine. Use gitleaks/Betterleaks rules and import SARIF.
- A GitLens competitor, reflog UI, or general Git GUI.
- A GitLab server patcher or vulnerability scanner.
- Fully automatic rotation for every provider.
- A cloud dashboard, team SSO, or billing (phase 2).
- Supporting every language/secret type. Start with six high-value types.

---

## 3. Users and jobs

| Persona | Job to be done | Willingness to pay |
|---|---|---|
| Indie dev / student | "I pushed an API key. What now?" | Low, but high install/word-of-mouth |
| Small team on self-managed GitLab Free/Premium | "We don't have Ultimate auto-revocation. Help us respond." | Medium |
| Agency / consultancy | "We handle 40 client repos. A leak is a client incident." | High |
| Security lead at a small company | "Give me evidence that it was fixed." | High |

**Beachhead:** self-managed GitLab teams without Ultimate, and agencies. They feel the `glimt-`/PAT/CI-variable problem directly and have no built-in fix workflow.

---

## 4. Core user journey

1. User opens a repo. LeakFix runs a quick working-tree scan (and optionally a history scan).
2. A finding appears in the sidebar: **"GitLab incoming email token — CRITICAL — still live."**
3. User clicks **Fix this leak**.
4. Wizard opens:
   - **Understand** — what it is, what it can reach, why it matters.
   - **Contain** — revoke at the provider; verify the old credential is dead.
   - **Rotate** — create a replacement; put it in the right place.
   - **Purge** — preview the rewrite, create a checkpoint, run it, force-push.
   - **Verify** — re-scan every ref; check provider; list residual copies.
   - **Prevent** — install hooks, add rules, update `.gitignore`.
   - **Report** — export the incident record.
5. User can restore from the checkpoint at any time before the final cleanup.

---

## 5. MVP scope

### In scope

- One workspace / one repo at a time.
- Working-tree scan + full-history scan (bounded by a configurable size/time limit).
- Six credential playbooks:
  1. GitLab PAT (`glpat-`)
  2. GitLab incoming-email token (`glimt-` / `incoming.gitlab.com`)
  3. GitHub PAT / GitHub App private key
  4. AWS IAM access key
  5. npm token
  6. One AI provider key (OpenAI or Anthropic) + SSH private key (count as 7 if cheap)
- Import SARIF/JSON from GitLab/GitHub/GitGuardian.
- Blast-radius summary (local config + optional provider API).
- Revoke/rotate guidance with deep links; API revoke where safe (GitLab PAT, AWS, npm).
- History purge via `git filter-repo` (preferred) or BFG (optional).
- Safety checkpoint + restore.
- Verification (provider API + ref scan).
- Markdown incident report (PDF optional via webview print).
- Repo Trust Gate (basic): `.vscode/tasks.json`, hooks, `.git/config`, fake assets, CI patterns.

### Out of scope (explicitly)

- Multi-repo dashboard.
- Team approvals/SSO.
- Automatic PR creation.
- Server-side GitLab posture scanning.
- Full SBOM/dependency scanning.
- Remediation of non-Git sources (Slack, Jira, Confluence).

---

## 6. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ VS Code Extension Host (TypeScript)                         │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Scanner      │   │ Playbook     │   │ Provider       │  │
│  │ Adapter      │──▶│ Engine       │──▶│ Clients        │  │
│  │ (gitleaks/   │   │ (YAML)       │   │ (GitLab, GitHub│  │
│  │  built-in)   │   │              │   │  AWS, npm, AI) │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
│         │                  │                    │           │
│         ▼                  ▼                    ▼           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Incident Engine                                      │   │
│  │ - state machine                                      │   │
│  │ - checkpoint/restore                                 │   │
│  │ - purge planner/runner                               │   │
│  │ - verifier                                           │   │
│  │ - report builder                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Sidebar Tree │   │ Webview      │   │ Output/Log     │  │
│  │ (findings,   │   │ Wizard       │   │ (redacted)     │  │
│  │  incidents)  │   │ (stepper)    │   │                │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
        git binary / child_process (spawn, args array)
```

### Key decisions

- **TypeScript + VS Code API.** No framework for the extension host.
- **Webview UI:** plain HTML/CSS/TS or a tiny reactive layer; CSP-locked, no remote assets. Avoid heavyweight frameworks for MVP.
- **Git operations:** use the built-in Git extension API for status/remotes where possible; use `git` binary for `bundle`, `update-ref`, `filter-repo`, `push`, and `reflog`.
- **Scanner:** bundle gitleaks (MIT) or call the user's installed binary; add a small built-in regex pass for the six playbook types (especially `glimt-`, which generic scanners may miss).
- **Core logic in a shared package** (`packages/core`) so a CLI/CI runner can reuse it later.
- **No shell interpolation.** `spawn(cmd, args, { shell: false })`; secrets passed via env or temp files with restricted permissions, never command-line args where avoidable.

---

## 7. Data model

### Finding

```ts
interface Finding {
  id: string;                 // stable hash of rule+file+commit+maskedValue
  ruleId: string;             // "gitlab-incoming-email-token"
  provider: string;           // "gitlab" | "github" | "aws" | "npm" | "openai" | "ssh"
  secretType: string;         // human label
  severity: "critical" | "high" | "medium" | "low";
  maskedValue: string;        // "glimt-…7f3a"
  valueHash: string;          // sha256(raw) — never store raw
  file?: string;
  line?: number;
  commit?: string;
  branch?: string;
  firstSeen?: string;         // ISO
  lastSeen?: string;
  verifiedLive?: boolean | null; // null = unknown
  evidence: FindingEvidence[];
}

interface FindingEvidence {
  kind: "working-tree" | "history" | "remote-ref" | "ci-config" | "docs" | "provider-api";
  detail: string;             // redacted
  url?: string;
}
```

### Incident

```ts
interface Incident {
  id: string;                 // "INC-2026-11-01-001"
  repoPath: string;
  remoteUrl?: string;
  findingIds: string[];
  status: "open" | "contained" | "rotated" | "purged" | "verified" | "closed" | "abandoned";
  createdAt: string;
  updatedAt: string;
  operator: string;           // OS username or configured name
  steps: IncidentStep[];
  checkpoint?: Checkpoint;
  reportPath?: string;
}

interface IncidentStep {
  id: "understand" | "contain" | "rotate" | "purge" | "verify" | "prevent" | "report";
  status: "pending" | "in-progress" | "done" | "blocked" | "skipped";
  startedAt?: string;
  completedAt?: string;
  evidence: string[];         // redacted log lines / API results
  notes?: string;
}

interface Checkpoint {
  id: string;
  createdAt: string;
  bundlePath: string;         // .git/leakfix/backups/<ts>.bundle
  ref: string;                // refs/leakfix/backup/<ts>
  head: string;
  refs: Record<string, string>;
}
```

### Storage

- Workspace-local: `<repo>/.git/leakfix/` (never in the worktree, never committed).
  - `incidents/<id>.json`
  - `backups/<ts>.bundle`
  - `reports/<id>.md`
  - `rules/` (cached playbooks)
- Global: VS Code `globalStorageUri` for playbook cache, provider settings, telemetry opt-in.
- Secrets: VS Code `SecretStorage` only. Never in JSON, logs, reports, or telemetry.
- Raw secret values: keep in memory only. If a provider API needs the raw value for verification, read it from the finding source on demand (user gesture) and discard.

---

## 8. Scanner layer

### Engines

| Engine | Role | License note |
|---|---|---|
| **gitleaks** | Default history + working-tree scan | MIT; safe to bundle |
| **Betterleaks** | Optional; best `glimt-` coverage | Check license before bundling; otherwise external binary |
| **TruffleHog** | Optional verification (`--only-verified`) | AGPL-3.0; do not bundle; external binary only |
| **Built-in regex pass** | Fast working-tree + `git log -p` scan for the six playbook types | Our code |

### Behavior

1. On open: quick working-tree scan (files < 1 MB, skip binaries, respect `.gitignore` + a default exclude list).
2. On demand: full-history scan via gitleaks (`gitleaks detect --source . --report-format json --report-path -`).
3. If gitleaks is missing: offer "Install gitleaks" (download signed release for the platform) or run the built-in limited scan with a clear coverage warning.
4. If a scan is too large: show coverage panel (refs scanned, files skipped, engine versions) and never report "clean" without it.
5. Import: SARIF 2.1.0 and GitLab/GitHub secret-detection JSON; map to `Finding`.

### Built-in rules (MVP)

```ts
const RULES = [
  { id: "gitlab-pat", regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, provider: "gitlab" },
  { id: "gitlab-incoming-email-token", regex: /\bglimt-[A-Za-z0-9_-]{10,}\b/g, provider: "gitlab" },
  { id: "gitlab-incoming-address", regex: /incoming\+[^@\s]+-glimt-[A-Za-z0-9_-]+-(?:issue|merge-request)@incoming\.gitlab\.com/g, provider: "gitlab" },
  { id: "github-pat", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g, provider: "github" },
  { id: "github-fine-grained-pat", regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, provider: "github" },
  { id: "aws-access-key", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, provider: "aws" },
  { id: "npm-token", regex: /\bnpm_[A-Za-z0-9]{36}\b/g, provider: "npm" },
  { id: "openai-key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, provider: "openai" },
  { id: "anthropic-key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, provider: "anthropic" },
  { id: "ssh-private-key", regex: /-----BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/g, provider: "ssh" }
];
```

> False positives: show a "Not a secret / Ignore" action that writes to `.git/leakfix/ignore` (not `.gitignore`), with a reason.

---

## 9. Playbook engine

Playbooks are YAML files, versioned, and updateable. They are the product's knowledge layer.

### Schema

```yaml
id: string
version: number
provider: string
display_name: string
severity: critical | high | medium | low
match:
  - regex: string
  - path: string          # optional path/glob hint
mask: string              # e.g. "glimt-…{last4}"
why: string               # plain-English risk
blast_radius:
  - string
revoke:
  type: api | cli | manual
  url?: string
  command?: string
  args?: string[]
  steps?: string[]
  requires?: string[]     # scopes/permissions
verify:
  type: api | cli | manual
  url?: string
  command?: string
  args?: string[]
  expect_status?: number
  expect_error?: string
  instructions?: string
rotate:
  steps:
    - string
purge:
  required: boolean
  paths: string[]         # docs/config files likely to contain it
  replacement: string     # default "***REMOVED***"
prevent:
  - string
references:
  - string
```

### Example A — GitLab incoming-email token

```yaml
id: gitlab-incoming-email-token
version: 1
provider: gitlab
display_name: GitLab incoming email token
severity: critical
match:
  - regex: 'glimt-[A-Za-z0-9_-]{10,}'
  - regex: 'incoming\+[^@\s]+-glimt-[A-Za-z0-9_-]+-(issue|merge-request)@incoming\.gitlab\.com'
mask: 'glimt-…{last4}'
why: >
  This is not just an email address. The glimt- string is an account-wide,
  non-expiring token. Anyone who has it can create issues and merge requests,
  push code, run CI/CD jobs, read CI/CD variables, and reach every project
  your account can access — including private projects behind an IP allow-list.
blast_radius:
  - "All projects your account can access, public and private"
  - "Protected branches, if your role allows it"
  - "CI/CD variables and CI_JOB_TOKEN"
  - "Confidential issues and merge requests"
  - "Bypasses IP allow-lists and 2FA because it arrives by email"
revoke:
  type: manual
  url: https://gitlab.com/-/user_settings/personal_access_tokens
  steps:
    - "Open User settings → Personal access tokens."
    - "Find 'Incoming email token' and click Reset."
    - "This invalidates every project email address for your account."
    - "Confirm the old address no longer works by checking the token page."
  requires:
    - "Signed-in GitLab account"
verify:
  type: manual
  instructions: >
    The old address should no longer create issues or merge requests.
    Ask a teammate to send a test email to the old address and confirm it is rejected.
    If it still works, the reset did not take effect — stop and contact GitLab support.
rotate:
  steps:
    - "Open the project's 'Email work item to this project' dialog to get the new address."
    - "Update any README, contributing guide, support page, or bookmark that used the old address."
    - "Do not publish the new address; treat it as a credential."
purge:
  required: true
  paths:
    - "README.md"
    - "CONTRIBUTING.md"
    - "docs/"
    - ".gitlab-ci.yml"
  replacement: "***REMOVED***"
prevent:
  - "Add a custom secret-detection rule for glimt- and incoming.gitlab.com."
  - "Remove the address from public docs; use a contact form or issue template instead."
  - "Audit recent commits and pipeline runs for actions the owner did not perform."
references:
  - "https://www.aikido.dev/blog/gitlab-email-push-to-main"
  - "https://docs.gitlab.com/user/application_security/secret_detection/"
```

### Example B — AWS IAM access key

```yaml
id: aws-iam-access-key
version: 1
provider: aws
display_name: AWS IAM access key
severity: critical
match:
  - regex: 'AKIA[0-9A-Z]{16}'
  - regex: 'ASIA[0-9A-Z]{16}'
mask: 'AKIA…{last4}'
why: >
  An IAM access key can call AWS APIs with the permissions of its user or role.
  Attackers routinely use leaked keys to enumerate accounts, read S3 objects,
  start expensive resources, and pivot into other services.
blast_radius:
  - "Every AWS API the key's IAM policy allows"
  - "S3 buckets, databases, queues, and secrets the key can read"
  - "Potential billing abuse (crypto mining, large instances)"
revoke:
  type: cli
  command: "aws"
  args: ["iam", "update-access-key", "--access-key-id", "{{secret}}", "--status", "Inactive"]
  steps:
    - "Deactivate first, then delete after confirming nothing depends on it."
    - "If you cannot use the CLI, open the IAM console → Users → Security credentials."
  requires:
    - "iam:UpdateAccessKey permission"
verify:
  type: cli
  command: "aws"
  args: ["sts", "get-caller-identity"]
  expect_error: "InvalidClientTokenId"
  instructions: "Run the old key through `aws sts get-caller-identity`; it must fail."
rotate:
  steps:
    - "Create a new access key for the same user or, better, migrate to an IAM role/OIDC."
    - "Update the application's environment or secret manager."
    - "Confirm the application works, then delete the old key."
purge:
  required: true
  paths:
    - ".env"
    - "docker-compose.yml"
    - "terraform/"
    - ".github/workflows/"
  replacement: "***REMOVED***"
prevent:
  - "Use OIDC/short-lived credentials instead of long-lived keys."
  - "Add a pre-commit hook and push protection."
  - "Enable AWS CloudTrail alerts for unusual API calls."
references:
  - "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html"
```

### Playbook loading

- Built-in playbooks ship in the VSIX.
- Optional signed rule-pack updates (phase 2).
- User can add local playbooks in `.leakfix/playbooks/` (workspace) or global storage.
- Validate against a JSON schema; reject unknown fields; never execute arbitrary commands from a playbook unless the playbook is signed or the user explicitly approves.

> **Security note:** a playbook is executable knowledge. Treat third-party playbooks as code. For MVP, only ship built-in, reviewed playbooks; allow user-authored local playbooks with a warning and no auto-run.

---

## 10. UI / UX

### Surfaces

1. **Activity bar icon** — shield with a small badge for open findings.
2. **Sidebar tree**
   - `Findings` (grouped by severity)
   - `Incidents` (open/closed)
   - `Playbooks`
   - `Settings`
3. **Webview wizard** — the main experience, opened in an editor tab.
4. **Status bar** — "LeakFix: 2 live secrets" / "Incident in progress."
5. **Output channel** — redacted command/API log.

### Wizard screens

**Screen 0 — Finding**
- Title: "GitLab incoming email token"
- Severity chip: CRITICAL / LIVE
- Masked value, file, commit, branch.
- "Why this matters" (from playbook).
- Buttons: **Fix this leak**, **Show in history**, **Ignore**.

**Screen 1 — Understand**
- Blast radius list.
- "What an attacker could do" (3 bullets, plain English).
- "What fixing involves" (5 steps, time estimate).
- Checkbox: "I understand this may rewrite history and require a force-push."
- Button: **Start incident**.

**Screen 2 — Contain**
- Step 1: Revoke.
- Deep link button: **Open GitLab token settings**.
- For API-capable providers: **Revoke now** (with scope explanation).
- Status: `Not revoked` → `Revoked` → `Verified dead`.
- "Verify" button (API call or manual checklist).
- Cannot proceed to Purge until revoked or explicitly skipped with a warning.

**Screen 3 — Rotate**
- Checklist of rotation steps (from playbook).
- Field: "Where is the new credential stored?" (env var / secret manager / CI variable / other).
- "I've rotated" checkbox.
- Note: "Do not paste the new secret here."

**Screen 4 — Purge**
- **Preview** panel:
  - "This will rewrite 1,284 commits across 7 branches and 3 tags."
  - "These remote refs will be force-updated: main, release/2.x, v1.4.0."
  - "These files contain the secret: README.md (12 commits), .gitlab-ci.yml (1 commit)."
  - "Unpushed commits: none" (or a blocking list).
- **Checkpoint** card:
  - "Backup bundle: .git/leakfix/backups/2026-11-01T14-22-01.bundle"
  - "Backup ref: refs/leakfix/backup/2026-11-01T14-22-01"
  - Button: **Create checkpoint** (required).
- **Script preview** (read-only, monospace) with the exact commands.
- Typed confirmation: type `PURGE` (or the branch name).
- Buttons: **Run purge**, **Copy script**, **Cancel**.
- Progress: fetch → bundle → rewrite → expire reflog → gc → push → re-fetch → verify.
- On protected-branch failure: explain exactly which branch blocked it, that nothing was pushed, and how to temporarily allow force-push, then restore protection.

**Screen 5 — Verify**
- Provider check: "Old token returns 401" / "Manual verification required."
- Ref scan: "All 7 branches and 3 tags are clean" / "2 remote refs still contain the secret."
- Residual copies checklist:
  - Forks, mirrors, CI caches, artifacts, release assets, wiki, issues, MR comments, package registries, local clones.
- Button: **Re-scan now**.

**Screen 6 — Prevent**
- Toggle: install pre-commit hook.
- Toggle: install pre-push hook.
- Add custom rule (`glimt-`, `incoming.gitlab.com`).
- Add `.gitignore` entries.
- Link: enable GitLab/GitHub push protection.
- Button: **Apply**.

**Screen 7 — Report**
- Preview Markdown.
- Buttons: **Export Markdown**, **Print/PDF**, **Copy summary**.
- Report path: `.git/leakfix/reports/INC-….md`.

### Visual rules

- Destructive actions are red and never the default focus.
- Every scary action has a "what will happen" sentence and a "how to undo" sentence.
- Never show a green "Secure" badge. Use "Verified dead," "Clean on all refs," "Residual copies may exist."
- Mask secrets everywhere: `glimt-…7f3a`, `AKIA…9Q2X`.

---

## 11. Safety checkpoint and purge design

### Checkpoint (before any rewrite)

```bash
# 1. Capture all refs
git for-each-ref --format='%(refname) %(objectname)' > .git/leakfix/backups/<ts>/refs.txt

# 2. Bundle everything (all refs, including remote-tracking)
git bundle create .git/leakfix/backups/<ts>.bundle --all

# 3. Create a restore ref
git update-ref refs/leakfix/backup/<ts> HEAD

# 4. Save reflog and config (for forensics)
cp -r .git/logs .git/leakfix/backups/<ts>/logs
cp .git/config .git/leakfix/backups/<ts>/config
```

- Do not expire the reflog until the purge is verified and the user confirms cleanup.
- Keep the bundle until the user deletes it; default retention 30 days.
- Restore:
  ```bash
  git reset --hard refs/leakfix/backup/<ts>
  # or, if the ref is gone:
  git bundle unbundle .git/leakfix/backups/<ts>.bundle
  ```
- Warn: restoring after a force-push requires another force-push; never do it automatically.

### Purge plan (git filter-repo preferred)

```bash
# Preconditions
git fetch --all --prune --tags
# stop if any local branch is ahead of its upstream
# stop if the working tree is dirty (offer stash/commit)

# Materialize remote-only branches locally so the rewrite covers them
for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v '^origin/HEAD$'); do
  branch=${ref#origin/}
  git show-ref --verify --quiet refs/heads/$branch || git branch --track $branch $ref
done

# Prepare replacement rules (literal or regex)
# Format: literal==>replacement  or  regex:pattern==>replacement
cat > .git/leakfix/tmp/replacements.txt <<'EOF'
glimt-ABC123==>***REMOVED***
regex:incoming\+[^@\s]+-glimt-[A-Za-z0-9_-]+-(issue|merge-request)@incoming\.gitlab\.com==>***REMOVED***
EOF
chmod 600 .git/leakfix/tmp/replacements.txt

# Rewrite all refs
git filter-repo --force --replace-text .git/leakfix/tmp/replacements.txt

# filter-repo removes origin; re-add it
git remote add origin <original-url>

# Clean up old objects
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push atomically
git push --force-with-lease --atomic origin --all
git push --force-with-lease --atomic origin --tags

# Verify
git fetch --all --prune --tags
# scan every remote ref for the secret
```

### Fallback (BFG, optional)

```bash
java -jar bfg.jar --replace-text replacements.txt .
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

- BFG is GPL-3.0; do not bundle it. Detect a user-installed jar or offer a download with license notice.
- `git filter-branch` fallback: only for small repos, with a warning that it is slow and deprecated.

### Purge guardrails

1. Refuse if the working tree is dirty (offer to stash/commit).
2. Refuse if any local branch has unpushed commits; list them.
3. Refuse if the repo has submodules with uncommitted changes.
4. Require a checkpoint.
5. Require typed confirmation.
6. Never auto-force-push; show the exact push command.
7. Handle protected branches explicitly; do not retry blindly.
8. After push, re-fetch and verify every remote ref.
9. If verification fails, mark the incident `blocked` and show the residual refs; do not claim success.
10. Keep the backup until the user closes the incident.

---

## 12. Verification layer

### Provider checks

| Provider | Validate old credential | Revoke | Verify dead |
|---|---|---|---|
| GitLab PAT | `GET /api/v4/personal_access_tokens/self` | `DELETE /api/v4/personal_access_tokens/:id` | 401 |
| GitLab incoming email | No public reset API (UI only) | Manual reset | Manual test / token page |
| GitHub PAT | `GET /user` | Web settings (classic/fine-grained) | 401 |
| GitHub App key | `GET /app` (JWT) | Delete key in settings | 401 |
| AWS IAM | `sts get-caller-identity` | `iam update-access-key --status Inactive` then delete | `InvalidClientTokenId` |
| npm | `GET /-/whoami` | `npm token revoke <id>` | 401 |
| OpenAI | `GET /v1/models` | Dashboard | 401 |
| Anthropic | `GET /v1/models` | Console | 401 |
| SSH | `ssh-keygen -lf` | Remove from provider/authorized_keys | Key rejected |

> Endpoints and API availability change. Treat the table as a starting point and verify before shipping. Prefer manual deep links when an API is undocumented or requires elevated scopes.

### Ref verification

- For each remote branch/tag: `git grep -n <secret-hash>`? Git grep can't search a hash. Use the raw secret only in memory; run `git grep -F -- <raw>` on each ref, or scan the ref's tree with the regex engine.
- Better: `git log -p <ref>` piped through the detector, plus `git grep` on the tip tree.
- Report coverage: refs scanned, commits scanned, files skipped, engine version.
- If a ref cannot be scanned (e.g., too large), say so; do not report "clean."

### Residual copies checklist

- Forks and mirrors (provider API / manual).
- CI caches and artifacts (GitLab/GitHub).
- Release assets and package registries.
- Wiki, issues, merge request comments, snippets.
- Local clones on other machines.
- Backups and snapshots.
- Search-engine caches / public paste sites (manual).

---

## 13. Audit report

### Template

```markdown
# LeakFix Incident Report — INC-2026-11-01-001

**Repository:** example/app  
**Remote:** gitlab.com/example/app  
**Operator:** jane@example.com  
**Started:** 2026-11-01T14:02:11Z  
**Closed:** 2026-11-01T15:18:44Z  

## Summary
A GitLab incoming-email token (`glimt-…7f3a`) was found in `README.md` and 12 commits.
The token was account-wide and non-expiring. It was reset at 14:21Z; the old address
was verified rejected at 14:26Z. History was rewritten across 7 branches and 3 tags
at 14:40Z; all remote refs were verified clean at 14:52Z.

## Finding
| Field | Value |
|---|---|
| Rule | gitlab-incoming-email-token |
| Severity | Critical |
| Masked value | glimt-…7f3a |
| First seen | 2026-03-14 (commit abc1234) |
| Exposure | Public repository, 41 days |
| Live at detection | Yes |

## Blast radius
- All projects the account can access (14 repositories).
- CI/CD variables in 3 projects.
- Protected branch `main` (role: Maintainer).

## Timeline
| Time (UTC) | Action | Evidence |
|---|---|---|
| 14:02 | Finding detected | gitleaks 8.x + built-in rule |
| 14:08 | Incident opened | — |
| 14:21 | Incoming email token reset | GitLab settings |
| 14:26 | Old address rejected | Manual test email |
| 14:31 | Replacement address issued | GitLab project dialog |
| 14:40 | History rewritten | filter-repo, 1,284 commits |
| 14:44 | Force-push completed | atomic push, 7 branches, 3 tags |
| 14:52 | All refs verified clean | 7/7 branches, 3/3 tags |
| 15:05 | Prevention applied | pre-commit hook + custom rule |

## Residual risk
- 2 forks exist outside the team's control; the old token is dead, but the address may be cached.
- CI artifacts from before 14:40 may still contain the address; expire them.
- One developer laptop may have the old address in shell history; rotate/clean.

## Sign-off
- Operator: jane@example.com
- Reviewer: (pending)
```

### Rules

- Never include raw secrets.
- Include hashes/prefixes only.
- State what was **not** verified.
- Include the exact commands run (redacted) in an appendix.

---

## 14. Repo Trust Gate (MVP-lite)

### Checks

| Target | What to flag |
|---|---|
| `.vscode/tasks.json` | `runOn: folderOpen`, `hide: true`, `reveal: never`, shell commands invoking `node`, `curl`, `powershell`, `bash`, `wget`, `python`, `mshta`, `rundll32`; label/path mismatch |
| Fake assets | `.woff2`, `.ttf`, `.png`, `.jpg` that are text/JS (`require(`, `import`, `#!/usr/bin/env node`) or ZIP magic bytes |
| `.git/hooks` | Non-sample hooks, especially `post-checkout`, `post-merge`, `pre-commit`, `pre-push` |
| `.git/config` | `core.fsmonitor`, `core.sshCommand`, `core.editor`, `core.pager`, `include.path`, `includeIf`, `url.*.insteadOf` |
| `.gitmodules` | Unknown hosts, `update = !command` |
| CI files | `curl ... | bash`, base64 decode, `GITHUB_TOKEN`/`CI_JOB_TOKEN` exfil, `runs-on: self-hosted`, `pull_request_target`, `workflow_run`, `secrets: inherit` |
| Known IOCs | GhostAction/PolinRider hashes, C2 IPs, `#ghc2` cron marker, fake font names |

### UX

On folder open, before tasks run:
> **This repository contains a hidden task that runs when the folder opens.**
> `public/fonts/fa-solid-400.woff2` is a Node.js script. It can read your AWS, npm, GitHub, SSH, and AI-tool credentials.
> [Inspect] [Quarantine file] [Disable task] [Open in Restricted Mode]

- Do not auto-delete files; quarantine by renaming to `.leakfix-quarantine` and record hashes.
- Do not auto-run any repo command.
- If the user opens in Restricted Mode, still show the warning (tasks won't run, but the repo is still suspect).

> Phase 2: signed IOC feed, workspace trust integration, and a "safe open" mode that disables tasks/hooks until the user approves.

---

## 15. Commands and settings

### Commands

| Command | Purpose |
|---|---|
| `leakfix.scan` | Scan working tree + history |
| `leakfix.import` | Import SARIF/JSON |
| `leakfix.fix` | Start incident for a finding |
| `leakfix.revoke` | Run the revoke step |
| `leakfix.rotate` | Show rotation checklist |
| `leakfix.purge.preview` | Generate the purge plan + script |
| `leakfix.purge.run` | Run the purge after confirmation |
| `leakfix.verify` | Verify provider + refs |
| `leakfix.report.export` | Export the incident report |
| `leakfix.checkpoint.create` | Create a manual checkpoint |
| `leakfix.checkpoint.restore` | Restore a checkpoint |
| `leakfix.trustGate.scan` | Run the repo trust checks |
| `leakfix.trustGate.quarantine` | Quarantine a suspicious file |

### Settings

```jsonc
{
  "leakfix.scanner.engine": "gitleaks",        // "gitleaks" | "builtin" | "external"
  "leakfix.scanner.path": "",                   // optional external binary
  "leakfix.scanner.maxHistoryMB": 500,
  "leakfix.scanner.exclude": ["**/node_modules/**", "**/dist/**"],
  "leakfix.purge.tool": "filter-repo",          // "filter-repo" | "bfg" | "filter-branch"
  "leakfix.purge.requireCheckpoint": true,
  "leakfix.backup.retentionDays": 30,
  "leakfix.providers.gitlab.baseUrl": "https://gitlab.com",
  "leakfix.providers.gitlab.token": "",         // stored in SecretStorage, not settings
  "leakfix.providers.github.token": "",
  "leakfix.telemetry.enabled": false,
  "leakfix.trustGate.enabled": true,
  "leakfix.trustGate.blockOnFolderOpen": true
}
```

### Security

- Provider tokens → `context.secrets` (SecretStorage).
- Workspace settings must not be able to point provider tokens at an attacker-controlled base URL without a warning. Treat `leakfix.providers.*.baseUrl` as `machine`-scoped or require confirmation.
- No telemetry by default. If enabled, send only counts and rule IDs — never secrets, file contents, repo names, or remote URLs.
- Redact logs: replace any matched secret with `[REDACTED:<rule>:<hash8>]`.
- CSP in webview: `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-…'; img-src data:`.
- Signed VSIX; publish SHA-256. Reproducible build where possible.
- Dependency review: no `postinstall` scripts from untrusted packages; lockfile pinned.

---

## 16. Test plan

### Fixtures

1. `clean-repo` — no secrets.
2. `working-tree-secret` — a `glimt-` token in `README.md`, uncommitted.
3. `history-secret` — a PAT in an old commit, removed from HEAD.
4. `remote-only-branch` — a secret only on a branch that exists on the remote.
5. `tag-secret` — a secret in a tagged release.
6. `protected-branch` — remote rejects force-push.
7. `unpushed-commits` — local branch ahead of upstream.
8. `submodule-repo` — submodule with local changes.
9. `large-repo` — 1 GB / 50k commits (performance).
10. `malicious-repo` — `.vscode/tasks.json` with `folderOpen`, fake font, hook, dangerous `.git/config`.
11. `windows-paths` — spaces, long paths, CRLF.
12. `monorepo` — many packages, `.env` files, CI configs.

### Acceptance tests

- **Scan:** finds the `glimt-` token in working tree + history; shows masked value; never logs raw.
- **Contain:** revoke step opens the correct URL; API revoke works with a test token; verification marks `verifiedLive=false`.
- **Rotate:** checklist renders; no field accepts a secret; user can mark done.
- **Purge preview:** lists exact commits/branches/tags; refuses on dirty tree/unpushed commits; creates a checkpoint.
- **Purge run:** rewrites all refs, force-pushes atomically, re-fetches, verifies clean; backup restores the pre-fix state.
- **Protected branch:** push fails; nothing is lost; error names the blocking branch and gives steps.
- **Verification:** reports residual refs accurately; never says "clean" if a ref was skipped.
- **Report:** exports Markdown with no raw secrets; includes evidence and residual risk.
- **Trust Gate:** flags `folderOpen` before task execution; quarantine works; no auto-run.
- **Security:** no secret in logs/reports/telemetry; CSP blocks remote scripts; provider token stored in SecretStorage.

### Performance targets

- Working-tree scan of a 100k-file repo: < 10s.
- History scan of 50k commits / 500 MB: < 3 min on a modern laptop, with progress + cancel.
- Purge of 50k commits: < 2 min with filter-repo.
- UI remains responsive; long operations run in a worker/child process.

---

## 17. Build plan (8 weeks)

| Week | Deliverable |
|---|---|
| 1 | Extension scaffold, sidebar, output channel, settings, SecretStorage, finding model |
| 2 | gitleaks adapter + built-in rules; working-tree and history scan; SARIF import |
| 3 | Playbook engine + 6 playbooks; blast-radius view; contain/verify (GitLab PAT, AWS, npm) |
| 4 | Checkpoint + purge preview/run + restore; protected-branch handling |
| 5 | Rotate/prevent steps; incident state machine; report builder |
| 6 | Trust Gate (tasks/hooks/config/fake assets); tests + fixtures |
| 7 | Polish, docs, demo repo, security review, signed build |
| 8 | Open VSX beta, feedback loop, Marketplace prep |

### Team assumption

One developer (you) + part-time design/security review. If solo, cut Trust Gate to week 8 or ship it after the first 100 fixes.

---

## 18. Launch checklist

- [ ] Name/trademark check: LeakFix / Git Triage (Marketplace, Open VSX, USPTO, npm, GitHub).
- [ ] Unique icon: no orange Git diamond, no GitLab fox.
- [ ] Clear "unofficial" wording; no provider logos.
- [ ] README with a 60-second demo GIF: leak → revoke → purge → verify → report.
- [ ] Security page: local-first, no telemetry, signed builds, how to verify.
- [ ] Test on Windows (PowerShell/Git Bash), macOS, Linux.
- [ ] Test with GitLab.com and a self-managed instance.
- [ ] Open VSX first; Marketplace once, complete metadata in one upload.
- [ ] Free tier includes the full single-repo fix; Pro adds provider API revocation + signed reports.
- [ ] Launch content: "GitLab's 2026 leak wave: the fix nobody ships."

---

## 19. Open questions to verify before building

1. **GitLab incoming-email token reset API:** Is there a documented API, or only the UI? (Current research says UI-only; admin token API can identify but not revoke incoming mail tokens.)
2. **GitHub fine-grained PAT revocation API:** Is there a public endpoint in 2026, or only the web settings?
3. **GitLab `gitlab-secrets.json` exposure impact:** Which exact token types can be decrypted with it, and what does GitLab recommend rotating? (Needed for the blast-radius text.)
4. **`git filter-repo` behavior after rewrite:** Does it remove `origin` by default in the installed version? Confirm the exact flags for preserving/re-adding remotes.
5. **`--force-with-lease` after a rewrite:** Confirm the correct expected-ref value for atomic multi-ref pushes; test on a protected branch.
6. **Leak Lock overlap:** What exactly does it not do (revoke/rotate/audit)? Confirm by testing, not by reading the README.
7. **VS Code Trust Gate timing:** Can an extension reliably warn before `folderOpen` tasks run? Test with a fixture; if not, use a startup scan + notification and document the limit.
8. **Licensing:** gitleaks (MIT), Betterleaks (check), TruffleHog (AGPL — do not bundle), BFG (GPL — do not bundle), git-filter-repo (check).

---

## 20. Acceptance criteria (definition of done)

The MVP is done when a new user can:

1. Install from Open VSX.
2. Open a repo with a leaked `glimt-` token.
3. See a clear, masked finding with a plain-English blast radius.
4. Revoke the token via a deep link and mark it verified.
5. Preview a history rewrite, create a checkpoint, run it, and force-push to a test remote.
6. Verify all refs are clean and see residual copies.
7. Export an incident report with no raw secrets.
8. Restore the repo from the checkpoint if they change their mind.
9. Open a malicious repo and get a warning about a hidden `folderOpen` task before it runs.

If any of those steps requires reading a blog post or a man page to complete, the MVP is not done.

---

## 21. One-sentence reminder

**The scanner is an input. The purge is a commodity. The product is the safe, verified, provable fix.**
