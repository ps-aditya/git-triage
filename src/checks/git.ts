import fs from "node:fs";
import path from "node:path";
import { redactSecrets } from "../redact.js";
import { CRITICAL_HOOKS, DANGEROUS_GIT_CONFIG_KEYS, NETWORK_INDICATORS } from "../rules.js";
import type { Finding } from "../types.js";
import {
  dirExists,
  fileExists,
  parseIni,
  readTextFile,
  resolveCommonDir,
  resolveGitDir,
  truncate,
} from "../util.js";

const HOOK_COMMAND =
  /\b(?:curl|wget|node|deno|bun|python|python3|powershell|pwsh|bash|sh|zsh|eval|base64|nc|netcat)\b/i;

function firstMeaningfulLine(text: string): string {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    return trimmed;
  }
  return lines[0]?.trim() ?? "";
}

function checkHooks(commonDir: string): Finding[] {
  const hooksDir = path.join(commonDir, "hooks");
  if (!dirExists(hooksDir)) return [];

  const findings: Finding[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(hooksDir);
  } catch {
    return [];
  }

  for (const name of entries.sort()) {
    if (name.endsWith(".sample")) continue;
    const absolute = path.join(hooksDir, name);
    try {
      if (!fs.statSync(absolute).isFile()) continue;
    } catch {
      continue;
    }
    const text = readTextFile(absolute, 512_000);
    if (text === null) continue;

    const commandLike = HOOK_COMMAND.test(text) || NETWORK_INDICATORS.some((p) => p.test(text));
    const severity = CRITICAL_HOOKS.has(name) || commandLike ? "high" : "medium";
    const evidence = redactSecrets(truncate(firstMeaningfulLine(text), 160));

    findings.push({
      ruleId: "git-hook",
      category: "config",
      severity,
      title: `Git hook: ${name}`,
      message: `A non-sample Git hook is installed at .git/hooks/${name}. Hooks execute automatically on Git operations.`,
      file: `.git/hooks/${name}`,
      line: 1,
      evidence,
      remediation:
        "Inspect the hook. If you did not add it, remove it and treat the repository and your credentials as potentially compromised.",
    });
  }

  return findings;
}

function checkConfig(commonDir: string): Finding[] {
  const configPath = path.join(commonDir, "config");
  if (!fileExists(configPath)) return [];
  const text = readTextFile(configPath, 512_000);
  if (text === null) return [];

  const entries = parseIni(text);
  const findings: Finding[] = [];

  for (const entry of entries) {
    const fullKey = `${entry.section}.${entry.key}`;
    const known = DANGEROUS_GIT_CONFIG_KEYS.find(
      (item) => item.section === entry.section && item.key === entry.key,
    );
    const isIncludeIf = entry.section.startsWith("includeif") && entry.key === "path";
    const isUrlInsteadOf = entry.section.startsWith("url") && entry.key === "insteadof";
    const isCredentialHelper =
      entry.section.startsWith("credential") &&
      entry.key === "helper" &&
      entry.value.startsWith("!");

    if (!known && !isIncludeIf && !isUrlInsteadOf && !isCredentialHelper) continue;

    const severity = known?.severity ?? (isCredentialHelper ? "high" : "medium");
    const reason =
      known?.reason ??
      (isIncludeIf
        ? "includeIf can load another config file based on the repository path."
        : isUrlInsteadOf
          ? "url.*.insteadOf can redirect Git traffic to another host."
          : "A credential helper that starts with ! executes an arbitrary shell command.");

    findings.push({
      ruleId: `git-config-${entry.key}`,
      category: "config",
      severity,
      title: `Dangerous Git config: ${fullKey}`,
      message: `${reason} Value: ${truncate(entry.value, 120)}`,
      file: ".git/config",
      line: entry.line,
      evidence: redactSecrets(truncate(`${fullKey} = ${entry.value}`, 180)),
      remediation:
        "Inspect the value. If you did not set it, remove it with `git config --local --unset <key>` and check for other persistence.",
    });
  }

  return findings;
}

function checkModules(root: string): Finding[] {
  const modulesPath = path.join(root, ".gitmodules");
  if (!fileExists(modulesPath)) return [];
  const text = readTextFile(modulesPath, 512_000);
  if (text === null) return [];

  const entries = parseIni(text);
  const findings: Finding[] = [];

  for (const entry of entries) {
    if (entry.key === "update" && entry.value.startsWith("!")) {
      findings.push({
        ruleId: "gitmodule-command",
        category: "config",
        severity: "critical",
        title: "Submodule update executes a command",
        message: `A submodule's update strategy runs a shell command: ${truncate(entry.value, 120)}`,
        file: ".gitmodules",
        line: entry.line,
        evidence: redactSecrets(truncate(`update = ${entry.value}`, 180)),
        remediation:
          "Do not initialize submodules. Remove the malicious .gitmodules entry and inspect the repository.",
      });
    }

    if (entry.key === "url") {
      const value = entry.value.trim();
      if (value.startsWith("ext::")) {
        findings.push({
          ruleId: "gitmodule-ext-transport",
          category: "config",
          severity: "critical",
          title: "Submodule uses the ext:: transport",
          message:
            "The ext:: transport lets the repository execute an arbitrary command when the submodule is cloned.",
          file: ".gitmodules",
          line: entry.line,
          evidence: redactSecrets(truncate(`url = ${value}`, 180)),
          remediation:
            "Do not clone submodules. Remove the submodule and inspect the repository.",
        });
      } else if (value.startsWith("file://")) {
        findings.push({
          ruleId: "gitmodule-file-url",
          category: "config",
          severity: "medium",
          title: "Submodule uses a file:// URL",
          message: "A file:// submodule URL can point outside the repository.",
          file: ".gitmodules",
          line: entry.line,
          evidence: redactSecrets(truncate(`url = ${value}`, 180)),
          remediation: "Verify the submodule source before initializing it.",
        });
      }
    }
  }

  return findings;
}

export function checkGit(root: string): Finding[] {
  const gitDir = resolveGitDir(root);
  if (!gitDir) return [];
  const commonDir = resolveCommonDir(gitDir);

  return [...checkHooks(commonDir), ...checkConfig(commonDir), ...checkModules(root)];
}
