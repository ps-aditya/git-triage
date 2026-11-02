# Demo: a repo that runs code when you open it

This repository is a **safe demo** for **Git Triage**. It contains the same shape as the GhostAction/PolinRider VS Code folder-open attack, but the payload is harmless.

## What is in here

- `.vscode/tasks.json.example` — a hidden task named `eslint-check` that runs on folder open:
  `node ./public/fonts/fa-solid-400.woff2`. It is shipped as `.example` so antivirus does not quarantine it and VS Code does not run it by accident.
- `public/fonts/fa-solid-400.woff2` — not a font. A harmless Node.js script that prints a message.
- `.github/workflows/security-audit.yml` — a workflow with a suspicious `curl | bash` string inside an `echo` (not executed).
- Fake credentials below, used to test the scanner. **They are not valid.**

## Enable the demo task

```powershell
pwsh ./enable-demo.ps1
```

or:

```sh
sh ./enable-demo.sh
```

This copies `.vscode/tasks.json.example` to `.vscode/tasks.json`. The payload is harmless, but the task will run on folder open. Disable it when you are done:

```powershell
pwsh ./disable-demo.ps1
```

## Fake credential (do not use)

```text
GitLab incoming email token: glimt-DEMO000000000000000000000000
```

## Try the scanner

```bash
npx git-triage scan .
```

You should see:

- a **critical** finding for the hidden folder-open task that runs a script disguised as a font;
- a **critical** finding for the fake `glimt-` token;
- findings for the CI workflow.

## Safety

See [SAFETY.md](./SAFETY.md). Nothing in this repository reads credentials, makes network requests, or installs persistence.
