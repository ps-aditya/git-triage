import type { Severity } from "./types.js";

export interface SecretRule {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  regex: RegExp;
  provider: string;
  remediation: string;
}

export const SECRET_RULES: SecretRule[] = [
  {
    id: "gitlab-incoming-email-token",
    severity: "critical",
    title: "GitLab incoming email token",
    description:
      "Account-wide, non-expiring token hidden inside a GitLab issue-by-email address.",
    regex: /\bglimt-[A-Za-z0-9_-]{10,}\b/g,
    provider: "GitLab",
    remediation:
      "Reset it at GitLab → User settings → Personal access tokens → Incoming email token (https://gitlab.com/-/user_settings/personal_access_tokens). This invalidates every project address for the account. Then check recent commits and pipeline runs for actions you did not perform.",
  },
  {
    id: "gitlab-incoming-email-address",
    severity: "critical",
    title: "GitLab incoming email address",
    description:
      "The address embeds a glimt token that can create issues and merge requests, push code, and run CI as the owner.",
    regex:
      /incoming\+[^@\s]+-glimt-[A-Za-z0-9_-]+-(?:issue|merge-request)@incoming\.gitlab\.com/gi,
    provider: "GitLab",
    remediation:
      "Treat the address as a credential. Reset the incoming email token, remove the address from docs, and audit recent activity.",
  },
  {
    id: "gitlab-pat",
    severity: "critical",
    title: "GitLab personal access token",
    description: "A GitLab PAT can read and write projects, CI variables, and more.",
    regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
    provider: "GitLab",
    remediation:
      "Revoke it at GitLab → User settings → Personal access tokens. Rotate any CI variable that used it.",
  },
  {
    id: "gitlab-token",
    severity: "critical",
    title: "GitLab token",
    description: "A GitLab token (runner, deploy, feature flag, or OAuth).",
    regex: /\bgl(?:rt|cbt|ptt|dt|soat|ffct)-[A-Za-z0-9_-]{20,}\b/g,
    provider: "GitLab",
    remediation:
      "Revoke the token in GitLab settings and rotate the dependent pipeline or integration.",
  },
  {
    id: "github-fine-grained-pat",
    severity: "critical",
    title: "GitHub fine-grained PAT",
    description: "A GitHub fine-grained personal access token.",
    regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
    provider: "GitHub",
    remediation:
      "Revoke it at GitHub → Settings → Developer settings → Personal access tokens. Rotate any workflow secret that used it.",
  },
  {
    id: "github-pat",
    severity: "critical",
    title: "GitHub token",
    description: "A classic GitHub personal access token or app token.",
    regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
    provider: "GitHub",
    remediation:
      "Revoke it at GitHub → Settings → Developer settings → Personal access tokens. Check recent repository and workflow activity.",
  },
  {
    id: "aws-access-key",
    severity: "critical",
    title: "AWS access key",
    description: "An AWS IAM access key ID.",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    provider: "AWS",
    remediation:
      "Deactivate the key in IAM immediately, then delete it. Review CloudTrail for unauthorized calls and rotate dependent credentials.",
  },
  {
    id: "npm-token",
    severity: "high",
    title: "npm token",
    description: "An npm registry token that can publish or read private packages.",
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
    provider: "npm",
    remediation:
      "Revoke it with `npm token revoke <id>` or in the npm dashboard. Rotate any CI secret that used it.",
  },
  {
    id: "anthropic-key",
    severity: "high",
    title: "Anthropic API key",
    description: "An Anthropic API key.",
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
    provider: "Anthropic",
    remediation:
      "Revoke it in the Anthropic console and rotate the application configuration.",
  },
  {
    id: "openai-key",
    severity: "high",
    title: "OpenAI API key",
    description: "An OpenAI API key.",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    provider: "OpenAI",
    remediation:
      "Revoke it in the OpenAI dashboard and rotate the application configuration.",
  },
  {
    id: "ssh-private-key",
    severity: "critical",
    title: "SSH private key",
    description: "A private key committed to the repository.",
    regex: /-----BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/g,
    provider: "SSH",
    remediation:
      "Remove the key from every authorized_keys file and provider account, generate a new key, and purge the old one from history.",
  },
];

export const SUSPICIOUS_TASK_COMMAND =
  /\b(?:node|deno|bun|python|python3|powershell|pwsh|cmd|mshta|rundll32|certutil|curl|wget|bash|sh|zsh|eval|exec)\b/i;

