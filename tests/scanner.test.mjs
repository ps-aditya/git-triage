import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scan } from "../dist/scanner.js";

const root = process.cwd();
const demo = path.join(root, "demo-repo");

function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-triage-test-"));
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(dir, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
  return dir;
}

test("demo repo triggers the secret, asset, and CI detections", async () => {
  const result = await scan({ cwd: demo });
  const ids = new Set(result.findings.map((finding) => finding.ruleId));

  assert.ok(ids.has("asset-is-script"), "missing fake asset detection");
  assert.ok(ids.has("gitlab-incoming-email-token"), "missing glimt token detection");
  assert.ok(ids.has("ci-curl-pipe-shell"), "missing CI curl|bash detection");
});

test("detects a hidden folder-open task that runs a fake asset", async () => {
  const dir = makeRepo({
    ".vscode/tasks.json": JSON.stringify(
      {
        version: "2.0.0",
        tasks: [
          {
            label: "eslint-check",
            type: "shell",
            command: "node ./public/fonts/fake.woff2",
            isBackground: true,
            hide: true,
            presentation: { reveal: "never", echo: false, close: true },
            runOptions: { runOn: "folderOpen" },
          },
        ],
      },
      null,
      2,
    ),
    "public/fonts/fake.woff2": "#!/usr/bin/env node\nconsole.log('demo');\n",
  });
  const result = await scan({ cwd: dir });
  assert.ok(
    result.findings.some((finding) => finding.ruleId === "task-folder-open-asset-script"),
    "missing folder-open asset detection",
  );
  assert.ok(
    result.findings.some((finding) => finding.ruleId === "asset-is-script"),
    "missing fake asset detection",
  );
});

test("detects GitHub and AWS tokens", async () => {
  const dir = makeRepo({
    "README.md":
      "github: ghp_DEMO00000000000000000000000000000000\naws: AKIADEMO000000000000\n",
  });
  const result = await scan({ cwd: dir });
  const ids = new Set(result.findings.map((finding) => finding.ruleId));
  assert.ok(ids.has("github-pat"));
  assert.ok(ids.has("aws-access-key"));
});

test("clean repo has no findings", async () => {
  const dir = makeRepo({ "README.md": "# hello\n", "src/index.js": "console.log('ok');\n" });
  const result = await scan({ cwd: dir });
  assert.equal(result.findings.length, 0);
});

test("does not leak raw secrets in findings", async () => {
  const raw = "glimt-DEMO000000000000000000000000";
  const dir = makeRepo({ "README.md": `token: ${raw}\n` });
  const result = await scan({ cwd: dir });
  const serialized = JSON.stringify(result);

  assert.ok(result.findings.some((finding) => finding.ruleId === "gitlab-incoming-email-token"));
  assert.ok(!serialized.includes(raw), "raw secret leaked into the result");
  assert.ok(serialized.includes("glimt-…"), "masked secret is missing");
});

test("detects dangerous git config", async () => {
  const dir = makeRepo({
    ".git/config": "[core]\n\tfsmonitor = /tmp/evil\n",
    "README.md": "# hi\n",
  });
  const result = await scan({ cwd: dir });
  assert.ok(result.findings.some((finding) => finding.ruleId === "git-config-fsmonitor"));
});

test("detects secrets in git history", async () => {
  const dir = makeRepo({ "README.md": "# hi\n" });
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, stdio: "pipe", encoding: "utf8" });

  git("init");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  fs.writeFileSync(path.join(dir, "secret.txt"), "token: glimt-HISTORY00000000000000000000\n");
  git("add", ".");
  git("commit", "-m", "add secret");
  fs.unlinkSync(path.join(dir, "secret.txt"));
  git("add", ".");
  git("commit", "-m", "remove secret");

  const result = await scan({ cwd: dir, history: true, maxCommits: 20 });
  const finding = result.findings.find(
    (item) => item.ruleId === "gitlab-incoming-email-token" && item.commit,
  );
  assert.ok(finding, "history finding is missing");
  assert.ok(finding.commit.length >= 7);
});

test("CLI exits 1 with --ci on the demo repo", () => {
  const result = spawnSync(process.execPath, ["dist/cli.js", "scan", demo, "--ci", "--no-color"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CRITICAL/);
});

test("CLI exits 0 on a clean repo", () => {
  const dir = makeRepo({ "README.md": "# hello\n" });
  const result = spawnSync(process.execPath, ["dist/cli.js", "scan", dir, "--ci", "--no-color"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
});
