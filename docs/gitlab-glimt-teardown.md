# GitLab `glimt-` incoming-email token: technical teardown

**Status:** Analysis based on Aikido Security's September 2026 disclosure and GitLab's public documentation. It is not an independent exploit of a live instance.  
**Purpose:** Explain the credential model well enough to detect and remediate it.

---

## 1. The address format

GitLab gives users an address for filing work items by email:

```text
incoming+<project-path>-<project-id>-glimt-<token>-issue@incoming.gitlab.com
```

Example:

```text
incoming+group-project-12345678-glimt-AbCdEfGhIjKlMnOp-issue@incoming.gitlab.com
```

The `glimt-` segment is the credential.

GitLab also supports a `-merge-request` suffix. The same token is used.

---

## 2. Why it is a credential, not an email address

| Property | Behavior |
|---|---|
| Scope | Account-wide. The same `glimt-` token appears in every project's address, public or private. |
| Expiry | None. The token does not expire. |
| Sender check | None. GitLab processes the message as the token owner regardless of the `From` address. |
| Transport | Inbound email. It is not subject to the project's IP allow-list. |
| Permissions | Inherits the owner's role: create issues/MRs, push code, run CI, read CI variables, access private projects. |
| Revocation | Manual reset only. There is no bulk revoke and no admin notification. |

The UI historically described the address as project-scoped and said it "cannot be used to access any other data." GitLab later updated the text to mention merge requests and to document that incoming email is not subject to IP restrictions. The underlying mechanism was unchanged.

---

## 3. The attack path

1. The victim publishes or leaks a project's incoming-email address — in a README, a contributing guide, a support page, a CI log, or a screenshot.
2. The attacker changes `-issue` to `-merge-request`.
3. The attacker writes a `.patch` that adds a job to `.gitlab-ci.yml`.
4. The attacker emails the patch, naming the source branch in the subject.
5. GitLab commits the patch as the victim and runs the job.

The attacker does not need repository write access, a fork, or knowledge of the codebase. They need the address.

### Why the network boundary does not help

A project can be restricted to a single IP address. GitLab will block the browser and reject `git clone` from anywhere else. It will still accept the inbound email, because the mail path is not evaluated against the project's IP allow-list.

### Why 2FA does not help

The token is already authenticated. 2FA protects the login flow, not the email-to-project flow.

---

## 4. Blast radius

A leaked address can reach:

- every project the account can access, public or private;
- protected branches, if the owner's role allows it;
- CI/CD variables and `CI_JOB_TOKEN`;
- confidential issues and merge requests;
- other integrations reachable with the job token.

The attacker's permissions are bounded by the victim's role. A Guest address is low value; a Maintainer or Owner address is critical.

---

## 5. Detection

The token pattern is stable enough to scan for:

```regex
\bglimt-[A-Za-z0-9_-]{10,}\b
```

The full address pattern:

```regex
incoming\+[^@\s]+-glimt-[A-Za-z0-9_-]+-(?:issue|merge-request)@incoming\.gitlab\.com
```

Scan:

- the working tree (README, CONTRIBUTING, docs, support pages);
- the full git history (the address may have been removed from `HEAD`);
- CI configuration and logs;
- issue and merge request templates;
- wiki pages and snippets.

`repo-trust` implements both patterns and masks the token in output.

---

## 6. Remediation

1. **Reset the token.** GitLab → User settings → Personal access tokens → Incoming email token → Reset. This invalidates every project address for the account.
2. **Remove the address from every public surface.** README, docs, support pages, issue templates, CI logs, screenshots.
3. **Audit recent activity.** Check commits and pipeline runs for actions the owner did not perform.
4. **Rotate anything reachable from the account.** CI variables, deploy keys, integration tokens.
5. **Purge the address from history** if it was committed. Use a backup and `git filter-repo`; force-push every branch and tag; re-scan.
6. **Add a detection rule** for `glimt-` and `incoming.gitlab.com` to your secret scanning.

---

## 7. Limitations

- This teardown does not include a live exploit against a GitLab instance.
- GitLab may change the address format or add sender verification.
- The token is only dangerous if it is exposed; a private, unpublished address is still a credential, but the attack requires access.
- Resetting the token invalidates every project address for the account, which can break legitimate email workflows.

---

## 8. References

- Aikido Security, "Send GitLab an email, push to main": https://www.aikido.dev/blog/gitlab-email-push-to-main
- GitLab incoming email documentation: https://docs.gitlab.com/administration/incoming_email/
- GitLab personal access tokens: https://docs.gitlab.com/user/profile/personal_access_tokens/
- GitLab 19.5.1 security release: https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-5-1-released/
