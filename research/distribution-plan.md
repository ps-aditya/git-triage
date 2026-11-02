# Distribution Plan — Users, Installs, HN, Product Hunt

**Goal:** validation, not revenue. A resume line backed by real numbers:

> "Built and launched **[product]**, a free VS Code extension + CLI that **[specific fix]**. **X+ installs**, **Y+ GitHub stars**, featured on **HN / Product Hunt / Console.dev / VSCode.Email**."

This plan is designed around what actually moves those numbers in 2026, not around "build it and they will come."

---

## 0. Reality check (read this first)

I pulled the actual numbers for comparable tools. They change the strategy.

| Product | Installs | GitHub stars | Lesson |
|---|---:|---:|---|
| GitLens | 53,672,806 | — | Incumbent; do not compete head-on |
| GitGuardian VS Code extension | 10,839 | 39 | Even a security brand only gets ~11k installs |
| Leak Lock (scan + rewrite, MIT) | 46 Marketplace / 1,069 downloads / 7,455 Open VSX | **1** | Downloads ≠ stars; the repo was never promoted |
| SecretStack | 270 | 11 | A scanner alone does not travel |
| SecretGuard | 14 | 0 | Same |
| Docker Vitals (your listing, `ps-aditya.docker-vitals`) | **17** | — | Shipping is not distribution |
| gitleaks | — | 30,559 | Stars come from developers who see the repo, not the Marketplace |
| TruffleHog | — | 28,811 | Same |

**Three conclusions:**

1. **The Marketplace is not a distribution channel by itself.** Search traffic gets you tens or hundreds of installs, not thousands. You need external traffic.
2. **Installs do not create stars.** Leak Lock has thousands of downloads and one star. Stars come from HN, Lobsters, Reddit, GitHub Trending, and awesome lists — people who see the *repo*, not the listing.
3. **A "Show HN: my security tool" usually flops.** In 2026, most Show HN security tools got 1–20 points. What hits the front page is a **finding**, a **demo**, or a **visceral story**:
   - "GitLab critical patch release" — 406 points
   - "My security camera shipped a GitHub admin token in its login page" — 645 points
   - "Google API keys weren't secrets, but then Gemini changed the rules" — 1,291 points
   - Aikido's "Send GitLab an email, push to main" — **2 points**

**So the launch asset is not the extension. It is the story/demo that makes people want the extension.**

---

## 1. Fix the narrative: GitLens ≠ GitLab

Your proposed resume line says **"Reversed Engineered a fix for Git Lens leaks."** That is not accurate, and a security-literate interviewer will catch it.

What is true:

- **GitLens** is a Git UI extension by GitKraken (53M installs). Its only real CVE is **CVE-2023-46944** (workspace-trust RCE, fixed in GitLens 14.0.0, 2023).
- There is a **fake/misattributed "CVE-2026-54321 GitLens"** floating around in a GitHub README; the actual CVE-2026-54321 is a Daytona sandbox auth bypass. Do not use it.
- The 2026 leaks are **GitLab** (CVE-2026-85706, 97229, 110264, the `glimt-` incoming-email token) and **Git repositories generally** (secrets in history), plus the **VS Code folder-open malware** chain (GhostAction/PolinRider).

**Correct, stronger framing:**

> "Reverse-engineered the **GhostAction/PolinRider VS Code folder-open loader** and **GitLab's `glimt-` token**, then shipped a free scanner/fix."

That is specific, verifiable, and technically impressive. "GitLens leaks" is a confusion that will hurt you.

---

## 2. The hook: pick the story that travels

You have three possible stories. Pick one as the spearhead, keep the others as follow-ups.

### Hook A — "Your repo can own your laptop when you open it in VS Code" (recommended)

**Why it wins:**

- Universal: every developer uses VS Code.
- Visual: a fake `.woff2` font that is actually a Node.js stealer, plus a hidden `.vscode/tasks.json` task with `"runOn": "folderOpen"`.
- Timely: GhostAction pushed **72,026 commits across 22,964 repos**; **17,667 repos** carried the folder-open stealer; **cleaning the repo does not remove the cron job**.
- It is a **finding**, not a product pitch. HN and press can cover it without feeling marketed to.
- It naturally leads to the product: a free scanner + fix workflow.

