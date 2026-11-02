# Demo: a repo that runs code when you open it

This repository is a **safe demo** for `repo-trust`. It contains the same shape as the GhostAction/PolinRider VS Code folder-open attack, but the payload is harmless.

## What is in here

- `.vscode/tasks.json` â€” a hidden task named `eslint-check` that runs on folder open:
  `node ./public/fonts/fa-solid-400.woff2`
- `public/fonts/fa-solid-400.woff2` â€” not a font. A harmless Node.js script that prints a message.
- `.github/workflows/security-audit.yml` â€” a workflow with a suspicious `curl | bash` string inside an `echo` (not executed).
- Fake credentials below, used to test the scanner. **They are not valid.**

## Fake credentials (do not use)

```text
GitLab incoming email token: glimt-DEMO000000000000000000000000
GitHub token:                ghp_DEMO00000000000000000000000000000000
AWS access key:              AKIADEMO000000000000
```

## Try the scanner

```bash
npx repo-trust scan .
```

You should see:

- a **critical** finding for the hidden folder-open task that runs a script disguised as a font;
- a **critical** finding for the fake `glimt-` token;
- findings for the other fake credentials and the CI workflow.

## Safety

See [SAFETY.md](./SAFETY.md). Nothing in this repository reads credentials, makes network requests, or installs persistence.

