# Security policy

## Reporting a vulnerability

If you find a security issue in `git-triage`, please do not open a public issue.

Email: [your email]

Include:

- a description of the issue,
- steps to reproduce,
- the affected version,
- any suggested fix.

I will acknowledge within 72 hours and aim to ship a fix within 14 days for critical issues.

## Scope

In scope:

- false negatives that let a known malicious pattern pass,
- code execution or path traversal in the scanner,
- secret leakage in logs, JSON, reports, or telemetry,
- dependency vulnerabilities.

Out of scope:

- the security of repositories you scan,
- the behavior of VS Code's Workspace Trust,
- vulnerabilities in third-party tools the scanner invokes.

## Safe harbor

Good-faith research on your own repositories is welcome. Do not scan private repositories you do not own, do not use live credentials, and do not publish unredacted secrets.
