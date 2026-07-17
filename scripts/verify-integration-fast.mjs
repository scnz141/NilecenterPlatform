import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const root = process.cwd();
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "nile-integration-fast-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const validationScope = process.env.INTEGRATION_FAST_SCOPE ?? "complete";
const commandTimeoutMs = Number(
  process.env.INTEGRATION_FAST_TIMEOUT_MS ?? 120_000
);
const activeChildren = new Set();

if (
  !Number.isSafeInteger(commandTimeoutMs) ||
  commandTimeoutMs < 10_000 ||
  commandTimeoutMs > 600_000
) {
  throw new Error(
    "INTEGRATION_FAST_TIMEOUT_MS must be an integer from 10000 to 600000."
  );
}

if (
  ![
    "complete",
    "phase6b",
    "phase6c",
    "phase6d",
    "phase6e",
    "phase6f",
    "phase6g",
    "phase6h1",
    "phase6h2",
    "phase6h3",
    "phase6h4",
  ].includes(validationScope)
) {
  throw new Error(
    `INTEGRATION_FAST_SCOPE must be complete, phase6b, phase6c, phase6d, phase6e, phase6f, phase6g, phase6h1, phase6h2, phase6h3, or phase6h4, received: ${validationScope}`
  );
}

const contractCommands = [
  ["feature freeze", ["run", "check:integration-freeze"]],
  ["ownership matrix", ["run", "check:integration-ownership"]],
  ["Phase 5 staging contract", ["run", "check:integration-phase5-staging"]],
  ["Phase 5 database preflight", ["run", "check:phase5-staging-db:static"]],
  ["Phase 5 session preflight", ["run", "check:phase5-session-runtime"]],
  [
    "Phase 6 projection contract",
    ["run", "check:integration-phase6-projections"],
  ],
  ["Moodle read evidence", ["run", "check:moodle-read-closure-evidence"]],
  ["Moodle Phase 4 loops", ["run", "check:moodle-phase4-loops"]],
  ["Phase 6A authority schema", ["run", "check:phase6a-moodle-authority"]],
  ["Phase 6B observation schema", ["run", "check:phase6b-moodle-observation"]],
  [
    "Phase 6E user mapping schema",
    ["run", "check:phase6e-moodle-user-mapping"],
  ],
  [
    "Phase 6F enrollment group schema",
    ["run", "check:phase6f-moodle-enrollment-group"],
  ],
  [
    "Phase 6G assessment status schema",
    ["run", "check:phase6g-moodle-assessment-status"],
  ],
  [
    "Phase 6H1 assignment result schema",
    ["run", "check:phase6h1-moodle-assignment-result"],
  ],
  [
    "Phase 6H2 quiz attempt schema",
    ["run", "check:phase6h2-moodle-quiz-attempt"],
  ],
  [
    "Phase 6H3 grade outcome schema",
    ["run", "check:phase6h3-moodle-grade-outcome"],
  ],
  [
    "Phase 6H4 activity outcome schema",
    ["run", "check:phase6h4-moodle-activity-outcome"],
  ],
];
const sharedImplementationCommands = [
  [
    "Phase 6A authority runtime",
    ["run", "check:phase6a-moodle-authority:runtime"],
  ],
  [
    "Phase 6B observation runtime",
    ["run", "check:phase6b-moodle-observation:runtime"],
  ],
  [
    "Phase 6E user mapping runtime",
    ["run", "check:phase6e-moodle-user-mapping:runtime"],
  ],
  [
    "Phase 6F enrollment group runtime",
    ["run", "check:phase6f-moodle-enrollment-group:runtime"],
  ],
  [
    "Phase 6G assessment status runtime",
    ["run", "check:phase6g-moodle-assessment-status:runtime"],
  ],
  [
    "Phase 6H1 assignment result runtime",
    ["run", "check:phase6h1-moodle-assignment-result:runtime"],
  ],
  [
    "Phase 6H2 quiz attempt runtime",
    ["run", "check:phase6h2-moodle-quiz-attempt:runtime"],
  ],
  [
    "Phase 6H3 grade outcome runtime",
    ["run", "check:phase6h3-moodle-grade-outcome:runtime"],
  ],
  [
    "Phase 6H4 activity outcome runtime",
    ["run", "check:phase6h4-moodle-activity-outcome:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
];
const completeImplementationCommands = [
  ...sharedImplementationCommands,
  ["unit tests", ["test", "--", "--run"]],
  ["production build", ["run", "build"]],
];
const phase6bImplementationCommands = [
  ...sharedImplementationCommands,
  [
    "projection unit tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
      "client/src/lib/moodle/server-moodle-projection-service.test.ts",
      "client/src/lib/moodle/server-moodle-read-models.test.ts",
    ],
  ],
];
const phase6cImplementationCommands = [
  ...sharedImplementationCommands,
  [
    "projection portal unit tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/client-moodle-projection-api.test.ts",
      "client/src/lib/moodle/client-moodle-source-view.test.ts",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
      "client/src/lib/moodle/server-moodle-projection-service.test.ts",
    ],
  ],
];
const phase6dContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
  ].includes(label)
);
const phase6dImplementationCommands = [
  ["TypeScript", ["run", "check"]],
  phase6cImplementationCommands.at(-1),
];
const phase6eContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
    "Phase 6E user mapping schema",
  ].includes(label)
);
const phase6eImplementationCommands = [
  [
    "Phase 6E user mapping runtime",
    ["run", "check:phase6e-moodle-user-mapping:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
  [
    "user mapping repository tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
    ],
  ],
];
const phase6fContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
    "Phase 6E user mapping schema",
    "Phase 6F enrollment group schema",
  ].includes(label)
);
const phase6fImplementationCommands = [
  [
    "Phase 6E user mapping runtime",
    ["run", "check:phase6e-moodle-user-mapping:runtime"],
  ],
  [
    "Phase 6F enrollment group runtime",
    ["run", "check:phase6f-moodle-enrollment-group:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
  [
    "enrollment group projection tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
    ],
  ],
];
const phase6gContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
    "Phase 6E user mapping schema",
    "Phase 6F enrollment group schema",
    "Phase 6G assessment status schema",
  ].includes(label)
);
const phase6gImplementationCommands = [
  [
    "Phase 6E user mapping runtime",
    ["run", "check:phase6e-moodle-user-mapping:runtime"],
  ],
  [
    "Phase 6F enrollment group runtime",
    ["run", "check:phase6f-moodle-enrollment-group:runtime"],
  ],
  [
    "Phase 6G assessment status runtime",
    ["run", "check:phase6g-moodle-assessment-status:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
  [
    "assessment status projection tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
    ],
  ],
];
const phase6h1ContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
    "Phase 6E user mapping schema",
    "Phase 6F enrollment group schema",
    "Phase 6G assessment status schema",
    "Phase 6H1 assignment result schema",
  ].includes(label)
);
const phase6h1ImplementationCommands = [
  [
    "Phase 6E user mapping runtime",
    ["run", "check:phase6e-moodle-user-mapping:runtime"],
  ],
  [
    "Phase 6F enrollment group runtime",
    ["run", "check:phase6f-moodle-enrollment-group:runtime"],
  ],
  [
    "Phase 6G assessment status runtime",
    ["run", "check:phase6g-moodle-assessment-status:runtime"],
  ],
  [
    "Phase 6H1 assignment result runtime",
    ["run", "check:phase6h1-moodle-assignment-result:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
  [
    "assignment result projection tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
    ],
  ],
];
const phase6h2ContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
    "Phase 6E user mapping schema",
    "Phase 6F enrollment group schema",
    "Phase 6G assessment status schema",
    "Phase 6H1 assignment result schema",
    "Phase 6H2 quiz attempt schema",
  ].includes(label)
);
const phase6h2ImplementationCommands = [
  [
    "Phase 6E user mapping runtime",
    ["run", "check:phase6e-moodle-user-mapping:runtime"],
  ],
  [
    "Phase 6F enrollment group runtime",
    ["run", "check:phase6f-moodle-enrollment-group:runtime"],
  ],
  [
    "Phase 6G assessment status runtime",
    ["run", "check:phase6g-moodle-assessment-status:runtime"],
  ],
  [
    "Phase 6H1 assignment result runtime",
    ["run", "check:phase6h1-moodle-assignment-result:runtime"],
  ],
  [
    "Phase 6H2 quiz attempt runtime",
    ["run", "check:phase6h2-moodle-quiz-attempt:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
  [
    "quiz attempt projection tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
    ],
  ],
];
const phase6h3ContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
    "Phase 6E user mapping schema",
    "Phase 6F enrollment group schema",
    "Phase 6G assessment status schema",
    "Phase 6H1 assignment result schema",
    "Phase 6H2 quiz attempt schema",
    "Phase 6H3 grade outcome schema",
  ].includes(label)
);
const phase6h3ImplementationCommands = [
  [
    "Phase 6H3 grade outcome runtime",
    ["run", "check:phase6h3-moodle-grade-outcome:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
  [
    "grade outcome projection tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
    ],
  ],
];
const phase6h4ContractCommands = contractCommands.filter(([label]) =>
  [
    "feature freeze",
    "ownership matrix",
    "Phase 6 projection contract",
    "Phase 6E user mapping schema",
    "Phase 6F enrollment group schema",
    "Phase 6G assessment status schema",
    "Phase 6H1 assignment result schema",
    "Phase 6H2 quiz attempt schema",
    "Phase 6H3 grade outcome schema",
    "Phase 6H4 activity outcome schema",
  ].includes(label)
);
const phase6h4ImplementationCommands = [
  [
    "Phase 6H4 activity outcome runtime",
    ["run", "check:phase6h4-moodle-activity-outcome:runtime"],
  ],
  ["TypeScript", ["run", "check"]],
  [
    "activity outcome projection tests",
    [
      "test",
      "--",
      "--run",
      "client/src/lib/moodle/server-moodle-projection-freshness.test.ts",
      "client/src/lib/moodle/server-moodle-projection-repository.test.ts",
      "client/src/lib/moodle/server-moodle-projection-routes.test.ts",
    ],
  ],
];
const selectedContractCommands =
  validationScope === "phase6d"
    ? phase6dContractCommands
    : validationScope === "phase6e"
      ? phase6eContractCommands
      : validationScope === "phase6f"
        ? phase6fContractCommands
        : validationScope === "phase6g"
          ? phase6gContractCommands
          : validationScope === "phase6h1"
            ? phase6h1ContractCommands
            : validationScope === "phase6h2"
              ? phase6h2ContractCommands
              : validationScope === "phase6h3"
                ? phase6h3ContractCommands
                : validationScope === "phase6h4"
                  ? phase6h4ContractCommands
                  : contractCommands;
const implementationCommands =
  validationScope === "phase6b"
    ? phase6bImplementationCommands
    : validationScope === "phase6c"
      ? phase6cImplementationCommands
      : validationScope === "phase6d"
        ? phase6dImplementationCommands
        : validationScope === "phase6e"
          ? phase6eImplementationCommands
          : validationScope === "phase6f"
            ? phase6fImplementationCommands
            : validationScope === "phase6g"
              ? phase6gImplementationCommands
              : validationScope === "phase6h1"
                ? phase6h1ImplementationCommands
                : validationScope === "phase6h2"
                  ? phase6h2ImplementationCommands
                  : validationScope === "phase6h3"
                    ? phase6h3ImplementationCommands
                    : validationScope === "phase6h4"
                      ? phase6h4ImplementationCommands
                      : completeImplementationCommands;

function terminateChild(child, signal = "SIGTERM") {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function stopActiveChildren(signal = "SIGTERM") {
  for (const child of activeChildren) terminateChild(child, signal);
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  const children = [...activeChildren];
  for (const child of children) terminateChild(child);
  await Promise.race([
    Promise.all(
      children.map(
        child =>
          new Promise(resolve => {
            if (child.exitCode !== null || child.signalCode !== null) resolve();
            else child.once("close", resolve);
          })
      )
    ),
    new Promise(resolve => setTimeout(resolve, 2_000)),
  ]);
  for (const child of children) terminateChild(child, "SIGKILL");
  await new Promise(resolve => setTimeout(resolve, 50));
  fs.rmSync(logDir, { recursive: true, force: true });
  process.exit(signal === "SIGINT" ? 130 : 143);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

function appendLog(logPath, message) {
  fs.appendFileSync(logPath, message, "utf8");
}

function closeLog(logFd) {
  try {
    fs.closeSync(logFd);
  } catch {
    // A spawn error can close inherited descriptors before this callback.
  }
}

function runCommand([label, args]) {
  const startedAt = Date.now();
  const logPath = path.join(
    logDir,
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.log`
  );
  const logFd = fs.openSync(logPath, "w");
  return new Promise(resolve => {
    let settled = false;
    let timedOut = false;
    let escalation;
    const child = spawn(npmCommand, args, {
      cwd: root,
      env: process.env,
      stdio: ["ignore", logFd, logFd],
      detached: process.platform !== "win32",
    });
    activeChildren.add(child);
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      clearTimeout(timeout);
      clearTimeout(escalation);
      closeLog(logFd);
      if (error) appendLog(logPath, `\n${error.stack ?? error.message}\n`);
      if (timedOut) {
        appendLog(logPath, `\nTimed out after ${commandTimeoutMs}ms.\n`);
      }
      resolve({
        label,
        code: code ?? 1,
        durationMs: Date.now() - startedAt,
        logPath,
      });
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      terminateChild(child);
      escalation = setTimeout(() => terminateChild(child, "SIGKILL"), 2_000);
      escalation.unref();
    }, commandTimeoutMs);
    timeout.unref();
    child.once("error", error => {
      finish(1, error);
    });
    child.once("close", code => {
      finish(timedOut ? 1 : code);
    });
  });
}

async function runStage(label, commands) {
  const startedAt = Date.now();
  console.log(`\n==> ${label} (${commands.length} checks in parallel)`);
  const results = await Promise.all(commands.map(runCommand));
  for (const result of results) {
    console.log(
      `${result.code === 0 ? "PASS" : "FAIL"} ${result.label} (${(
        result.durationMs / 1000
      ).toFixed(1)}s)`
    );
  }
  const failures = results.filter(result => result.code !== 0);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`\n--- ${failure.label} output ---`);
      console.error(fs.readFileSync(failure.logPath, "utf8"));
    }
    throw new Error(`${failures.length} fast verification check(s) failed.`);
  }
  console.log(
    `${label} completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`
  );
}

try {
  await runStage("Contract gates", selectedContractCommands);
  await runStage("Implementation gates", implementationCommands);
  console.log(
    validationScope === "phase6b"
      ? "\nFast Phase 6B validation passed. This focused inner loop intentionally omits the full unit suite, production build, and portal QA."
      : validationScope === "phase6c"
        ? "\nFast Phase 6C validation passed. This focused inner loop intentionally omits the full unit suite, production build, and portal QA."
        : validationScope === "phase6d"
          ? "\nFast Phase 6D validation passed. This focused inner loop intentionally omits historical contracts, database runtimes, the full unit suite, production build, and portal QA."
          : validationScope === "phase6f"
            ? "\nFast Phase 6F validation passed. This focused inner loop intentionally omits the full unit suite, production build, and portal QA."
            : "\nFast integration validation passed. Run scripts/verify.sh at the phase boundary for database gates and full portal QA."
  );
} finally {
  stopActiveChildren();
  fs.rmSync(logDir, { recursive: true, force: true });
}
