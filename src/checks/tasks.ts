import path from "node:path";
import { redactSecrets } from "../redact.js";
import { SUSPICIOUS_TASK_COMMAND } from "../rules.js";
import type { Finding } from "../types.js";
import { fileExists, findLine, readTextFile, stripJsonComments, truncate } from "../util.js";
import { looksLikeScript } from "./assets.js";

interface TaskLike {
  label?: unknown;
  type?: unknown;
  command?: unknown;
  args?: unknown;
  hide?: unknown;
  presentation?: { reveal?: unknown; echo?: unknown; close?: unknown };
  runOptions?: { runOn?: unknown };
  runOn?: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function commandOf(task: TaskLike): string {
  const parts: string[] = [];
  if (typeof task.command === "string") parts.push(task.command);
  if (Array.isArray(task.args)) {
    for (const arg of task.args) {
      if (typeof arg === "string") parts.push(arg);
    }
  } else if (typeof task.args === "string") {
    parts.push(task.args);
  }
  return parts.join(" ");
}

export function checkTasks(root: string, files: string[]): Finding[] {
  const relative = files.find((file) => file.toLowerCase() === ".vscode/tasks.json");
  if (!relative) return [];

  const raw = readTextFile(path.join(root, relative), 2_000_000);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    return [
      {
        ruleId: "tasks-json-parse",
        category: "malware",
        severity: "low",
        title: "Could not parse .vscode/tasks.json",
        message: `The file is not valid JSON/JSONC: ${message}. Inspect it manually before opening the repository.`,
        file: relative,
        line: 1,
        remediation:
          "Open the file in a text editor without trusting the workspace. Remove it if you do not recognize the tasks.",
      },
    ];
  }

  const tasks: TaskLike[] = Array.isArray(parsed)
    ? (parsed as TaskLike[])
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { tasks?: unknown }).tasks)
      ? ((parsed as { tasks: TaskLike[] }).tasks)
      : [];

  const findings: Finding[] = [];

  for (const task of tasks) {
    const label = asString(task.label) || "(unnamed task)";
    const runOn = asString(task.runOptions?.runOn) || asString(task.runOn);
    const isFolderOpen = runOn.toLowerCase() === "folderopen";
    const isHidden =
      task.hide === true || asString(task.presentation?.reveal).toLowerCase() === "never";
    const commandLine = commandOf(task);
    const suspicious = SUSPICIOUS_TASK_COMMAND.test(commandLine);
    const assetMatch = commandLine.match(
      /([^\s"'`]+\.(?:woff2?|ttf|otf|eot|png|jpe?g|gif|svg|ico|webp))/i,
    );
    const assetRelative = assetMatch?.[1]?.replace(/^["']|["']$/g, "");
    const assetAbsolute = assetRelative ? path.resolve(root, assetRelative) : null;
    const assetIsScript = Boolean(
      assetAbsolute && fileExists(assetAbsolute) && looksLikeScript(assetAbsolute),
    );

    const line =
      findLine(raw, '"folderOpen"') ?? findLine(raw, `"${label}"`) ?? findLine(raw, '"tasks"');
    const evidence = redactSecrets(
      truncate(
        `label="${label}" runOn="${runOn || "default"}" hide=${String(isHidden)} command="${commandLine}"`,
        220,
      ),
    );

    if (isFolderOpen && assetIsScript) {
      findings.push({
        ruleId: "task-folder-open-asset-script",
        category: "malware",
        severity: "critical",
        title: "Hidden folder-open task runs a script disguised as an asset",
        message: `Task "${label}" runs on folder open and executes ${assetRelative}, which is a script, not a valid font or image.`,
        file: relative,
        line,
        evidence,
        remediation:
          "Do not trust this workspace. Open it in Restricted Mode, quarantine the referenced file, remove the task, and rotate any credentials that may have been exposed.",
      });
      continue;
    }

    if (isFolderOpen && isHidden && suspicious) {
      findings.push({
        ruleId: "task-folder-open-hidden",
        category: "malware",
        severity: "critical",
        title: "Hidden folder-open task runs a command",
        message: `Task "${label}" is hidden and runs a shell command when the folder is opened.`,
        file: relative,
        line,
        evidence,
        remediation:
          "Do not trust this workspace. Open it in Restricted Mode and remove the task from .vscode/tasks.json.",
      });
      continue;
    }

    if (isFolderOpen && suspicious) {
      findings.push({
        ruleId: "task-folder-open-command",
        category: "malware",
        severity: "high",
        title: "Folder-open task runs a command",
        message: `Task "${label}" runs a shell command when the folder is opened.`,
        file: relative,
        line,
        evidence,
        remediation:
          "Confirm the task is expected. If not, remove it and open the repository in Restricted Mode.",
      });
      continue;
    }

    if (isFolderOpen) {
      findings.push({
        ruleId: "task-folder-open",
        category: "malware",
        severity: "medium",
        title: "Task runs on folder open",
        message: `Task "${label}" runs automatically when the folder is opened.`,
        file: relative,
        line,
        evidence,
        remediation:
          "Review the task. Folder-open tasks are a common persistence and malware delivery mechanism.",
      });
      continue;
    }

    if (isHidden && suspicious) {
      findings.push({
        ruleId: "task-hidden-command",
        category: "malware",
        severity: "medium",
        title: "Hidden task runs a command",
        message: `Task "${label}" is hidden and runs a shell command.`,
        file: relative,
        line,
        evidence,
        remediation: "Review the task and remove it if it is not expected.",
      });
    }
  }

  return findings;
}