export const SCRIPT_INDICATORS: RegExp[] = [
  /^#!.*\b(?:node|bash|sh|zsh|python)\b/m,
  /\brequire\s*\(/,
  /\bimport\s+[\w{*"']/,
  /\bchild_process\b/,
  /\bexec(?:Sync|File)?\s*\(/,
  /\bspawn\s*\(/,
  /\bfetch\s*\(/,
  /\bhttps?:\/\//,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bprocess\.env\b/,
];

export const NETWORK_INDICATORS: RegExp[] = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bfetch\s*\(/i,
  /\bhttps?:\/\//i,
  /\bnc\s+-/i,
  /\bnetcat\b/i,
];

export interface CiPattern {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  regex: RegExp;
}

export const CI_PATTERNS: CiPattern[] = [
  {
    id: "ci-curl-pipe-shell",
    severity: "high",
    title: "Remote script piped to a shell",
    message: "A CI step downloads a remote script and pipes it directly to a shell.",
    regex: /\b(?:curl|wget)\b[^\n|]{0,240}\|\s*(?:ba|z|k|da)?sh\b/i,
  },
  {
    id: "ci-base64-exec",
    severity: "high",
    title: "Base64-decoded code executed",
    message: "A CI step decodes base64 and executes the result.",
    regex: /\bbase64\s+(?:-d|--decode)\b[^\n]{0,160}\|\s*(?:ba|z|k|da)?sh\b/i,
  },
  {
    id: "ci-token-exfil",
    severity: "critical",
    title: "CI token sent over the network",
    message:
      "A CI step references a CI token and a network command on the same line.",
    regex:
      /\b(?:GITHUB_TOKEN|CI_JOB_TOKEN|CI_REGISTRY_PASSWORD|NPM_TOKEN|AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)\b[^\n]{0,240}\b(?:curl|wget|http|https|nc|netcat)\b/i,
  },
  {
    id: "ci-history-grep",
    severity: "high",
    title: "CI job greps the full git history for secrets",
    message:
      "A CI step searches the working tree or full history for credentials, a common exfiltration pattern.",
    regex:
      /\b(?:git\s+log|git\s+grep|grep\s+-r)[^\n]{0,160}\b(?:AWS_|GITHUB_TOKEN|CI_JOB_TOKEN|ANTHROPIC|OPENAI|npm_|glpat-|glimt-)/i,
  },
  {
    id: "ci-self-hosted",
    severity: "medium",
    title: "Self-hosted runner",
    message:
      "A job runs on a self-hosted runner. A malicious workflow can persist on the runner.",
    regex: /runs-on:\s*\[?[^\n]*self-hosted/i,
  },
  {
    id: "ci-pull-request-target",
    severity: "medium",
    title: "pull_request_target trigger",
    message:
      "pull_request_target runs with a privileged token; it is a common supply-chain attack surface.",
    regex: /\bpull_request_target\b/i,
  },
  {
    id: "ci-secrets-inherit",
    severity: "medium",
    title: "Workflow inherits all secrets",
    message: "A reusable workflow inherits every caller secret.",
    regex: /\bsecrets:\s*inherit\b/i,
  },
  {
    id: "ci-write-all",
    severity: "medium",
    title: "Workflow has write-all permissions",
    message: "The workflow grants write-all permissions to its token.",
    regex: /\bpermissions:\s*write-all\b/i,
  },
];

export const DANGEROUS_GIT_CONFIG_KEYS: Array<{
  section: string;
  key: string;
  severity: Severity;
  reason: string;
}> = [
  {
    section: "core",
    key: "fsmonitor",
    severity: "high",
    reason: "core.fsmonitor can execute a command on file-system events.",
  },
  {
    section: "core",
    key: "sshcommand",
    severity: "high",
    reason: "core.sshCommand can execute an arbitrary command for Git SSH operations.",
  },
  {
    section: "core",
    key: "editor",
    severity: "medium",
    reason: "core.editor can execute an arbitrary command when Git opens an editor.",
  },
  {
    section: "core",
    key: "pager",
    severity: "medium",
    reason: "core.pager can execute an arbitrary command when Git pages output.",
  },
  {
    section: "include",
    key: "path",
    severity: "high",
    reason: "include.path can load another config file, possibly attacker-controlled.",
  },
  {
    section: "http",
    key: "proxy",
    severity: "medium",
    reason: "http.proxy can redirect Git traffic through an attacker-controlled proxy.",
  },
];

export const CRITICAL_HOOKS = new Set([
  "post-checkout",
  "post-merge",
  "post-rewrite",
  "pre-commit",
  "pre-push",
  "pre-rebase",
  "prepare-commit-msg",
  "commit-msg",
]);
