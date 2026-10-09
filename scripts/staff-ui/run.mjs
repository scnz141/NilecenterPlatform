#!/usr/bin/env node
// Runs the staff browser suites sequentially (staging EMS is shared — no
// parallelism) and always cleans up form-test leads after the forms suite.
// Usage: npm run qa:staff   ·   QA_STAFF_ONLY=forms,teaching npm run qa:staff
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SUITES = ["admissions", "students", "teaching", "week", "forms", "forms-people", "reports", "shell", "public", "fix-verify"];

const only = (process.env.QA_STAFF_ONLY ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const unknown = only.filter(name => !SUITES.includes(name));
if (unknown.length) {
  console.error(`Unknown suites in QA_STAFF_ONLY: ${unknown.join(", ")}`);
  console.error(`Known: ${SUITES.join(", ")}`);
  process.exit(2);
}
const selected = only.length ? SUITES.filter(name => only.includes(name)) : SUITES;

function run(script) {
  const result = spawnSync(process.execPath, [path.join(dir, script)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  process.stdout.write(result.stdout ?? "");
  const line = (result.stdout ?? "").split("\n").find(l => l.startsWith("SUITE_RESULT "));
  return { status: result.status ?? 1, summary: line ? JSON.parse(line.slice("SUITE_RESULT ".length)) : null };
}

const rows = [];
for (const name of selected) {
  console.log(`\n=== ${name} ===`);
  const { status, summary } = run(`${name}.mjs`);
  rows.push({
    suite: name,
    passed: summary?.passed ?? 0,
    total: summary?.total ?? 0,
    consoleErrors: summary?.consoleErrors ?? 0,
    status,
  });
  if (name === "forms") {
    console.log("\n=== cleanup: form-test leads ===");
    run("cleanup-form-leads.mjs");
  }
}

console.log("\nsuite            passed/total    console errors");
for (const row of rows) {
  console.log(
    row.suite.padEnd(16),
    `${row.passed}/${row.total}`.padEnd(15),
    row.consoleErrors
  );
}
if (rows.some(row => row.passed !== row.total || row.status !== 0)) process.exit(1);