**HN title candidates:**

1. `A repo can run a credential stealer when you open it in VS Code`
2. `We found 17,000 repos that run code when you open them in VS Code`
3. `The fake font that steals your AWS keys when you open a repo`
4. `VS Code's Workspace Trust is not enough: the folder-open malware wave`

**Caveat to state clearly:** the task runs only after the workspace is trusted. The story is that "trust" is a one-click decision users make all day, and the malicious task hides in a normal-looking repo. Do not overclaim "zero-click."

### Hook B — "GitLab's leak isn't the CVE; it's the token that never expires"

**Why it works:** timely, concrete, and product-relevant (`glimt-` token, account-wide, non-expiring, bypasses IP allow-lists). But Aikido's original post got **2 points** on HN, so this needs a new angle:

- `We scanned X public repos for GitLab's glimt tokens — here's what we found` (original data; ethical caveats below).
- `GitLab's own secret detection misses the glimt token` (technical teardown + scanner).
- `The 64% problem: leaked tokens are still valid years later` (data-driven, broader).

### Hook C — "64% of leaked secrets still work"

**Why it works:** broad, scary, data-backed (GitGuardian 2026). But it needs original verification data to be HN-worthy; otherwise it is a recap.

**Recommendation:** lead with **Hook A**, use **Hook B** as the second post/press angle, and **Hook C** as a newsletter/SEO piece.

---

## 3. The product shape that maximizes distribution

Do **not** launch the full incident-response wizard first. Launch a **10-second safety check**.

### Free CLI (the star magnet)

```bash
npx repo-trust scan .
```

Output:

```
Repo Trust — scanned 412 files, 1,284 commits

CRITICAL  .vscode/tasks.json
          hidden task "eslint-check" runs on folderOpen
          command: node ./public/fonts/fa-solid-400.woff2
          → this file is a Node.js script, not a font

HIGH      README.md:42
          GitLab incoming-email token (glimt-…7f3a)
          → account-wide, non-expiring; can push code and run CI

2 findings. Run `npx repo-trust fix` for the remediation plan.
```

- One command, no config, no account, no telemetry.
- Works in CI (`repo-trust scan --ci`).
- The README is the star magnet; the extension is the install magnet.

### VS Code extension (the install magnet)

- On open: scans for folder-open tasks, fake assets, hooks, dangerous `.git/config`, CI patterns, leaked tokens.
- Warning before tasks run: **"This repo contains a hidden task that runs when the folder opens."**
- Buttons: Inspect / Quarantine / Disable task / Open in Restricted Mode.
- The full fix workflow (revoke/rotate/purge/verify/report) is the **phase 2** upsell/retention feature, not the launch story.

### Demo repo (the shareable artifact)

A safe, public repo that contains:
- A fake "font" that is a harmless Node.js script (prints a message, does not exfiltrate).
- A hidden `.vscode/tasks.json` folder-open task.
- A fake `glimt-` token in a README (clearly fake, non-functional).
- A `DETECTION.md` explaining what the scanner catches.

People can clone it, run the scanner, and see the warning. This is what you link in HN comments, Reddit posts, and the README.

> Do **not** publish a real credential stealer or a live token. Make the fixture safe and obviously fake.

---

## 4. The assets to build before launch

| Asset | Purpose | Effort |
|---|---|---|
| CLI repo (`repo-trust`) | GitHub stars, HN/Lobsters link, CI users | 3–5 days |
| VS Code extension | Installs, Marketplace reviews | 1–2 weeks |
| Demo repo | Shareable proof, safe test | 1 day |
| Blog post | HN/press hook; SEO | 1–2 days |
| Landing page + waitlist | Capture emails before launch | 1 day |
| 45-second demo video | Product Hunt, X, landing page | 1 day |
| Press kit | Journalists, newsletters | 1 day |
| README with badges, GIF, comparison | Conversion from repo to install | 1 day |

**Minimum viable launch:** CLI + demo repo + blog post + landing page. The extension can follow 1–2 weeks later, but the CLI is what gets stars and press.

---

## 5. The 90-day calendar

### Week -4 to -3: Build the audience before the product

- Publish a landing page: "The 10-second safety check before you open a repo." Email capture.
- Start posting build-in-public updates on X/LinkedIn/Bluesky: the fake font, the hidden task, the scanner output.
- Write the technical blog post (draft): "A repo can run code when you open it in VS Code."
- Create the demo repo and a 30-second screen recording.
- Collect 100–300 emails before launch.

### Week -2: Soft launch

- Ship the CLI v0.1.0 to npm/GitHub.
- Give it to 20–50 developers; ask for false positives and broken repos.
- Fix the top 10 issues; add a `--json` output and a GitHub Action.
- Submit to **Console.dev** (`hello@console.dev`) and **VSCode.Email** (DM @LouisLazaris) early; they plan weeks ahead.
- Draft the Product Hunt assets.

### Week 0: The launch window

**Day 1 (Tuesday or Wednesday):**
- Publish the blog post at 8:00am ET.
- Submit to HN at 8:30–9:30am ET (title from Hook A).
- Post to Lobsters, r/netsec (research angle, disclose affiliation), r/vscode, r/devops, r/git.
- Post on X/Bluesky/LinkedIn with the demo video.
- Email the waitlist.

**Day 2:**
- Respond to HN/Reddit comments all day.
- Publish a follow-up comment with methodology, limitations, and the demo repo.
- Pitch press (see §7).

**Day 3–5:**
- Product Hunt launch (Tuesday–Thursday the following week is usually better than same-week; do not launch PH and HN on the same day).
- Submit to newsletters (TLDR, DevOps'ish, Security Weekly, Changelog, Hacker Newsletter).
- Open PRs to awesome lists.

### Week +1 to +2: Compound

- Publish a "what we learned scanning 1,000 repos" follow-up (if you have ethical, aggregate data).
- Add 10 new detections based on feedback.
- Publish a case study: "How we fixed a leaked GitLab token in 11 minutes."
- Ask for Marketplace reviews after successful scans.
- Update the README with install counts and testimonials.

### Week +3 to +8: SEO and community

- Comparison pages: "Repo Trust vs gitleaks", "Repo Trust vs TruffleHog", "Repo Trust vs Leak Lock".
- "How to remove a secret from Git history" guide (SEO).
- "GitLab glimt token: what it is and how to fix it" guide (SEO).
- Conference/meetup lightning talk.
- Monthly release cadence; each release is a GitHub notification.

---

## 6. Hacker News playbook

### What works

- Original research, a concrete finding, or a visceral demo.
- A title that states the finding, not the product.
- A first comment with methodology, caveats, and a link to the demo.
- Fast, substantive replies for the first 3 hours.

### What doesn't

- "Show HN: I built a security tool" with no story.
- Marketing language ("revolutionary", "seamless", "AI-powered").
- Asking for upvotes, vote rings, or botting.
- Reposting the same URL after it flops.

### Timing

- Tuesday–Thursday, 8:00–10:00am ET.
- Avoid Mondays (catch-up), Fridays (low attention), and major security-news days (you'll be buried).
- Check HN's front page before submitting; if there are already 2–3 security stories, wait.

### Title rules

- Under ~80 characters.
- No clickbait, no "you won't believe."
- State the finding or the demo.
- Use "Show HN:" only if the URL is your own project and the project is the point. For a research post, use a normal title.

### First comment template

```
Author here. I built this because GitHub's workflow hold doesn't cover
.vscode/tasks.json — the payload runs on the developer machine, not in CI.

What we found: [1–2 concrete numbers, with source].
How the detection works: [2–3 sentences, no marketing].
Limitations: Workspace Trust must be granted; we only catch known patterns;
false positives are possible; this is not a sandbox.
Demo repo (safe, fake payload): [link]
Scanner: [link]
Happy to answer questions about the detection rules or the incident response.
```

### If it doesn't hit the front page

- Do not repost immediately.
- Turn the post into a Lobsters/Reddit/dev.to piece.
- Try a different angle in 2–4 weeks (e.g., the GitLab token story, or a data follow-up).
- HN is a lottery with skill; one strong post is enough.

---

## 7. Product Hunt playbook

### Reality

- October 2026 developer tools: **median 83 upvotes**, **#1 median 319**, top launch 452.
- A niche security tool can realistically get **100–250 upvotes** and a **top-5 Developer Tools** finish with a good launch.
- PH drives a burst of traffic and a badge; it does not replace HN or installs.

### Assets

- 240×240 logo (distinct, no Git logo).
- 5–7 gallery images at 1270×760:
  1. The fake font / hidden task diff.
  2. The warning dialog.
  3. The scan results.
  4. The fix workflow.
  5. The report.
- 30–60 second demo video (screen recording, captions).
- Tagline < 60 chars: **"Stop a repo from stealing your credentials."**
- Description: 3 short paragraphs; problem, demo, free/open-source.
- First comment: personal story, why you built it, what's free, ask for feedback.

### Launch day

- 12:01am PT (PH resets at midnight PT).
- Post in PH forums, relevant Slack/Discord communities, X, LinkedIn.
- Email your list at 6:00am PT with a direct link.
- Respond to every comment within 30 minutes.
- Do not buy upvotes or join vote pods; PH penalizes it.

### Hunter

- A hunter with security/dev followers helps, but self-hunting is fine.
- Ask 5–10 people who genuinely use the tool to leave a comment, not just an upvote.
- Do not ask for "upvote and I'll upvote yours."

---

## 8. Press playbook

### The pitch is a finding, not a product

Journalists cover incidents, vulnerabilities, and data. They rarely cover "a new extension." Lead with:

> "A free tool that detects the VS Code folder-open credential stealer behind 17,000+ compromised repos — and the GitLab token leak that started it."

### Outlets and angles

| Outlet | Angle |
|---|---|
| **The Hacker News** | "Free scanner detects GhostAction/PolinRider folder-open stealer" |
| **BleepingComputer** | "VS Code repos can run credential stealers when opened; new tool detects them" |
| **The Register** | "Your repo is a malware delivery system; here's a scanner" (wry) |
| **Cybernews** | "17,000 repos carried a fake font that steals cloud keys" |
| **SecurityWeek** | "Developer endpoint security: the folder-open attack surface" |
| **Help Net Security** | "Free tool scans for malicious VS Code tasks and leaked tokens" |
| **DevOps.com** | "The GitLab leak wave and the last mile of remediation" |
| **The New Stack** | "VS Code's Workspace Trust gap" |
| **InfoWorld** | "How to check a repo before you open it" |
| **TechCrunch** | Only if you have a startup/company angle; not for a solo tool |

### Pitch email template

```
Subject: Free scanner for the VS Code folder-open stealer (17k+ repos)

Hi [name],

I'm [name], a developer who built [tool]. I saw your coverage of [specific
article] and thought this follow-up might be useful.

GhostAction/PolinRider pushed 72,026 commits across 22,964 repos in October;
17,667 carried a fake font plus a hidden .vscode/tasks.json task that runs a
credential stealer when the folder is opened. GitHub's workflow hold doesn't
apply because no workflow is involved.

I built a free, local-first scanner that detects the folder-open task, the
fake asset, the hooks/config patterns, and leaked GitLab tokens. Demo repo
(safe, fake payload): [link]. 45-second video: [link].

I can share the detection methodology, a quote, or a demo. No embargo needed,
but I can give you first look if you want it.

Thanks,
[name]
[link] · [GitHub] · [X]
```

### Rules

- Personalize the first line; reference their recent coverage.
- Keep it under 150 words.
- One follow-up after 3–4 days; then stop.
- Offer an exclusive only if they ask; otherwise, broad outreach.
- Never send live tokens, private data, or unredacted victim names.
- Have a press kit page with logo, screenshots, founder bio, and links.

---

## 9. GitHub stars playbook

### The repo is the product

- Name: `repo-trust` (or `leakfix`), short and searchable.
- Description: "Scan a repo for malicious folder-open tasks, fake assets, and leaked credentials before you open it."
- Topics: `security`, `vscode`, `vscode-extension`, `git`, `secrets`, `devsecops`, `supply-chain`, `malware`, `scanner`.
- License: MIT (or Apache-2.0).
- Social preview image: the fake font vs. the task JSON.

### README first screen

1. Badges: npm version, downloads, CI, license, stars.
2. One-liner.
3. Demo GIF (terminal scan of the malicious fixture).
4. Install: `npx repo-trust scan .`
5. "What it catches" table.
6. "Why this matters" with 3 sourced stats.
7. "VS Code extension" link.
8. "GitHub Action" snippet.
9. "How it works / no telemetry / local-first."
10. "Star the repo" CTA at the end.

### Star mechanics

- Every HN/Lobsters/Reddit post links to the repo, not the Marketplace.
- Add a "Star" badge and a "Star History" chart.
- Release weekly; each release notifies watchers.
- Write `CONTRIBUTING.md`, `SECURITY.md`, and 5 `good first issue`s.
- Submit PRs to awesome lists (one per week, not spam):
  - `awesome-vscode`
  - `awesome-security`
  - `awesome-devsecops`
  - `awesome-git`
  - `awesome-secret-scanning`
  - `awesome-static-analysis`
- Create a GitHub Action; every repo that uses it is a backlink.
- Cross-post to dev.to with a canonical link to the blog.

---

## 10. Install playbook (Marketplace + Open VSX)

### Listing

- **Name:** `Repo Trust — VS Code Malware & Secret Scanner` (keywords in the name).
- **Short description:** "Stops malicious folder-open tasks and finds leaked credentials before they spread."
- **Categories:** Security, Other.
- **Tags:** security, git, secrets, malware, devsecops, supply-chain.
- **Icon:** distinct, no orange Git diamond, no GitLab fox.
- **Screenshots:** warning, scan results, fix wizard, report.
- **README:** keyword-rich but honest; include the CLI link and demo repo.

### Distribution

- **Open VSX first** (as with Docker Vitals), then Marketplace once.
- Submit to **VSCode.Email** (DM @LouisLazaris) — it features 10–20 links per issue.
- Submit to **Console.dev** (`hello@console.dev`) — 2–3 tools per week, developer-focused, CLI/API friendly.
- Submit to **TLDR** (editorial tip; TLDR InfoSec has ~400k subscribers) and **DevOps'ish**, **Changelog**, **Hacker Newsletter**, **Security Weekly**.
- Add a "Rate this extension" prompt after a successful scan; respond to every review.
- Publish weekly updates; the Marketplace rewards active extensions.

### Conversion

- First run must work in under 10 seconds, with no config.
- If the user has no findings, show a clear "clean" result with coverage (files/commits scanned) — trust is the product.
- If the user has findings, show the warning first, then the fix.
- Do not ask for an account, email, or telemetry.

---

## 11. Channels and submission methods

| Channel | How | Expected impact |
|---|---|---|
| Hacker News | https://news.ycombinator.com/submit | Biggest spike; 1–3 days of traffic; stars |
| Lobsters | https://lobste.rs/submit | Smaller but high-quality; stars |
| Reddit r/netsec | Text post, disclose affiliation, no product link in title | Security credibility; careful with rules |
| Reddit r/vscode | "I built this" flair; demo video | Installs |
| Reddit r/devops, r/git, r/programming | Story first, link in comments | Variable |
| Product Hunt | https://www.producthunt.com/posts/new | Badge, burst, press |
| Console.dev | `hello@console.dev` | "Featured on Console.dev" |
| VSCode.Email | DM @LouisLazaris on X/Bluesky | Installs |
| TLDR | Editorial tip / advertise | Huge reach; hard to get |
| DevOps'ish | Weekly newsletter | DevOps audience |
| Changelog | https://changelog.com/contact | Dev tools audience |
| Hacker Newsletter | Curates HN | Second wave |
| Security Weekly | https://securityweekly.com/contact/ | Security audience |
| tl;dr sec | Newsletter | Security audience |
| GitHub Trending | Stars in a short window + topics + README | Stars, installs |
| Awesome lists | PRs | Long-tail stars/installs |
| Dev.to / Hashnode | Cross-post with canonical link | SEO |
| YouTube | 2–5 minute demo | Trust, PH asset |
| Meetups / DevOpsDays | Lightning talk | Local credibility |

> Verify every URL/email before sending; they change.

---

## 12. Metrics and targets

### Track weekly

- Installs: Marketplace, Open VSX.
- Downloads: npm, GitHub releases.
- GitHub: stars, forks, watchers, traffic (referrers), clones.
- Landing page: visitors, waitlist signups, conversion.
- GitHub Action: repos using it.
- HN/Lobsters/Reddit: points, comments, referral traffic (UTM).
- Product Hunt: upvotes, comments, rank.
- Press/newsletters: mentions, referrals.
- Reviews/ratings: count and average.

### Targets (be honest, not delusional)

| Tier | Installs | Stars | Press/feature |
|---|---:|---:|---|
| Minimum viable | 1,000 | 100 | 1 newsletter |
| Strong | 5,000 | 500 | Console.dev or VSCode.Email; 100+ PH upvotes |
| Excellent | 15,000 | 1,500 | HN front page; PH top 5; 1–2 articles |
| Exceptional | 50,000 | 5,000 | HN top 5; PH #1; THN/Register coverage |

**Build the resume line at "Strong/Excellent," not "Exceptional."** The upper tiers are upside, not a plan.

---

## 13. Resume line templates (accurate)

### If the product is the scanner + fix workflow

> "Built and launched **Repo Trust**, a free VS Code extension + CLI that detects malicious folder-open tasks and leaked Git credentials (GitLab `glimt-` tokens, PATs, cloud keys) before they spread. **12,000+ installs**, **1,200+ GitHub stars**, Hacker News front page, Product Hunt top 5."

### If you want the "reverse-engineered" phrasing

> "Reverse-engineered the **GhostAction/PolinRider VS Code folder-open loader** and **GitLab's `glimt-` incoming-email token**, then shipped an open-source scanner/fix with **12,000+ installs** and **1,200+ GitHub stars**."

### If the product is the fix layer

> "Created the remediation layer for the 2026 GitLab credential leaks: a local-first VS Code extension that revokes, rotates, purges, and verifies leaked tokens. **10,000+ installs**, featured on **Console.dev** and **VSCode.Email**."

### What not to write

- ❌ "Reversed Engineered a fix for GitLens leaks" — GitLens is not the leak; this is a factual error.
- ❌ "10x developer" / "revolutionary" — no.
- ❌ Unverifiable "featured on" claims — keep screenshots/links.

---

## 14. Ethics and risk

### If you scan public repos

- Do not scan private repos.
- Do not use, validate, or publish live tokens.
- Do not name victims without consent.
- Redact everything; report aggregate counts only.
- Respect GitHub/GitLab rate limits and ToS.
- Have a disclosure policy and a 90-day window for vendors.
- If you publish a prevalence study, have a security reviewer check the methodology and a lawyer check the disclosure.

### If you publish a malicious fixture

- Make the payload harmless (print a message, no network).
- Clearly label it as fake in the README.
- Do not include real C2 domains/IPs or live credentials.
- Include a `SAFETY.md` explaining the fixture.

### If you build a security extension

- No telemetry by default.
- No secret exfiltration; sign builds; publish checksums.
- Do not overclaim ("prevents all attacks").
- Disclose limitations (Workspace Trust, false positives, coverage).

---

## 15. The next 14 days (do this first)

1. **Day 1:** Buy the domain, create the landing page with email capture. Copy: "Your repo can run code when you open it in VS Code. Check it in 10 seconds."
2. **Day 2:** Create the demo repo (fake font + hidden task + fake `glimt-` token) and a 30-second screen recording.
3. **Day 3–5:** Build the CLI scanner (`npx repo-trust scan .`) with 6 detections: folderOpen tasks, fake assets, hooks, `.git/config`, CI patterns, leaked tokens.
4. **Day 6:** Write the blog post. Title: "A repo can run a credential stealer when you open it in VS Code."
5. **Day 7:** Ship the CLI to GitHub + npm; add README, topics, license, SECURITY.md.
6. **Day 8:** Soft-launch to 20 developers; collect false positives.
7. **Day 9–10:** Fix issues; add `--json` and a GitHub Action.
8. **Day 11:** Submit to Console.dev and VSCode.Email.
9. **Day 12:** Prepare HN/PH/press copy (use `launch-copy.md`).
10. **Day 13:** Publish the blog post; submit to HN/Lobsters/Reddit.
11. **Day 14:** Product Hunt + press outreach; measure and iterate.

The extension can be built in parallel, but the CLI + story is what gets you the resume line.

---

## 16. One-sentence strategy

**Lead with a visceral, verifiable finding ("a repo can run code when you open it in VS Code"), give away a 10-second CLI, let HN/Lobsters/Reddit and Product Hunt drive stars and installs, then convert that attention into the full fix workflow.**
