import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function readPositiveIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3001";
const session = process.env.QA_SESSION || `nile-portals-qa-${process.pid}`;
const password = process.env.NILE_DEMO_PASSWORD || `qa-${session}`;
const commandTimeoutMs = readPositiveIntegerEnv("QA_COMMAND_TIMEOUT_MS", 60000);
const routeReadyTimeoutMs = readPositiveIntegerEnv(
  "QA_ROUTE_READY_TIMEOUT_MS",
  8000
);
const routeMatrixRouteTimeoutMs = readPositiveIntegerEnv(
  "QA_ROUTE_MATRIX_ROUTE_TIMEOUT_MS",
  5000
);
const routeMatrixChunkSize = readPositiveIntegerEnv(
  "QA_ROUTE_MATRIX_CHUNK_SIZE",
  12
);
const workflowReadyTimeoutMs = readPositiveIntegerEnv(
  "QA_WORKFLOW_READY_TIMEOUT_MS",
  6000
);
const workflowActionTimeoutMs = readPositiveIntegerEnv(
  "QA_WORKFLOW_ACTION_TIMEOUT_MS",
  8000
);
const loginTimeoutMs = readPositiveIntegerEnv("QA_LOGIN_TIMEOUT_MS", 30000);
const maxRunMs = readPositiveIntegerEnv(
  "QA_SUITE_TIMEOUT_MS",
  readPositiveIntegerEnv("QA_MAX_RUN_MS", 35 * 60 * 1000)
);
const workflowNameFilter =
  process.env.QA_ONLY_WORKFLOWS?.trim().toLowerCase() || "";
const roleNameFilters = (process.env.QA_ONLY_ROLES || "")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);
const localPwcli = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  "playwright-cli"
);
const fallbackPwcli = path.join(
  os.homedir(),
  ".codex",
  "skills",
  "playwright",
  "scripts",
  "playwright_cli.sh"
);
const pwcli =
  process.env.PWCLI || (fs.existsSync(localPwcli) ? localPwcli : fallbackPwcli);
if (!fs.existsSync(pwcli)) {
  console.error(
    JSON.stringify(
      {
        error: "Playwright CLI executable is missing",
        pwcli,
        hint: "Install dependencies or set PWCLI to an executable browser automation runner before running portal QA.",
      },
      null,
      2
    )
  );
  process.exit(1);
}

const roles = [
  {
    role: "student",
    email: "s@nl.test",
    loginPath: "/auth/student-login",
    dashboard: "/app/student/dashboard",
    routes: [
      "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
      "/app/student/courses/course_ar_l3/live",
      "/app/student/courses/course_ar_l3",
      "/app/student/assignments/asg_ar_grammar",
      "/app/student/quizzes/quiz_ar_3",
      "/app/student/courses",
      "/app/student/moodle-source",
      "/app/student/moodle-source/course_ar_l3",
      "/app/student/assignments",
      "/app/student/quizzes",
      "/app/student/grades",
      "/app/student/attendance",
      "/app/student/calendar",
      "/app/student/messages",
      "/app/student/certificates",
      "/app/student/reports",
      "/app/student/support",
      "/app/student/settings",
      "/app/student/quran-progress",
      "/app/student/forms",
      "/app/student/forms/publication_form_support_1",
    ],
  },
  {
    role: "teacher",
    email: "t@nl.test",
    loginPath: "/auth/administration-login",
    dashboard: "/app/teacher/dashboard",
    routes: [
      "/app/teacher/classes/class_ar_l3_a/sessions",
      "/app/teacher/classes/class_ar_l3_a/attendance",
      "/app/teacher/classes/class_ar_l3_a/students",
      "/app/teacher/classes/class_ar_l3_a/materials",
      "/app/teacher/classes/class_ar_l3_a",
      "/app/teacher/assignments/asg_ar_grammar",
      "/app/teacher/classes",
      "/app/teacher/moodle-source",
      "/app/teacher/moodle-source/course_ar_l3",
      "/app/teacher/assignments",
      "/app/teacher/grading",
      "/app/teacher/quizzes",
      "/app/teacher/quizzes/new",
      "/app/teacher/quizzes/review",
      "/app/teacher/quizzes/review/attempt_mr92cxmr_pqt5a",
      "/app/teacher/question-bank",
      "/app/teacher/question-bank/new",
      "/app/teacher/calendar",
      "/app/teacher/messages",
      "/app/teacher/reports",
      "/app/teacher/settings",
      "/app/teacher/quran-review",
      "/app/teacher/forms",
    ],
  },
  {
    role: "registrar",
    email: "r@nl.test",
    loginPath: "/auth/administration-login",
    dashboard: "/app/registrar/dashboard",
    routes: [
      "/app/registrar/leads/lead_demo_1",
      "/app/registrar/applications/app_demo_1",
      "/app/registrar/applications/app_demo_1/placement",
      "/app/registrar/students/stu_demo",
      "/app/registrar/placement-tests/pt_demo_1",
      "/app/registrar/leads",
      "/app/registrar/applications",
      "/app/registrar/students",
      "/app/registrar/placement-tests",
      "/app/registrar/enrollments",
      "/app/registrar/enrollments/records",
      "/app/registrar/enrollments/records/enr_ar_l3_cairo",
      "/app/registrar/classes",
      "/app/registrar/payments/inv_cairo_demo_1",
      "/app/registrar/schedule",
      "/app/registrar/payments",
      "/app/registrar/messages",
      "/app/registrar/reports",
      "/app/registrar/settings",
      "/app/registrar/forms",
      "/app/registrar/forms/manage",
      "/app/registrar/forms/manage/new",
      "/app/registrar/forms/manage/form_application/builder",
      "/app/registrar/forms/manage/form_application/publish",
      "/app/registrar/forms/manage/form_application/publications",
      "/app/registrar/forms/review",
    ],
  },
  {
    role: "headofdepartment",
    email: "h@nl.test",
    loginPath: "/auth/administration-login",
    dashboard: "/app/hod/dashboard",
    routes: [
      "/app/hod/departments",
      "/app/hod/programs",
      "/app/hod/courses",
      "/app/hod/moodle-source",
      "/app/hod/moodle-source/course_ar_l3",
      "/app/hod/levels",
      "/app/hod/curriculum",
      "/app/hod/teachers",
      "/app/hod/classes",
      "/app/hod/classes/runs/new",
      "/app/hod/schedule",
      "/app/hod/assessments",
      "/app/hod/certificates",
      "/app/hod/reports",
      "/app/hod/messages",
      "/app/hod/forms",
      "/app/hod/forms/manage",
      "/app/hod/forms/manage/new",
      "/app/hod/forms/manage/form_consent/builder",
      "/app/hod/forms/manage/form_consent/publish",
      "/app/hod/forms/manage/form_consent/publications",
      "/app/hod/forms/manage/form_consent/publications/publication_form_consent_1/assignments",
      "/app/hod/forms/review",
    ],
  },
  {
    role: "branchadmin",
    email: "b@nl.test",
    loginPath: "/auth/administration-login",
    dashboard: "/app/branch/dashboard",
    routes: [
      "/app/branch/students",
      "/app/branch/teachers",
      "/app/branch/classes",
      "/app/branch/classes/new",
      "/app/branch/classes/class_ar_l3_cairo",
      "/app/branch/rooms",
      "/app/branch/schedule",
      "/app/branch/schedule/sessions/session_ar_cairo_upcoming",
      "/app/branch/attendance",
      "/app/branch/payments/inv_cairo_demo_1",
      "/app/branch/payments",
      "/app/branch/reports",
      "/app/branch/messages",
      "/app/branch/settings",
      "/app/branch/forms",
      "/app/branch/forms/manage",
      "/app/branch/forms/manage/new",
      "/app/branch/forms/manage/form_incident/builder",
      "/app/branch/forms/manage/form_incident/publish",
      "/app/branch/forms/manage/form_incident/publications",
      "/app/branch/forms/manage/form_incident/publications/publication_form_incident_1/assignments",
      "/app/branch/forms/review",
    ],
  },
  {
    role: "superadmin",
    email: "a@nl.test",
    loginPath: "/auth/administration-login",
    dashboard: "/app/admin/dashboard",
    routes: [
      "/app/admin/users/usr_student_demo",
      "/app/admin/users",
      "/app/admin/roles",
      "/app/admin/permissions",
      "/app/admin/branches",
      "/app/admin/departments",
      "/app/admin/programs",
      "/app/admin/courses",
      "/app/admin/courses/programs",
      "/app/admin/courses/levels",
      "/app/admin/courses/curriculum",
      "/app/admin/courses/teachers",
      "/app/admin/courses/resources",
      "/app/admin/courses/course_ar_l3",
      "/app/admin/certificates",
      "/app/admin/schedule",
      "/app/admin/schedule/conflicts",
      "/app/admin/moodle-source",
      "/app/admin/moodle-source/course_ar_l3",
      "/app/admin/settings",
      "/app/admin/integrations",
      "/app/admin/audit-logs",
      "/app/admin/reports",
      "/app/admin/reports/attendance",
      "/app/admin/reports/finance",
      "/app/admin/reports/certificates",
      "/app/admin/reports/admissions",
      "/app/admin/reports/classes",
      "/app/admin/reports/saved-views",
      "/app/admin/system-health",
      "/app/admin/platform-blueprint",
      "/app/admin/users/new",
      "/app/admin/forms",
      "/app/admin/forms/manage",
      "/app/admin/forms/manage/new",
      "/app/admin/forms/manage/form_enquiry/builder",
      "/app/admin/forms/manage/form_enquiry/publish",
      "/app/admin/forms/manage/form_enquiry/publications",
      "/app/admin/forms/manage/form_support/publications/publication_form_support_1/assignments",
      "/app/admin/forms/review",
    ],
  },
];

const selectedRoles = roleNameFilters.length
  ? roles.filter(item => roleNameFilters.includes(item.role.toLowerCase()))
  : roles;

const publicRoutes = [
  "/",
  "/login",
  "/courses",
  "/courses/arabic",
  "/courses/quran",
  "/courses/islamic-studies",
  "/courses/turkish",
  "/courses/english",
  "/courses/teacher-training",
  "/courses/kids",
  "/courses/enterprise",
  "/book-free-trial",
  "/book-placement-test",
  "/verify-certificate",
  "/faq",
  "/contact",
  "/about",
  "/privacy",
  "/terms",
  "/forms/free-trial-enquiry",
  "/forms/course-application",
  "/forms/placement-request",
  "/404",
];

const authRoutes = [
  "/login",
  "/auth/login",
  "/auth/student-login",
  "/auth/administration-login",
  "/auth/admin-login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/select-role",
  "/auth/logout",
];

const failures = [];
const checks = [];
const platformStorageKey = "nilelearn.platform.state.v1";
const outputDir = path.resolve(
  process.env.QA_OUTPUT_DIR || path.join(process.cwd(), "output", "playwright")
);
const outputPath = path.join(outputDir, "portal-qa-summary.json");
const startedAt = Date.now();
const progressEvents = [];
const authenticatedProviders = new Map();
let lastBrowserCommand = null;
let lastCheck = null;
let currentProgress = null;
let summaryWritten = false;
let activeChild = null;
let activeKillTree = null;

function elapsedMs() {
  return Date.now() - startedAt;
}

function writeSummary(extra = {}, includeDetails = true) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {
    baseUrl,
    session,
    selection: {
      fullSuite: !workflowNameFilter && roleNameFilters.length === 0,
      workflowNameFilter: workflowNameFilter || null,
      roleNameFilters,
    },
    checkedAt: new Date().toISOString(),
    elapsedMs: elapsedMs(),
    lastBrowserCommand,
    lastCheck,
    currentProgress,
    totalChecks: checks.length,
    failedChecks: failures.length,
    interrupted: false,
    failures,
    progressEventCount: progressEvents.length,
    ...(includeDetails ? { progressEvents, checks } : {}),
    ...extra,
  };
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  summaryWritten = true;
  return summary;
}

function recordProgress(stage, details = {}) {
  const event = { stage, elapsedMs: elapsedMs(), ...details };
  currentProgress = event;
  progressEvents.push(event);
  const seconds = Math.round(event.elapsedMs / 1000);
  const suffix = lastBrowserCommand?.label
    ? ` last="${lastBrowserCommand.label}"`
    : "";
  console.error(
    `[portal-qa ${seconds}s] ${stage} checks=${checks.length} failures=${failures.length}${suffix}`
  );
  writeSummary({ inProgress: true }, false);
}

function assertRunBudget(stage) {
  if (elapsedMs() > maxRunMs) {
    throw new Error(`portal QA exceeded ${maxRunMs}ms while ${stage}`);
  }
}

function pushFatal(name, error) {
  const actual = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    lastBrowserCommand,
    lastCheck,
    currentProgress,
  };
  const failure = { name, actual };
  checks.push({ ...failure, ok: false });
  failures.push(failure);
  return failure;
}

function killActiveChild(signal = "SIGTERM") {
  if (activeKillTree) {
    activeKillTree(signal);
    return true;
  }
  if (activeChild) {
    try {
      activeChild.kill(signal);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

process.once("SIGINT", () => {
  killActiveChild("SIGTERM");
  pushFatal("portal QA runner interrupted", new Error("Received SIGINT"));
  writeSummary({ interrupted: true });
  process.exit(130);
});

process.once("SIGTERM", () => {
  killActiveChild("SIGTERM");
  pushFatal("portal QA runner terminated", new Error("Received SIGTERM"));
  writeSummary({ interrupted: true });
  process.exit(143);
});

function truncateOutput(value, limit = 1000) {
  return String(value || "").slice(0, limit);
}

function commandLabel(command, args, options) {
  if (options.label) return options.label;
  const firstArg = args[0] ? String(args[0]) : "";
  const preview =
    firstArg.length > 120 ? `${firstArg.slice(0, 120)}...` : firstArg;
  return preview ? `${command} ${preview}` : command;
}

function hasPlaywrightResult(output) {
  return output.includes("### Result");
}

async function runPw(command, args = [], options = {}) {
  assertRunBudget(`starting browser command ${command}`);
  const requestedTimeoutMs = options.timeoutMs ?? commandTimeoutMs;
  const remainingSuiteMs = Math.max(1000, maxRunMs - elapsedMs());
  const timeoutMs = Math.min(requestedTimeoutMs, remainingSuiteMs);
  const label = commandLabel(command, args, options);
  const startedAt = Date.now();
  lastBrowserCommand = { command, label, timeoutMs, startedAt };
  if (process.env.QA_VERBOSE === "1") {
    console.error(`[portal-qa] ${label}`);
  }
  const cliArgs = ["-s", session];
  if (command === "eval") cliArgs.push("--raw");
  cliArgs.push(command, ...args);
  const child = spawn(pwcli, cliArgs, {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let killEscalated = false;
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", chunk => {
    stdout += chunk;
    if (stdout.length > 1024 * 1024 * 4)
      stdout = stdout.slice(-1024 * 1024 * 4);
  });
  child.stderr?.on("data", chunk => {
    stderr += chunk;
    if (stderr.length > 1024 * 1024 * 4)
      stderr = stderr.slice(-1024 * 1024 * 4);
  });

  const killTree = signal => {
    try {
      if (child.pid) process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // Process may already be gone.
      }
    }
  };
  activeChild = child;
  activeKillTree = killTree;
  lastBrowserCommand = { command, label, timeoutMs, startedAt, pid: child.pid };

  const status = await new Promise((resolve, reject) => {
    let settled = false;
    let killTimer = null;
    const finish = code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (activeChild === child) {
        activeChild = null;
        activeKillTree = null;
      }
      resolve(code ?? 0);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree("SIGTERM");
      killTimer = setTimeout(() => {
        killEscalated = true;
        killTree("SIGKILL");
        setTimeout(() => finish(null), 500).unref();
      }, 1500);
      killTimer.unref();
    }, timeoutMs);
    timer.unref();

    child.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (activeChild === child) {
        activeChild = null;
        activeKillTree = null;
      }
      reject(error);
    });
    child.on("close", code => finish(code));
  });

  const durationMs = Date.now() - startedAt;
  const output = `${stdout}${stderr}`;
  const timedOutWithResult =
    timedOut && command === "eval" && hasPlaywrightResult(output);
  lastBrowserCommand = {
    command,
    label,
    timeoutMs,
    durationMs,
    timedOut,
    killEscalated,
    pid: child.pid,
  };
  if (timedOut && !timedOutWithResult) {
    throw new Error(
      `playwright ${label} timed out after ${timeoutMs}ms: ${truncateOutput(output, 1200)}`
    );
  }
  if (status !== 0) {
    throw new Error(
      `playwright ${label} failed after ${durationMs}ms: ${truncateOutput(output, 1200)}`
    );
  }
  return output;
}

function extractResult(output) {
  const raw = output.trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // Fall through to the verbose CLI response parser.
    }
  }
  const start = output.indexOf("### Result");
  if (start === -1) return null;
  const after = output.slice(start + "### Result".length).trimStart();
  const end = after.indexOf("\n### ");
  const value = (end === -1 ? after : after.slice(0, end)).trim();
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function pageEval(source, options) {
  return extractResult(await runPw("eval", [source], options));
}

async function goto(pathname) {
  await runPw("goto", [`${baseUrl}${pathname}`], { label: `goto ${pathname}` });
}

async function assertCheck(name, actual, predicate, details = {}) {
  const ok = Boolean(predicate(actual));
  const check = { name, ok, actual, ...details };
  checks.push(check);
  lastCheck = check;
  if (!ok) failures.push({ name, actual, ...details });
  return ok;
}

function inspectBrowserConsole(output) {
  const totalMatch = output.match(
    /Total messages:\s*(\d+)\s*\(Errors:\s*(\d+),\s*Warnings:\s*(\d+)\)/
  );
  const lines = output
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("[ERROR]"));
  const expected = lines.filter(
    line =>
      (line.includes(
        "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
      ) && line.includes("/api/integrations/moodle/projections/courses")) ||
      (line.includes(
        "Failed to load resource: the server responded with a status of 404 (Not Found)"
      ) &&
        /\/api\/forms\/assigned\/[^/]+\/draft/.test(line))
  );
  const unexpected = lines.filter(line => !expected.includes(line));
  return {
    parsed: Boolean(totalMatch),
    total: totalMatch ? Number(totalMatch[1]) : null,
    errors: totalMatch ? Number(totalMatch[2]) : null,
    warnings: totalMatch ? Number(totalMatch[3]) : null,
    expected,
    unexpected,
    raw: output.slice(0, 1000),
  };
}

async function assertNoUnexpectedBrowserConsoleErrors() {
  const consoleOutput = await runPw("console", ["error"]);
  await assertCheck(
    "browser console has no unexpected errors",
    inspectBrowserConsole(consoleOutput),
    value =>
      value?.parsed === true &&
      value?.errors === value?.expected?.length &&
      value?.unexpected?.length === 0
  );
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function routeMatrixTimeout(routeCount) {
  const derivedTimeoutMs = Math.max(
    12000,
    routeCount * (routeMatrixRouteTimeoutMs + 2000)
  );
  return Math.min(commandTimeoutMs, derivedTimeoutMs);
}

async function runRouteMatrix(routes) {
  const results = [];
  for (const routeChunk of chunkItems(routes, routeMatrixChunkSize)) {
    recordProgress("route matrix chunk", {
      firstRoute: routeChunk[0],
      lastRoute: routeChunk[routeChunk.length - 1],
      routeCount: routeChunk.length,
    });
    let chunkResult = await pageEval(inspectRouteMatrixSource(routeChunk), {
      label: `route matrix ${routeChunk[0]} ... ${routeChunk[routeChunk.length - 1]}`,
      timeoutMs: routeMatrixTimeout(routeChunk.length),
    });
    const needsReloadRecovery =
      Array.isArray(chunkResult) &&
      chunkResult.some(result => result?.ready === false && !result?.shell);
    if (needsReloadRecovery) {
      recordProgress("route matrix chunk reload recovery", {
        firstRoute: routeChunk[0],
        lastRoute: routeChunk[routeChunk.length - 1],
        routeCount: routeChunk.length,
      });
      await goto(routeChunk[0]);
      chunkResult = await pageEval(inspectRouteMatrixSource(routeChunk), {
        label: `route matrix recovery ${routeChunk[0]} ... ${routeChunk[routeChunk.length - 1]}`,
        timeoutMs: routeMatrixTimeout(routeChunk.length),
      });
      if (Array.isArray(chunkResult)) {
        chunkResult = chunkResult.map(result => ({
          ...result,
          recoveredAfterReload: true,
        }));
      }
    }
    if (!Array.isArray(chunkResult)) return chunkResult;
    results.push(...chunkResult);
  }
  return results;
}

function inspectSource(expectedPath) {
  return `async () => {
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    for (let i = 0; i < 60; i += 1) {
      const text = normalize(document.body.innerText || document.body.textContent);
      const contentText = normalize(document.querySelector(".platform-content")?.textContent || "");
      const ready = (document.querySelector(".platform-shell") && !text.includes("Loading workspace") && contentText.length > 80) || text.includes("Access denied") || text.includes("Page not found");
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    };
    const stored = localStorage.getItem("nilelearn.auth.session");
    let session = null;
    try { session = stored ? JSON.parse(stored) : null; } catch {}
    const controls = Array.from(document.querySelectorAll("a,button,input,select,textarea")).filter(isVisible);
    const controlName = (element) => {
      const id = element.getAttribute("id");
      const label = id ? document.querySelector(\`label[for="\${CSS.escape(id)}"]\`) : null;
      return normalize(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || label?.textContent || element.closest("label")?.textContent || "");
    };
    const unlabeledControls = controls
      .filter((element) => !controlName(element))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || "",
        className: String(element.className || "").slice(0, 80),
      }))
      .slice(0, 8);
    const tinyControls = controls
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 40 || rect.height < 40;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: controlName(element).slice(0, 60),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .slice(0, 8);
    const shellTinyControls = controls
      .filter((element) => element.closest(".platform-topbar"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 40 || rect.height < 40;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: controlName(element).slice(0, 60),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .slice(0, 8);
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
    const overflowElements = documentOverflow > 1
      ? Array.from(document.body.querySelectorAll("*"))
        .filter(isVisible)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > viewportWidth + 1;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className || "").slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .slice(0, 8)
      : [];
    const text = document.body.innerText || document.body.textContent || "";
    return {
      expectedPath: ${JSON.stringify(expectedPath)},
      path: location.pathname,
      shell: Boolean(document.querySelector(".platform-shell")),
      overflow: documentOverflow,
      sessionRole: session?.activeRole || null,
      provider: session?.provider || null,
      heading: document.querySelector("h1")?.textContent?.trim() || "",
      quoteArabic: document.querySelector(".platform-context-quote strong")?.textContent?.trim() || "",
      quoteMeaning: document.querySelector(".platform-context-quote p")?.textContent?.trim() || "",
      quoteSource: document.querySelector(".platform-context-quote em")?.textContent?.trim() || "",
      textLength: text.trim().length,
      visibleControls: controls.length,
      unlabeledControls,
      tinyControls,
      shellTinyControls,
      mainCount: document.querySelectorAll("main").length,
      skipTarget: document.querySelector(".platform-skip-link")?.getAttribute("href") || "",
      currentNavCount: document.querySelectorAll('.platform-nav-item[aria-current="page"], .platform-nav-item[aria-current="location"]').length,
      searchTrigger: Boolean(document.querySelector('.platform-search-trigger[aria-controls="platform-global-search"]')),
      searchClosed: !document.querySelector("#platform-global-search"),
      portalChrome: {
        sidebar: Boolean(document.querySelector(".platform-desktop-sidebar, .platform-mobile-sidebar")),
        topbar: Boolean(document.querySelector(".platform-topbar")),
        navigation: Boolean(document.querySelector(".platform-nav")),
        content: Boolean(document.querySelector(".platform-content")),
        skipLink: Boolean(document.querySelector(".platform-skip-link"))
      },
      overflowElements,
      accessDenied: text.includes("Access denied"),
      notFound: text.includes("Page not found"),
      errorBoundary: text.includes("Something went wrong")
    };
  }`;
}

function inspectAuthSource(expectedPath) {
  return `async () => {
    for (let i = 0; i < 24; i += 1) {
      const ready = document.querySelector(".auth-modern-page") || document.querySelector(".auth-flow-page");
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    };
    const controls = Array.from(document.querySelectorAll("a,button,input,select,textarea")).filter(isVisible);
    const controlName = (element) => {
      const id = element.getAttribute("id");
      const label = id ? document.querySelector(\`label[for="\${CSS.escape(id)}"]\`) : null;
      return normalize(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || label?.textContent || element.closest("label")?.textContent || "");
    };
    const unlabeledControls = controls
      .filter((element) => !controlName(element))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || "",
        className: String(element.className || "").slice(0, 80),
      }))
      .slice(0, 8);
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
    const overflowElements = documentOverflow > 1
      ? Array.from(document.body.querySelectorAll("*"))
        .filter(isVisible)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > viewportWidth + 1;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className || "").slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .slice(0, 8)
      : [];
    const quoteArabic = document.querySelector(".auth-v2-calligraphy p, .auth-calligraphy-panel strong, .auth-flow-calligraphy strong")?.textContent?.trim() || "";
    const text = normalize(document.body.innerText || document.body.textContent);
    return {
      expectedPath: ${JSON.stringify(expectedPath)},
      path: location.pathname,
      heading: document.querySelector("h1")?.textContent?.trim() || "",
      quoteArabic,
      textLength: text.length,
      visibleControls: controls.length,
      unlabeledControls,
      overflow: documentOverflow,
      overflowElements,
      errorBoundary: text.includes("Something went wrong")
    };
  }`;
}

function inspectPublicSource(expectedPath) {
  return `async () => {
    for (let i = 0; i < 40; i += 1) {
      const text = (document.body.innerText || document.body.textContent || "").replace(/\\s+/g, " ").trim();
      const loading = document.querySelector(".platform-route-loading");
      if (!loading && text.length > 160) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    };
    const controls = Array.from(document.querySelectorAll("a,button,input,select,textarea")).filter(isVisible);
    const controlName = (element) => {
      const id = element.getAttribute("id");
      const label = id ? document.querySelector(\`label[for="\${CSS.escape(id)}"]\`) : null;
      return normalize(element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("alt") || element.textContent || label?.textContent || element.closest("label")?.textContent || element.getAttribute("placeholder") || "");
    };
    const unlabeledControls = controls
      .filter((element) => !controlName(element))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || "",
        className: String(element.className || "").slice(0, 80),
      }))
      .slice(0, 8);
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
    const overflowElements = documentOverflow > 1
      ? Array.from(document.body.querySelectorAll("*"))
        .filter(isVisible)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > viewportWidth + 1;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className || "").slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .slice(0, 8)
      : [];
    const text = normalize(document.body.innerText || document.body.textContent);
    return {
      expectedPath: ${JSON.stringify(expectedPath)},
      path: location.pathname,
      heading: document.querySelector("h1")?.textContent?.trim() || document.querySelector("h2")?.textContent?.trim() || "",
      textLength: text.length,
      visibleControls: controls.length,
      navLinks: Array.from(document.querySelectorAll("nav a")).map((anchor) => anchor.getAttribute("href")).filter(Boolean),
      hasFooter: Boolean(document.querySelector("footer, [role='contentinfo']")),
      hasAuthLinks: Array.from(document.querySelectorAll("a")).some((anchor) => ["/auth/login", "/auth/student-login", "/auth/administration-login"].includes(anchor.getAttribute("href") || "")),
      unlabeledControls,
      overflow: documentOverflow,
      overflowElements,
      errorBoundary: text.includes("Something went wrong"),
      notFound: text.includes("Page not found")
    };
  }`;
}

function inspectRouteMatrixSource(routes) {
  return `async () => {
    const routes = ${JSON.stringify(routes)};
    const routeTimeoutMs = ${JSON.stringify(routeMatrixRouteTimeoutMs)};
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    };
    const inspect = (expectedPath) => {
      const stored = localStorage.getItem("nilelearn.auth.session");
      let session = null;
      try { session = stored ? JSON.parse(stored) : null; } catch {}
      const controls = Array.from(document.querySelectorAll("a,button,input,select,textarea")).filter(isVisible);
      const controlName = (element) => {
        const id = element.getAttribute("id");
        const label = id ? document.querySelector(\`label[for="\${CSS.escape(id)}"]\`) : null;
        return normalize(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || label?.textContent || element.closest("label")?.textContent || "");
      };
      const unlabeledControls = controls
        .filter((element) => !controlName(element))
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute("type") || "",
          className: String(element.className || "").slice(0, 80),
        }))
        .slice(0, 8);
      const viewportWidth = document.documentElement.clientWidth;
      const documentOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
      const overflowElements = documentOverflow > 1
        ? Array.from(document.body.querySelectorAll("*"))
          .filter(isVisible)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > viewportWidth + 1;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              className: String(element.className || "").slice(0, 80),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .slice(0, 8)
        : [];
      const text = document.body.innerText || document.body.textContent || "";
      return {
        expectedPath,
        path: location.pathname,
        shell: Boolean(document.querySelector(".platform-shell")),
        overflow: documentOverflow,
        sessionRole: session?.activeRole || null,
        provider: session?.provider || null,
        heading: document.querySelector("h1")?.textContent?.trim() || "",
        quoteArabic: document.querySelector(".platform-context-quote strong")?.textContent?.trim() || "",
        quoteMeaning: document.querySelector(".platform-context-quote p")?.textContent?.trim() || "",
        quoteSource: document.querySelector(".platform-context-quote em")?.textContent?.trim() || "",
        textLength: text.trim().length,
        visibleControls: controls.length,
        mainCount: document.querySelectorAll("main").length,
        skipTarget: document.querySelector(".platform-skip-link")?.getAttribute("href") || "",
        currentNavCount: document.querySelectorAll('.platform-nav-item[aria-current="page"], .platform-nav-item[aria-current="location"]').length,
        unlabeledControls,
        overflowElements,
        accessDenied: text.includes("Access denied"),
        notFound: text.includes("Page not found"),
        errorBoundary: text.includes("Something went wrong"),
        textSnippet: normalize(text).slice(0, 500),
      };
    };
    const waitForRoute = async (route) => {
      const previousContent = normalize(document.querySelector(".platform-content")?.textContent || "");
      const started = performance.now();
      while (performance.now() - started < routeTimeoutMs) {
        const text = normalize(document.body.innerText || document.body.textContent);
        const contentText = normalize(document.querySelector(".platform-content")?.textContent || "");
        const loading = document.querySelector(".platform-route-loading");
        const moodleSourceLoading = document.querySelector('[data-testid="moodle-source-loading"]');
        const moodleContentLoading = document.querySelector('[data-testid="moodle-content-loading"]');
        const moodleSourceSettled = !route.endsWith("/moodle-source") || Boolean(
          document.querySelector('[data-testid="moodle-source-course"], [data-testid="moodle-source-error"]') ||
          text.includes("No Moodle courses are assigned")
        );
        const moodleContentRoute = route.includes("/moodle-source/");
        const moodleContentSettled = !moodleContentRoute || Boolean(
          document.querySelector('[data-testid="moodle-content-ready"], [data-testid="moodle-content-error"], [data-testid="moodle-content-empty"]')
        );
        const hasMessageWorkspace = Boolean(
          document.querySelector('[data-testid^="portal-messages-inbox-"]')
        );
        const changed = contentText !== previousContent;
        const settled = performance.now() - started > 700;
        if (
          location.pathname === route &&
          document.querySelector(".platform-shell") &&
          !text.includes("Loading workspace") &&
          (contentText.length > 80 || hasMessageWorkspace) &&
          !loading &&
          !moodleSourceLoading &&
          !moodleContentLoading &&
          moodleSourceSettled &&
          moodleContentSettled &&
          (changed || settled)
        ) {
          return true;
        }
        await delay(100);
      }
      return false;
    };
    const results = [];
    for (const route of routes) {
      history.pushState({}, "", route);
      window.dispatchEvent(new PopStateEvent("popstate"));
      const ready = await waitForRoute(route);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      results.push({ ...inspect(route), ready });
    }
    return results;
  }`;
}

function loginSource(role, { resetPlatformState = false } = {}) {
  return `async () => {
    localStorage.clear();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ${JSON.stringify(loginTimeoutMs)});
    let response = null;
    let text = "";
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Nile-Learn-Request": "browser" },
        signal: controller.signal,
        body: JSON.stringify({
          email: ${JSON.stringify(role.email)},
          password: ${JSON.stringify(password)},
          role: ${JSON.stringify(role.role)}
        })
      });
      text = await response.text();
    } catch (error) {
      return {
        ok: false,
        status: 0,
        aborted: controller.signal.aborted,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      clearTimeout(timeout);
    }
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      return { ok: false, status: response.status, body: text.slice(0, 180) };
    }
    localStorage.setItem("nilelearn.auth.session", JSON.stringify(payload));
    localStorage.setItem("nilelearn.activeRole", ${JSON.stringify(role.role)});
    let reset = null;
    if (${JSON.stringify(resetPlatformState)}) {
      localStorage.removeItem(${JSON.stringify(platformStorageKey)});
      const resetResponse = await fetch("/api/platform/state/reset", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Nile-Learn-Request": "browser",
          "X-Nile-Learn-QA-Reset": "1"
        },
        body: "{}"
      });
      if (!resetResponse.ok) {
        const resetText = await resetResponse.text().catch(() => "");
        reset = {
          ok: false,
          status: resetResponse.status,
          body: resetText.slice(0, 180)
        };
      } else {
        const resetPayload = await resetResponse.json();
        reset = { ok: true, persistence: resetPayload?.persistence };
      }
    }
    return { ok: true, status: response.status, provider: payload?.provider, activeRole: payload?.activeRole, reset };
  }`;
}

function workflowSetupSource(body) {
  return `async () => {
    const fixtureHeaders = {
      "Content-Type": "application/json",
      "X-Nile-Learn-Request": "browser",
      "X-Nile-Learn-QA-Fixture": "1"
    };
    const loadState = async () => {
      const response = await fetch("/api/platform/state/qa-fixture", {
        credentials: "include",
        headers: fixtureHeaders
      });
      if (!response.ok) throw new Error("QA fixture state could not be read");
      const payload = await response.json();
      return payload?.state ?? {};
    };
    let stateCache = await loadState();
    const readState = () => stateCache;
    const pendingWrites = [];
    const writeState = (state) => {
      stateCache = state;
      const write = fetch("/api/platform/state/qa-fixture", {
        method: "POST",
        credentials: "include",
        headers: fixtureHeaders,
        body: JSON.stringify({ state })
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.text()) || "QA fixture state could not be written");
        }
        return response.json();
      });
      pendingWrites.push(write);
      return write;
    };
    try {
      const execute = async () => {
        ${body}
      };
      const result = await execute();
      await Promise.all(pendingWrites);
      return {
        ...(result && typeof result === "object" ? result : { ok: Boolean(result) }),
        fixtureWritten: pendingWrites.length > 0
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }`;
}

function workflowActionSource(body) {
  return `async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const fixtureHeaders = {
      "Content-Type": "application/json",
      "X-Nile-Learn-Request": "browser",
      "X-Nile-Learn-QA-Fixture": "1"
    };
    const originalFetch = window.fetch.bind(window);
    const loadState = async () => {
      const response = await originalFetch("/api/platform/state/qa-fixture", {
        credentials: "include",
        headers: fixtureHeaders
      });
      if (!response.ok) throw new Error("QA fixture state could not be read");
      const payload = await response.json();
      return payload?.state ?? {};
    };
    let stateCache = await loadState();
    const readState = () => stateCache;
    const writeState = async (state) => {
      const response = await originalFetch("/api/platform/state/qa-fixture", {
        method: "POST",
        credentials: "include",
        headers: fixtureHeaders,
        body: JSON.stringify({ state })
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "QA fixture state could not be written");
      }
      stateCache = state;
      return state;
    };
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (response.ok && requestUrl.includes("/api/platform/state/actions")) {
        stateCache = await loadState();
      }
      return response;
    };
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const waitFor = async (predicate, timeout = ${JSON.stringify(workflowActionTimeoutMs)}) => {
      const started = performance.now();
      let last = null;
      while (performance.now() - started < timeout) {
        last = predicate();
        if (last) return last;
        await delay(60);
      }
      return last;
    };
    const clickButton = async (label, exact = false) => {
      const expected = normalize(label).toLowerCase();
      const matches = Array.from(document.querySelectorAll("button"))
        .filter((button) => visible(button) && !button.disabled)
        .filter((button) => {
          const text = normalize(button.textContent).toLowerCase();
          return exact ? text === expected : text.includes(expected);
        });
      if (!matches.length) {
        throw new Error(\`Button not found: \${label}\`);
      }
      matches[0].click();
      await delay(90);
      return normalize(matches[0].textContent);
    };
    const clickButtonWithin = async (rootSelector, label, exact = false) => {
      const root = document.querySelector(rootSelector);
      if (!root) throw new Error(\`Root not found: \${rootSelector}\`);
      const expected = normalize(label).toLowerCase();
      const matches = Array.from(root.querySelectorAll("button"))
        .filter((button) => visible(button) && !button.disabled)
        .filter((button) => {
          const text = normalize(button.textContent).toLowerCase();
          return exact ? text === expected : text.includes(expected);
        });
      if (!matches.length) {
        throw new Error(\`Button not found in \${rootSelector}: \${label}\`);
      }
      matches[0].click();
      await delay(90);
      return normalize(matches[0].textContent);
    };
    const setValue = (element, value) => {
      if (!element) throw new Error("Input not found");
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) descriptor.set.call(element, value);
      else element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setByLabel = (label, value) => {
      const expected = normalize(label).toLowerCase();
      const labels = Array.from(document.querySelectorAll("label"));
      const match = labels.find((item) =>
        normalize(item.querySelector(":scope > span")?.textContent).toLowerCase() === expected
      ) || labels.find((item) =>
        normalize(item.textContent).toLowerCase().includes(expected)
      );
      const control = match?.querySelector("input, select, textarea") ||
        (match?.htmlFor ? document.getElementById(match.htmlFor) : null);
      if (!control) throw new Error(\`Control not found for label: \${label}\`);
      setValue(control, value);
    };
    const answerQuizQuestions = async () => {
      const questionCards = Array.from(document.querySelectorAll(".platform-quiz-question-card"));
      for (const card of questionCards) {
        const textarea = card.querySelector("textarea");
        if (textarea && visible(textarea) && !textarea.disabled) {
          setValue(textarea, "A complete QA short answer");
          continue;
        }
        const textInput = Array.from(card.querySelectorAll("input"))
          .find((input) => visible(input) && !input.disabled && !["hidden", "radio", "checkbox"].includes((input.getAttribute("type") || "text").toLowerCase()));
        if (textInput) {
          setValue(textInput, "A complete QA short answer");
          continue;
        }
        const choice = Array.from(card.querySelectorAll(".platform-quiz-choice-grid button, .platform-quiz-storage-state button"))
          .find((button) => visible(button) && !button.disabled);
        if (choice) {
          choice.click();
          await delay(80);
        }
      }
    };
    const goto = (route) => {
      history.pushState({}, "", route);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };

    try {
      await waitFor(() => {
        const text = normalize(document.body.innerText || document.body.textContent);
        const contentText = normalize(document.querySelector(".platform-content")?.textContent || "");
        return document.querySelector(".platform-shell") && document.querySelector(".platform-content") && !document.querySelector(".platform-route-loading") && !text.includes("Loading workspace") && contentText.length > 80;
      }, ${JSON.stringify(workflowReadyTimeoutMs)});
      ${body}
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        path: location.pathname,
        visibleText: normalize(document.body.innerText || document.body.textContent).slice(0, 700)
      };
    } finally {
      window.fetch = originalFetch;
    }
  }`;
}

function publicFormWorkflowActionSource(body) {
  return `async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const waitFor = async (predicate, timeout = ${JSON.stringify(workflowActionTimeoutMs)}) => {
      const started = performance.now();
      let last = null;
      while (performance.now() - started < timeout) {
        last = predicate();
        if (last) return last;
        await delay(60);
      }
      return last;
    };
    const setValue = (element, value) => {
      if (!element) throw new Error("Input not found");
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) descriptor.set.call(element, value);
      else element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setByLabel = (label, value) => {
      const expected = normalize(label).toLowerCase();
      const labels = Array.from(document.querySelectorAll("label"));
      const match = labels.find((item) =>
        normalize(item.querySelector(":scope > span")?.textContent).toLowerCase() === expected
      ) || labels.find((item) =>
        normalize(item.textContent).toLowerCase().includes(expected)
      );
      const control = match?.querySelector("input, select, textarea") ||
        (match?.htmlFor ? document.getElementById(match.htmlFor) : null);
      if (!control) throw new Error(\`Control not found for label: \${label}\`);
      setValue(control, value);
    };
    const clickButton = async (label, exact = false, root = document) => {
      const expected = normalize(label).toLowerCase();
      const button = Array.from(root.querySelectorAll("button"))
        .filter((item) => visible(item) && !item.disabled)
        .find((item) => {
          const text = normalize(item.textContent).toLowerCase();
          return exact ? text === expected : text.includes(expected);
        });
      if (!button) throw new Error(\`Button not found: \${label}\`);
      button.click();
      await delay(90);
    };
    try {
      await waitFor(() => document.querySelector(".nile-form-renderer form"));
      ${body}
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        path: location.pathname,
        visibleText: normalize(document.body.innerText || document.body.textContent).slice(0, 700)
      };
    }
  }`;
}

function routeReadySource(expectedPath) {
  return `async () => {
    const timeoutMs = ${JSON.stringify(routeReadyTimeoutMs)};
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const started = performance.now();
    const isMoodleContentRoute = ${JSON.stringify(expectedPath)}.includes("/moodle-source/");
    while (performance.now() - started < timeoutMs) {
      const loading = document.querySelector("main.platform-route-loading");
      const shell = document.querySelector(".platform-shell");
      const content = document.querySelector(".platform-content");
      const accessDenied = normalize(document.body.innerText || document.body.textContent).includes("Access denied");
      const standaloneAccessDenied = accessDenied && !shell && Boolean(document.querySelector(".platform-access-denied"));
      const moodleContentLoading = document.querySelector('[data-testid="moodle-content-loading"]');
      const moodleContentSettled = !isMoodleContentRoute || Boolean(
        document.querySelector('[data-testid="moodle-content-ready"], [data-testid="moodle-content-empty"], [data-testid="moodle-content-error"]')
      );
      if (location.pathname === ${JSON.stringify(expectedPath)} && !loading && !moodleContentLoading && moodleContentSettled && ((shell && content) || standaloneAccessDenied)) {
        return { ok: true, path: location.pathname, shell: Boolean(shell), content: Boolean(content), standaloneAccessDenied };
      }
      await delay(100);
    }
    return {
      ok: false,
      path: location.pathname,
      hasLoading: Boolean(document.querySelector("main.platform-route-loading")),
      hasShell: Boolean(document.querySelector(".platform-shell")),
      hasContent: Boolean(document.querySelector(".platform-content")),
      text: normalize(document.body.innerText || document.body.textContent).slice(0, 500)
    };
  }`;
}

function navigateAndReadySource(expectedPath) {
  return `async () => {
    history.pushState({}, "", ${JSON.stringify(expectedPath)});
    window.dispatchEvent(new PopStateEvent("popstate"));
    const timeoutMs = ${JSON.stringify(routeReadyTimeoutMs)};
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const started = performance.now();
    const isMoodleContentRoute = ${JSON.stringify(expectedPath)}.includes("/moodle-source/");
    while (performance.now() - started < timeoutMs) {
      const loading = document.querySelector("main.platform-route-loading");
      const shell = document.querySelector(".platform-shell");
      const content = document.querySelector(".platform-content");
      const accessDenied = normalize(document.body.innerText || document.body.textContent).includes("Access denied");
      const standaloneAccessDenied = accessDenied && !shell && Boolean(document.querySelector(".platform-access-denied"));
      const moodleContentLoading = document.querySelector('[data-testid="moodle-content-loading"]');
      const moodleContentSettled = !isMoodleContentRoute || Boolean(
        document.querySelector('[data-testid="moodle-content-ready"], [data-testid="moodle-content-empty"], [data-testid="moodle-content-error"]')
      );
      if (location.pathname === ${JSON.stringify(expectedPath)} && !loading && !moodleContentLoading && moodleContentSettled && ((shell && content) || standaloneAccessDenied)) {
        return { ok: true, path: location.pathname, shell: Boolean(shell), content: Boolean(content), standaloneAccessDenied };
      }
      await delay(100);
    }
    return {
      ok: false,
      path: location.pathname,
      hasLoading: Boolean(document.querySelector("main.platform-route-loading")),
      hasShell: Boolean(document.querySelector(".platform-shell")),
      hasContent: Boolean(document.querySelector(".platform-content")),
      text: normalize(document.body.innerText || document.body.textContent).slice(0, 500)
    };
  }`;
}

async function authenticateRole(role, checkName, details = {}) {
  assertRunBudget(`authenticating ${role.role}`);
  const loginResult = await pageEval(loginSource(role), {
    label: `login ${role.role}`,
    timeoutMs: Math.min(
      commandTimeoutMs,
      Math.max(loginTimeoutMs + 5000, 30000)
    ),
  });
  if (loginResult?.ok && loginResult.provider) {
    authenticatedProviders.set(role.role, loginResult.provider);
  }
  return assertCheck(
    checkName,
    loginResult,
    value => value?.ok && value?.activeRole === role.role,
    {
      role: role.role,
      ...details,
    }
  );
}

async function authenticateRoleAndReset(
  role,
  loginCheckName,
  resetCheckName,
  details = {}
) {
  assertRunBudget(`authenticating and resetting ${role.role}`);
  const loginResult = await pageEval(
    loginSource(role, { resetPlatformState: true }),
    {
      label: `login and reset ${role.role}`,
      timeoutMs: Math.min(
        commandTimeoutMs,
        Math.max(loginTimeoutMs + 5000, 30000)
      ),
    }
  );
  if (loginResult?.ok && loginResult.provider) {
    authenticatedProviders.set(role.role, loginResult.provider);
  }
  const loginOk = await assertCheck(
    loginCheckName,
    loginResult,
    value => value?.ok && value?.activeRole === role.role,
    { role: role.role, ...details }
  );
  const resetOk = await assertCheck(
    resetCheckName,
    loginResult?.reset,
    value => value?.ok,
    { role: role.role, ...details }
  );
  return loginOk && resetOk;
}

async function navigateToProtectedRoute(
  role,
  route,
  checkName,
  details = {},
  { hardReload = false } = {}
) {
  assertRunBudget(`navigating ${route}`);
  if (hardReload) await goto(route);
  const readinessSource = hardReload
    ? routeReadySource(route)
    : navigateAndReadySource(route);
  let routeReady = await pageEval(readinessSource, {
    label: `navigate and wait ${route}`,
  });
  let recoveredTransientNotFound = false;
  if (
    !routeReady?.ok &&
    routeReady?.path === route &&
    routeReady?.text === "Not Found"
  ) {
    if (hardReload) await goto(route);
    routeReady = await pageEval(readinessSource, {
      label: `retry navigation and wait ${route}`,
    });
    recoveredTransientNotFound = Boolean(routeReady?.ok);
  }
  const ok = await assertCheck(checkName, routeReady, value => value?.ok, {
    role: role.role,
    route,
    recoveredTransientNotFound,
    ...details,
  });
  return { ok, routeReady };
}

async function runDeepWorkflow({
  name,
  role: roleName,
  route,
  source,
  predicate,
  setupSource,
  reloadAfterSetup = true,
}) {
  recordProgress(`workflow: ${name}`, { role: roleName, route });
  assertRunBudget(`running workflow ${name}`);
  const role = roles.find(item => item.role === roleName);
  if (!role) throw new Error(`Unknown role for deep workflow: ${roleName}`);

  const loginAndResetOk = await authenticateRoleAndReset(
    role,
    `${name} login`,
    `${name} reset platform state`,
    {
      role: role.role,
      route,
      deepWorkflow: true,
    }
  );
  if (!loginAndResetOk) return;
  const { ok: initialRouteReady } = await navigateToProtectedRoute(
    role,
    route,
    `${name} route ready`,
    { deepWorkflow: true },
    { hardReload: true }
  );
  if (!initialRouteReady) return;

  if (setupSource) {
    const setupResult = await pageEval(setupSource);
    await assertCheck(`${name} setup`, setupResult, value => value?.ok, {
      role: role.role,
      route,
      deepWorkflow: true,
    });
    if (reloadAfterSetup) {
      const { ok: routeReadyAfterSetupOk } = await navigateToProtectedRoute(
        role,
        route,
        `${name} route ready after setup`,
        {
          deepWorkflow: true,
        },
        { hardReload: true }
      );
      if (!routeReadyAfterSetupOk) return;
    } else if (setupResult?.fixtureWritten) {
      await goto(route);
      const fixtureRouteReady = await pageEval(routeReadySource(route), {
        label: `reload fixture and wait ${route}`,
      });
      if (!fixtureRouteReady?.ok) {
        await assertCheck(
          `${name} route ready after fixture`,
          fixtureRouteReady,
          value => value?.ok,
          { role: role.role, route, deepWorkflow: true }
        );
        return;
      }
    }
  }

  const result = await pageEval(source);
  await assertCheck(name, result, predicate, {
    role: role.role,
    route,
    deepWorkflow: true,
  });
}

async function runPublicFormWorkflow({ name, route, source, predicate }) {
  recordProgress(`workflow: ${name}`, { route });
  assertRunBudget(`running workflow ${name}`);
  await goto(route);
  const routeCheck = await pageEval(inspectPublicSource(route));
  const routeReady = await assertCheck(
    `${name} route ready`,
    routeCheck,
    value =>
      value?.path === route &&
      Boolean(value?.heading) &&
      value?.errorBoundary === false &&
      value?.notFound === false,
    { route, publicWorkflow: true }
  );
  if (!routeReady) return;
  const result = await pageEval(source);
  await assertCheck(name, result, predicate, {
    route,
    publicWorkflow: true,
  });
}

async function runFormsRoleDenialChecks() {
  const student = roles.find(item => item.role === "student");
  if (!student)
    throw new Error("Student role is unavailable for Forms denial checks");
  recordProgress("Nile Forms role denials", { role: student.role });
  const loginOk = await authenticateRole(
    student,
    "student Forms denial checks login"
  );
  if (!loginOk) return;

  const apiDenials = await pageEval(`async () => {
    const responses = await Promise.all([
      fetch("/api/forms/definitions", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Nile-Learn-Request": "browser"
        },
        body: JSON.stringify({
          key: "qa-student-denied",
          titleEn: "Denied QA form",
          titleAr: "Denied QA form",
          titleTr: "Denied QA form",
          category: "student_support"
        })
      }),
      fetch("/api/forms/submissions", { credentials: "include" })
    ]);
    return Promise.all(responses.map(async (response) => ({
      status: response.status,
      body: (await response.text()).slice(0, 240)
    })));
  }`);
  await assertCheck(
    "student API cannot manage Nile Forms definitions",
    apiDenials?.[0],
    value => value?.status === 403,
    { role: student.role, route: "POST /api/forms/definitions" }
  );
  await assertCheck(
    "student API cannot review Nile Forms submissions",
    apiDenials?.[1],
    value => value?.status === 403,
    { role: student.role, route: "/api/forms/submissions" }
  );

  for (const route of [
    "/app/registrar/forms/manage",
    "/app/registrar/forms/review",
  ]) {
    await goto(route);
    const denial = await pageEval(inspectSource(route));
    await assertCheck(
      `student direct access to ${route} is denied`,
      denial,
      value =>
        value?.path === route &&
        value?.shell === false &&
        value?.accessDenied === true &&
        value?.portalChrome?.sidebar === false &&
        value?.portalChrome?.topbar === false &&
        value?.portalChrome?.navigation === false &&
        value?.portalChrome?.content === false &&
        value?.portalChrome?.skipLink === false &&
        value?.errorBoundary === false,
      { role: student.role, route }
    );
  }

  const registrar = roles.find(item => item.role === "registrar");
  if (!registrar)
    throw new Error("Registrar role is unavailable for Forms denial checks");
  const registrarLoginOk = await authenticateRole(
    registrar,
    "registrar Forms ownership denial checks login"
  );
  if (!registrarLoginOk) return;

  const globalDefinitionDenial = await pageEval(`async () => {
    const response = await fetch("/api/forms/definitions/form_application", {
      credentials: "include",
      headers: { "X-Nile-Learn-Request": "browser" }
    });
    return {
      status: response.status,
      body: (await response.text()).slice(0, 240)
    };
  }`);
  await assertCheck(
    "registrar cannot manage a global Super Admin form definition",
    globalDefinitionDenial,
    value =>
      value?.status === 403 && value?.body?.includes("form_scope_denied"),
    {
      role: registrar.role,
      route: "/api/forms/definitions/form_application",
    }
  );

  for (const route of [
    "/app/registrar/forms/manage/form_application/builder",
    "/app/registrar/forms/manage/form_application/publish",
  ]) {
    await goto(route);
    const denial = await pageEval(`async () => {
      for (let index = 0; index < 40; index += 1) {
        const text = (document.body.innerText || document.body.textContent || "")
          .replace(/\\s+/g, " ")
          .trim();
        if (text.includes("Form scope denied")) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const text = (document.body.innerText || document.body.textContent || "")
        .replace(/\\s+/g, " ")
        .trim();
      return {
        path: location.pathname,
        shell: Boolean(document.querySelector(".platform-shell")),
        scopeDenied: text.includes("Form scope denied"),
        hasRecoveryLink: Array.from(document.querySelectorAll("a")).some(
          anchor => anchor.getAttribute("href") === "/app/registrar/forms/manage"
        )
      };
    }`);
    await assertCheck(
      `registrar direct access to ${route} shows the scoped unavailable state`,
      denial,
      value =>
        value?.path === route &&
        value?.shell === true &&
        value?.scopeDenied === true &&
        value?.hasRecoveryLink === true,
      { role: registrar.role, route }
    );
  }
}

const publicFormWorkflowCases = [
  {
    name: "public Nile Form submits a valid enquiry and confirms receipt",
    route: "/forms/free-trial-enquiry",
    source: publicFormWorkflowActionSource(`
      setByLabel("Full name", "Portal QA ${session}");
      setByLabel("Email", "portal-qa-${process.pid}@example.test");
      setByLabel("Phone", "+201000${process.pid}");
      setByLabel("Preferred branch", "br_cairo");
      setByLabel("Course interest", "arabic");
      setByLabel("Preferred contact", "email");
      setByLabel("Anything else?", "Deterministic Phase 13 public form coverage.");
      await clickButton("Submit", true);
      const success = await waitFor(() => document.querySelector('.nile-form-success[role="status"]'));
      return {
        ok: Boolean(success),
        heading: normalize(success?.querySelector("h2")?.textContent),
        confirmation: normalize(success?.querySelector("p")?.textContent),
        submissionId: normalize(success?.querySelector("small")?.textContent)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.heading === "Response submitted" &&
      value?.confirmation === "Your response has been received." &&
      Boolean(value?.submissionId),
  },
];
const formsRoleDenialWorkflowName =
  "Nile Forms management, review, and ownership scope is enforced";

const deepWorkflowCases = [
  {
    name: "student assigned Nile Form submits and renders its recorded response",
    role: "student",
    route: "/app/student/forms/publication_form_support_1",
    source: workflowActionSource(`
      const form = await waitFor(() => document.querySelector(".nile-form-renderer form"));
      if (!form) throw new Error("Assigned support form was not rendered");
      const beforeResponse = await fetch("/api/forms/assigned/publication_form_support_1", { credentials: "include" });
      const beforePayload = beforeResponse.ok ? await beforeResponse.json() : null;
      const beforeSubmissionIds = new Set(
        (beforePayload?.previousSubmissions || []).map((item) => item.id)
      );
      const subject = "Portal QA support ${session}";
      setByLabel("Category", "technical");
      setByLabel("Subject", subject);
      setByLabel("Details", "Deterministic Phase 13 assigned respondent lifecycle coverage.");
      await clickButtonWithin('[data-field-id="urgent"] [role="group"]', "No", true);
      await clickButton("Submit", true);
      let submissionId = "";
      for (let attempt = 0; attempt < 40 && !submissionId; attempt += 1) {
        const response = await fetch("/api/forms/assigned/publication_form_support_1", { credentials: "include" });
        const payload = response.ok ? await response.json() : null;
        submissionId = payload?.previousSubmissions?.find(
          (item) => !beforeSubmissionIds.has(item.id)
        )?.id || "";
        if (!submissionId) await delay(100);
      }
      if (!submissionId) throw new Error("Assigned form submission ID was not returned");
      const responseRoute = "/app/student/forms/publication_form_support_1/responses/" + encodeURIComponent(submissionId);
      goto(responseRoute);
      const detail = await waitFor(() => document.querySelector('[data-testid="nile-form-response-detail"]'));
      const status = document.querySelector('[data-testid="nile-form-response-status"]');
      return {
        ok: Boolean(detail),
        responseRoute,
        path: location.pathname,
        status: normalize(status?.textContent),
        hasSubject: normalize(document.querySelector(".nile-form-review-answers")?.textContent).includes(subject),
        submissionId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.path === value?.responseRoute &&
      value?.status === "Submitted" &&
      value?.hasSubject === true &&
      Boolean(value?.submissionId),
  },
  {
    name: "superadmin Nile Forms assignment workflow assigns and revokes one scoped user",
    role: "superadmin",
    route:
      "/app/admin/forms/manage/form_support/publications/publication_form_support_1/assignments",
    source: workflowActionSource(`
      const panel = await waitFor(() => document.querySelector(".nile-form-assignment-panel"));
      if (!panel) throw new Error("Assignment manager did not render");

      setByLabel("Target", "user");
      await delay(120);
      setByLabel("Person", "usr_hod_demo");
      await clickButtonWithin(".nile-form-assignment-panel", "Assign", true);
      const assignedNotice = await waitFor(() =>
        normalize(document.querySelector(".nile-form-notice")?.textContent).includes("Assignment added")
      );
      if (!assignedNotice) throw new Error("Assignment success state did not render");

      const assignmentRow = Array.from(
        document.querySelectorAll(".nile-form-assignment-list > div")
      ).find(row => normalize(row.textContent).includes("HOD Demo"));
      if (!assignmentRow) throw new Error("Assigned HOD row did not render");
      const revokeButton = Array.from(assignmentRow.querySelectorAll("button")).find(
        button => normalize(button.textContent) === "Revoke" && !button.disabled
      );
      if (!revokeButton) throw new Error("Revoke control did not render");
      revokeButton.click();

      const revokedNotice = await waitFor(() =>
        normalize(document.querySelector(".nile-form-notice")?.textContent).includes("Assignment revoked")
      );
      if (!revokedNotice) throw new Error("Assignment revoke state did not render");

      const response = await fetch("/api/forms/definitions/form_support", {
        credentials: "include",
        headers: { "X-Nile-Learn-Request": "browser" }
      });
      const payload = await response.json();
      const assignment = payload?.assignments?.find(item =>
        item?.target?.type === "user" && item?.target?.userId === "usr_hod_demo"
      );
      return {
        ok: response.ok && Boolean(assignment?.revokedAt),
        assignmentId: assignment?.id,
        revokedAt: assignment?.revokedAt,
        visibleNotice: normalize(document.querySelector(".nile-form-notice")?.textContent)
      };
    `),
    predicate: value =>
      value?.ok === true &&
      Boolean(value?.assignmentId) &&
      Boolean(value?.revokedAt) &&
      value?.visibleNotice === "Assignment revoked.",
  },
  {
    name: "student shell search, branch, and notifications are connected",
    role: "student",
    route: "/app/student/dashboard",
    source: workflowActionSource(`
      const branchSelector = document.querySelector('select[aria-label="Learning branch"], select[aria-label="Branch selector"]');
      if (branchSelector) setValue(branchSelector, "Online");
      const storedBranch = localStorage.getItem("nilelearn.branch.student") || "Online";
      const notificationButton = await waitFor(() => document.querySelector('button[aria-label="Notifications"]'));
      if (!notificationButton) throw new Error("Notifications button not found");
      notificationButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await waitFor(() => document.querySelector(".platform-notification-popover"));
      const markReadButton = document.querySelector(".platform-notification-popover .platform-popover-title button");
      if (!markReadButton) throw new Error("Mark read control not found");
      markReadButton.click();
      const state = await waitFor(() => {
        const next = readState();
        return next.notifications?.filter((item) => item.userId === "usr_student_demo").every((item) => item.read) ? next : null;
      });
      const searchClosed = !document.querySelector("#platform-global-search");
      const searchTrigger = document.querySelector('.platform-search-trigger[aria-controls="platform-global-search"]');
      if (!searchTrigger) throw new Error("Global search disclosure was not rendered");
      searchTrigger.click();
      const searchRegion = await waitFor(() => document.querySelector('#platform-global-search[role="search"]'));
      const searchInput = searchRegion?.querySelector('input[aria-label="Global search"]');
      if (!searchInput) throw new Error("Global search input was not disclosed");
      setValue(searchInput, "Grammar worksheet");
      await waitFor(() => document.querySelector(".platform-search-results button"));
      await clickButton("Grammar worksheet");
      const navigatedPath = await waitFor(() => location.pathname.includes("/app/student/assignments/asg_ar_grammar") ? location.pathname : null);
      const scopedResponse = await fetch("/api/platform/state", { credentials: "include" });
      const scopedPayload = scopedResponse.ok ? await scopedResponse.json() : null;
      const scopedState = scopedPayload?.state;
      const scopeIsNarrow =
        !scopedState?.courseRuns?.some((item) => item.id === "run_ar_l1_alex_2026") &&
        !scopedState?.classGroups?.some((item) => item.id === "class_ar_l3_cairo") &&
        !scopedState?.events?.some((item) => item.branchId === "br_alex") &&
        scopedState?.classGroups?.every((item) =>
          (item.studentIds || []).every((studentId) => studentId === "stu_demo")
        );
      return {
        ok: Boolean(storedBranch === "Online" && navigatedPath && state && searchClosed && searchRegion && scopeIsNarrow),
        storedBranch,
        navigatedPath,
        searchClosed,
        searchDisclosed: Boolean(searchRegion),
        unread: state?.notifications?.filter((item) => item.userId === "usr_student_demo" && !item.read).length,
        scopeIsNarrow
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.storedBranch === "Online" &&
      value?.searchClosed === true &&
      value?.searchDisclosed === true &&
      value?.scopeIsNarrow === true &&
      value?.unread === 0,
  },
  {
    name: "student learning workflow completes next lesson and persists progress",
    role: "student",
    route: "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
    setupSource: workflowSetupSource(`
      const state = readState();
      const progress = state.lessonProgress?.find((item) => item.lessonId === "lesson_ar_conditional" && item.studentId === "stu_demo" && item.enrollmentId === "enr_ar_l3");
      if (progress) {
        progress.status = "in_progress";
        delete progress.completedAt;
      } else {
        state.lessonProgress = state.lessonProgress || [];
        state.lessonProgress.push({
          id: "lp_ar_conditional_qa",
          studentId: "stu_demo",
          enrollmentId: "enr_ar_l3",
          lessonId: "lesson_ar_conditional",
          status: "in_progress",
          notes: "QA deterministic setup."
        });
      }
      state.auditLogs = (state.auditLogs || []).filter((item) => item.action !== "lesson.completed" || item.entityId !== "lesson_ar_conditional");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await waitFor(() => !document.querySelector(".learning-sync-pill.loading"), 5000);
      const before = readState();
      await waitFor(() => {
        const actions = document.querySelector(".learning-player-actions");
        return Array.from(actions?.querySelectorAll("button") || []).some((button) => visible(button) && !button.disabled && normalize(button.textContent).includes("Mark complete"));
      });
      const beforeProgress = before.enrollments?.find((item) => item.id === "enr_ar_l3")?.progress ?? 0;
      const moduleIds = new Set((before.modules || []).filter((item) => item.courseId === "course_ar_l3").map((item) => item.id));
      const lessonIds = new Set((before.lessons || []).filter((item) => moduleIds.has(item.moduleId)).map((item) => item.id));
      const completedLessonIds = new Set((before.lessonProgress || [])
        .filter((item) => item.enrollmentId === "enr_ar_l3" && item.status === "completed" && lessonIds.has(item.lessonId))
        .map((item) => item.lessonId));
      completedLessonIds.add("lesson_ar_conditional");
      const expectedProgress = lessonIds.size ? Math.round((completedLessonIds.size / lessonIds.size) * 100) : 0;
      await clickButtonWithin(".learning-player-actions", "Mark complete");
      const after = await waitFor(() => {
        const state = readState();
        const progress = state.enrollments?.find((item) => item.id === "enr_ar_l3")?.progress ?? 0;
        const completed = state.lessonProgress?.some((item) => item.lessonId === "lesson_ar_conditional" && item.enrollmentId === "enr_ar_l3" && item.status === "completed");
        return progress === expectedProgress && completed ? state : null;
      });
      const adminLogin = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Nile-Learn-Request": "browser" },
        body: JSON.stringify({
          email: "a@nl.test",
          password: ${JSON.stringify(password)},
          role: "superadmin"
        })
      });
      const adminStateResponse = adminLogin.ok
        ? await fetch("/api/platform/state", { credentials: "include" })
        : null;
      const adminStatePayload = adminStateResponse?.ok
        ? await adminStateResponse.json()
        : null;
      const auditVerified = adminStatePayload?.state?.auditLogs?.some(
        (item) =>
          item.action === "lesson.completed" &&
          item.entityId === "lesson_ar_conditional" &&
          item.actorId === "usr_student_demo"
      );
      return {
        ok: Boolean(after),
        beforeProgress,
        expectedProgress,
        afterProgress: after?.enrollments?.find((item) => item.id === "enr_ar_l3")?.progress,
        auditVerified
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.afterProgress === value?.expectedProgress &&
      value?.auditVerified === true,
  },
  {
    name: "student assignment workflow submits edited response",
    role: "student",
    route: "/app/student/assignments/asg_ar_grammar",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.assignmentSubmissions = (state.assignmentSubmissions || []).filter((item) => item.assignmentId !== "asg_ar_grammar");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      const response = "QA response " + Date.now();
      const workspace = await waitFor(() => document.querySelector(".student-assignment-workspace"));
      if (!workspace) throw new Error("Student assignment workspace not found");
      setValue(workspace.querySelector('textarea[aria-label="Assignment response"]'), response);
      await clickButtonWithin(".student-assignment-workspace", "Submit assignment", true);
      const state = await waitFor(() => {
        const next = readState();
        return next.assignmentSubmissions?.some((item) => item.assignmentId === "asg_ar_grammar" && item.response === response) ? next : null;
      });
      const submission = state?.assignmentSubmissions?.find((item) => item.assignmentId === "asg_ar_grammar" && item.response === response);
      return {
        ok: Boolean(state),
        response: submission?.response,
        notification: state?.notifications?.[0]?.title,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value => value?.ok && value?.response?.startsWith("QA response"),
  },
  {
    name: "student manual quiz workflow creates pending review attempt",
    role: "student",
    route: "/app/student/quizzes/quiz_ar_3",
    setupSource: workflowSetupSource(`return { ok: true };`),
    reloadAfterSetup: true,
    source: workflowActionSource(`
      const before = readState();
      const beforeAttemptIds = new Set((before.quizAttempts || []).filter((item) => item.quizId === "quiz_ar_3").map((item) => item.id));
      const beforeGradeIds = new Set((before.grades || []).filter((item) => item.itemId === "quiz_ar_3").map((item) => item.id));
      const beforeAttempts = beforeAttemptIds.size;
      const quizCard = await waitFor(() => document.querySelector(".student-quiz-workspace"));
      if (!quizCard) throw new Error("Grammar Quiz 3 card was not rendered");
      for (const card of Array.from(quizCard.querySelectorAll(".student-quiz-question"))) {
        const textarea = card.querySelector("textarea");
        if (textarea && visible(textarea) && !textarea.disabled) {
          setValue(textarea, "A complete QA short answer");
          continue;
        }
        const textInput = Array.from(card.querySelectorAll("input"))
          .find((input) => visible(input) && !input.disabled && !["hidden", "radio", "checkbox"].includes((input.getAttribute("type") || "text").toLowerCase()));
        if (textInput) {
          setValue(textInput, "A complete QA short answer");
          continue;
        }
        const choice = Array.from(card.querySelectorAll(".platform-quiz-choice-grid button, .platform-quiz-media-answer button"))
          .find((button) => visible(button) && !button.disabled);
        if (choice) {
          choice.click();
          await delay(80);
        }
      }
      const fallbackInput = quizCard.querySelector(".platform-inline-form input");
      if (fallbackInput && visible(fallbackInput) && !fallbackInput.disabled) {
        setValue(fallbackInput, "A complete QA short answer");
      }
      await delay(350);
      const submitButton = await waitFor(() =>
        Array.from(quizCard.querySelectorAll("button"))
          .find((button) => visible(button) && !button.disabled && normalize(button.textContent).includes("Submit attempt"))
      );
      if (!submitButton) throw new Error("Grammar Quiz 3 submit button was not enabled");
      submitButton.click();
      await delay(90);
      const state = await waitFor(() => {
        const next = readState();
        const attempt = next.quizAttempts?.find((item) => item.quizId === "quiz_ar_3" && !beforeAttemptIds.has(item.id));
        const newGrade = next.grades?.find((item) => item.itemId === "quiz_ar_3" && !beforeGradeIds.has(item.id));
        return attempt?.status === "pending" && !newGrade ? next : null;
      });
      const attempt = state?.quizAttempts?.find((item) => item.quizId === "quiz_ar_3" && !beforeAttemptIds.has(item.id));
      const newGrade = state?.grades?.find((item) => item.itemId === "quiz_ar_3" && !beforeGradeIds.has(item.id));
      const fallback = readState();
      return {
        ok: Boolean(state),
        beforeAttempts,
        afterAttempts: (state || fallback)?.quizAttempts?.filter((item) => item.quizId === "quiz_ar_3").length,
        beforeGrades: beforeGradeIds.size,
        afterGrades: (state || fallback)?.grades?.filter((item) => item.itemId === "quiz_ar_3").length,
        quizAttempts: (state || fallback)?.quizAttempts?.filter((item) => item.quizId === "quiz_ar_3").map((item) => ({ id: item.id, status: item.status, score: item.score })),
        quizGrades: (state || fallback)?.grades?.filter((item) => item.itemId === "quiz_ar_3").map((item) => ({ id: item.id, score: item.score })),
        submitButtons: Array.from(quizCard.querySelectorAll("button")).map((button) => ({ text: normalize(button.textContent), disabled: button.disabled })),
        quizCardText: normalize(quizCard.textContent).slice(0, 500),
        attemptQuizId: attempt?.quizId,
        attemptStatus: attempt?.status,
        gradeItemId: newGrade?.itemId,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attemptQuizId === "quiz_ar_3" &&
      value?.attemptStatus === "pending" &&
      !value?.gradeItemId,
  },
  {
    name: "student assignment detail route submits the selected assignment",
    role: "student",
    route: "/app/student/assignments/asg_qt_audio",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.assignmentSubmissions = (state.assignmentSubmissions || []).filter((item) => item.assignmentId !== "asg_qt_audio");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      const response = "QA audio route response " + Date.now();
      await waitFor(() => normalize(document.body.textContent).includes("Audio recitation"));
      const workspace = await waitFor(() => document.querySelector(".student-assignment-workspace"));
      if (!workspace) throw new Error("Student assignment workspace not found");
      setValue(workspace.querySelector('textarea[aria-label="Assignment response"]'), response);
      await delay(350);
      await clickButtonWithin(".student-assignment-workspace", "Submit assignment", true);
      const state = await waitFor(() => {
        const next = readState();
        return next.assignmentSubmissions?.[0]?.assignmentId === "asg_qt_audio" && next.assignmentSubmissions?.[0]?.response === response ? next : null;
      });
      return {
        ok: Boolean(state),
        assignmentId: state?.assignmentSubmissions?.[0]?.assignmentId,
        response: state?.assignmentSubmissions?.[0]?.response
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.assignmentId === "asg_qt_audio" &&
      value?.response?.startsWith("QA audio route response"),
  },
  {
    name: "student quiz detail route submits the selected quiz",
    role: "student",
    route: "/app/student/quizzes/quiz_qt_madd",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.quizAttempts = (state.quizAttempts || []).filter((item) => item.quizId !== "quiz_qt_madd");
      state.grades = (state.grades || []).filter((item) => item.itemId !== "quiz_qt_madd");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Madd Rules Check"));
      const before = readState();
      const workspace = await waitFor(() => document.querySelector(".student-quiz-workspace"));
      if (!workspace) throw new Error("Student quiz workspace not found");
      for (const card of Array.from(workspace.querySelectorAll(".student-quiz-question"))) {
        const textarea = card.querySelector("textarea");
        if (textarea && visible(textarea) && !textarea.disabled) {
          setValue(textarea, "A complete QA short answer");
          continue;
        }
        const choice = Array.from(card.querySelectorAll(".platform-quiz-choice-grid button"))
          .find((button) => visible(button) && !button.disabled);
        if (choice) {
          choice.click();
          await delay(80);
        }
      }
      const fallbackInput = workspace.querySelector(".platform-inline-form input");
      if (fallbackInput && visible(fallbackInput) && !fallbackInput.disabled) setValue(fallbackInput, "A complete QA short answer");
      await delay(350);
      await clickButtonWithin(".student-quiz-workspace", "Submit attempt", true);
      const state = await waitFor(() => {
        const next = readState();
        const attempt = next.quizAttempts?.find((item) => item.quizId === "quiz_qt_madd");
        const grade = next.grades?.find((item) => item.itemId === "quiz_qt_madd");
        return attempt?.status === "pending" && !grade ? next : null;
      });
      const attempt = state?.quizAttempts?.find((item) => item.quizId === "quiz_qt_madd");
      const grade = state?.grades?.find((item) => item.itemId === "quiz_qt_madd");
      return {
        ok: Boolean(state),
        quizId: attempt?.quizId,
        status: attempt?.status,
        gradeItemId: grade?.itemId,
        beforeAttempts: before.quizAttempts?.length,
        afterAttempts: state?.quizAttempts?.length
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.quizId === "quiz_qt_madd" &&
      value?.status === "pending" &&
      !value?.gradeItemId &&
      value?.afterAttempts >= value?.beforeAttempts,
  },
  {
    name: "student attendance and certificates do not expose staff mutations",
    role: "student",
    route: "/app/student/attendance",
    source: workflowActionSource(`
      const controlLabels = () => Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"))
        .filter(visible)
        .map((control) => normalize(control.textContent || control.getAttribute("aria-label") || control.getAttribute("value")));
      const attendanceText = (await waitFor(() => {
        const text = normalize(document.body.innerText || document.body.textContent);
        const lower = text.toLowerCase();
        return lower.includes("your attendance") && lower.includes("exceptions are linked") ? text : null;
      }, 5000)) || "";
      const before = readState();
      const attendanceButtons = controlLabels();
      const attendanceTextLower = attendanceText.toLowerCase();
      const forbiddenAttendanceControls = attendanceButtons.filter((label) => /^(save attendance|mark all present|mark all late|mark all absent|mark all excused|present|late|absent|excused)$/i.test(label));
      const afterAttendance = readState();
      await goto("/app/student/certificates");
      await waitFor(() => location.pathname === "/app/student/certificates" && normalize(document.body.innerText || document.body.textContent).includes("Certificate of learning"));
      const certificateButtons = controlLabels();
      const forbiddenCertificateControls = certificateButtons.filter((label) => /^(approve|approved|issue|issued)$/i.test(label));
      return {
        ok: true,
        attendanceReadOnlyRendered: attendanceTextLower.includes("your attendance") && attendanceTextLower.includes("exceptions are linked"),
        forbiddenAttendanceControls,
        attendanceCountUnchanged: (before.attendance?.length ?? 0) === (afterAttendance.attendance?.length ?? 0),
        auditCountUnchanged: (before.auditLogs?.length ?? 0) === (afterAttendance.auditLogs?.length ?? 0),
        forbiddenCertificateControls,
        certificateText: normalize(document.body.innerText || document.body.textContent)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attendanceReadOnlyRendered === true &&
      (value?.forbiddenAttendanceControls?.length ?? 0) === 0 &&
      value?.attendanceCountUnchanged === true &&
      value?.auditCountUnchanged === true &&
      (value?.forbiddenCertificateControls?.length ?? 0) === 0 &&
      value?.certificateText
        ?.toLowerCase()
        .includes("certificate of learning") &&
      value?.certificateText
        ?.toLowerCase()
        .includes("issued certificates only"),
  },
  {
    name: "student attendance exception workflow submits exact absent record",
    role: "student",
    route: "/app/student/attendance",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.attendanceExceptions = (state.attendanceExceptions || []).filter(
        (item) => item.attendanceRecordId !== "att_ar_online_absence"
      );
      const record = state.attendance?.find((item) => item.id === "att_ar_online_absence");
      if (!record) throw new Error("Student absence fixture is missing");
      record.status = "absent";
      writeState(state);
      return { ok: true };
    `),
    source: workflowActionSource(`
      const open = await waitFor(() => document.querySelector('[data-testid="student-attendance-request-att_ar_online_absence"]'));
      if (!open) throw new Error("Attendance exception control did not render");
      open.click();
      await waitFor(() => document.querySelector('[data-testid="student-attendance-exception-submit"]'));
      setByLabel("Exception reason", "Medical appointment prevented attendance during the class.");
      await clickButton("Submit request");
      const state = await waitFor(() => {
        const next = readState();
        return next.attendanceExceptions?.some(
          (item) => item.attendanceRecordId === "att_ar_online_absence" && item.status === "pending"
        ) ? next : null;
      });
      const request = state?.attendanceExceptions?.find(
        (item) => item.attendanceRecordId === "att_ar_online_absence"
      );
      return {
        requestStatus: request?.status,
        requestStudentId: request?.studentId,
        requestSessionId: request?.sessionId,
        auditAction: state?.auditLogs?.find((item) => item.entityId === request?.id)?.action,
        attendanceStatus: state?.attendance?.find((item) => item.id === "att_ar_online_absence")?.status
      };
    `),
    predicate: value =>
      value?.requestStatus === "pending" &&
      value?.requestStudentId === "stu_demo" &&
      value?.requestSessionId === "session_ar_online_absence" &&
      value?.auditAction === "attendance_exception.submitted" &&
      value?.attendanceStatus === "absent",
  },
  {
    name: "student quran page submits recitation without teacher review controls",
    role: "student",
    route: "/app/student/quran-progress",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.recitationSubmissions = (state.recitationSubmissions || []).filter((item) => item.title !== "QA recitation seed");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      const title = "QA recitation " + Date.now();
      const staffControlPattern = /^(update progress|review recitation|approve recitation|reject recitation|save review)$/i;
      const quranControlLabels = () => Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"))
        .filter(visible)
        .map((control) => normalize(control.textContent || control.getAttribute("aria-label") || control.getAttribute("value")));
      const beforeForbiddenControls = quranControlLabels().filter((label) => staffControlPattern.test(label));
      await clickButton("Submit recitation", true);
      const composer = await waitFor(() => document.querySelector('[data-testid="student-quran-submission"]'));
      if (!composer) throw new Error("Recitation submission form did not open");
      setByLabel("Title", title);
      const sendButton = Array.from(composer.querySelectorAll("button"))
        .find((button) => visible(button) && !button.disabled && normalize(button.textContent) === "Send recitation");
      if (!sendButton) throw new Error("Send recitation button not found");
      sendButton.click();
      const state = await waitFor(() => {
        const next = readState();
        return next.recitationSubmissions?.[0]?.title === title ? next : null;
      });
      const afterForbiddenControls = quranControlLabels().filter((label) => staffControlPattern.test(label));
      return {
        ok: Boolean(state),
        title: state?.recitationSubmissions?.[0]?.title,
        status: state?.recitationSubmissions?.[0]?.status,
        forbiddenQuranControls: Array.from(new Set([...beforeForbiddenControls, ...afterForbiddenControls])),
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.status === "pending" &&
      (value?.forbiddenQuranControls?.length ?? 0) === 0,
  },
  {
    name: "student messages are sent from student to permitted recipients",
    role: "student",
    route: "/app/student/messages",
    source: workflowActionSource(`
      await goto("/app/student/messages/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="portal-message-compose-student"]'));
      if (!composer) throw new Error("Message composer did not open");
      const recipient = composer.querySelector("select");
      const recipientOption = Array.from(recipient?.options || []).find((option) => option.value === "usr_teacher_demo");
      if (!recipient || !recipientOption) throw new Error("Permitted recipient not found");
      const options = Array.from(recipient.options).map((option) => option.value);
      setValue(recipient, recipientOption.value);
      const subject = "QA student message " + Date.now();
      setValue(composer.querySelector('input[placeholder]'), subject);
      setValue(composer.querySelector("textarea"), "Student scoped message body");
      await delay(120);
      await clickButton("Send message");
      const state = await waitFor(() => {
        const next = readState();
        return next.messages?.some((item) => item.subject === subject) ? next : null;
      });
      const message = state?.messages?.find((item) => item.subject === subject);
      const errorText = normalize(document.querySelector(".platform-attendance-error")?.textContent);
      return {
        ok: Boolean(state),
        fromUserId: message?.fromUserId,
        toUserId: message?.toUserId,
        hasSelfRecipient: options.includes("usr_student_demo"),
        errorText
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_student_demo" &&
      value?.toUserId !== "usr_student_demo" &&
      value?.hasSelfRecipient === false,
  },
  {
    name: "student inbox persists a received message read state",
    role: "student",
    route: "/app/student/messages",
    source: workflowActionSource(`
      const inbox = await waitFor(() => document.querySelector('[data-testid="portal-messages-inbox-student"]'));
      if (!inbox) throw new Error("Student inbox did not render");
      const thread = await waitFor(() =>
        Array.from(inbox.querySelectorAll("button"))
          .find((button) => normalize(button.textContent).includes("Class reminder"))
      );
      if (!thread) throw new Error("Seeded received message did not render");
      thread.click();
      const state = await waitFor(() => {
        const next = readState();
        return next.messages?.find((item) => item.id === "msg_demo_1")?.read === true
          ? next
          : null;
      }, 5000);
      const message = state?.messages?.find((item) => item.id === "msg_demo_1");
      const refreshedThread = Array.from(inbox.querySelectorAll("button"))
        .find((button) => normalize(button.textContent).includes("Class reminder"));
      return {
        ok: Boolean(state),
        messageRead: message?.read,
        threadStillUnread: refreshedThread?.classList.contains("unread") === true
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.messageRead === true &&
      value?.threadStillUnread === false,
  },
  {
    name: "student reports render personal rows without platform report selector",
    role: "student",
    route: "/app/student/reports",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Learning summary"));
      const text = normalize(document.body.innerText || document.body.textContent);
      return {
        ok: text.includes("Standard Arabic Level 3") && text.includes("Download report"),
        hasReportTypeSelector: Boolean(document.querySelector(".platform-report-controls select")),
        hasFinanceGlobal: text.includes("Finance report") || text.includes("Audit report")
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasReportTypeSelector === false &&
      value?.hasFinanceGlobal === false,
  },
  {
    name: "teacher attendance workflow saves edited status",
    role: "teacher",
    route: "/app/teacher/classes/class_ar_l3_a/attendance",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.attendance = (state.attendance || []).filter((item) => item.sessionId !== "session_ar_live" && item.sessionId !== "evt_ar_live");
      state.classSessions = (state.classSessions || []).map((item) =>
        item.id === "session_ar_live" ? { ...item, attendanceSaved: false } : item
      );
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      const workspace = await waitFor(() => document.querySelector('[data-testid="teacher-attendance-workspace"]'));
      if (!workspace) throw new Error("Teacher attendance workspace not found");
      const teacherSessionSelect = workspace.querySelector('[data-testid="teacher-attendance-session"]');
      if (!teacherSessionSelect) throw new Error("Teacher attendance session selector not found");
      setValue(teacherSessionSelect, "session_ar_live");
      const lateButton = await waitFor(() =>
        workspace.querySelector('[data-testid="teacher-attendance-status-stu_demo-late"]')
      );
      if (!lateButton) throw new Error("Late attendance status button not found");
      const attendanceRow = lateButton.closest(".teacher-attendance-row");
      if (!attendanceRow) throw new Error("Student Demo attendance row not found");
      lateButton.click();
      const note = "QA attendance note " + Date.now();
      const noteInput = attendanceRow.querySelector('input[aria-label="Student Demo attendance note"]');
      if (!noteInput || noteInput.disabled) throw new Error("Attendance note input not found");
      setValue(noteInput, note);
      await delay(90);
      await waitFor(() => lateButton.getAttribute("aria-pressed") === "true");
      const saveButton = workspace.querySelector('[data-testid="teacher-attendance-save"]');
      if (!saveButton || saveButton.disabled) throw new Error("Save attendance button not found");
      saveButton.click();
      const state = await waitFor(() => {
        const next = readState();
        const saved = next.classSessions?.find((item) => item.id === "session_ar_live")?.attendanceSaved;
        const record = next.attendance?.find((item) => item.classGroupId === "class_ar_l3_a" && item.sessionId === "session_ar_live" && item.studentId === "stu_demo");
        const audit = next.auditLogs?.find((item) => item.action === "attendance.saved" && item.entityType === "AttendanceRecord" && item.entityId === "class_ar_l3_a" && item.actorId === "usr_teacher_demo");
        return saved && record?.status === "late" && record?.notes === note && audit ? next : null;
      });
      const fallback = readState();
      const audit = (state || fallback)?.auditLogs?.find((item) => item.action === "attendance.saved" && item.entityType === "AttendanceRecord" && item.entityId === "class_ar_l3_a" && item.actorId === "usr_teacher_demo");
      return {
        ok: Boolean(state),
        attendanceSaved: (state || fallback)?.classSessions?.find((item) => item.id === "session_ar_live")?.attendanceSaved,
        status: (state || fallback)?.attendance?.find((item) => item.sessionId === "session_ar_live" && item.studentId === "stu_demo")?.status,
        note: (state || fallback)?.attendance?.find((item) => item.sessionId === "session_ar_live" && item.studentId === "stu_demo")?.notes,
        records: (state || fallback)?.attendance?.map((item) => ({ sessionId: item.sessionId, status: item.status })).slice(0, 4),
        lastAudit: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attendanceSaved === true &&
      value?.status === "late" &&
      value?.note?.startsWith("QA attendance note") &&
      value?.lastAudit === "attendance.saved" &&
      value?.auditActorId === "usr_teacher_demo",
  },
  {
    name: "teacher materials workflow publishes assigned lesson resource",
    role: "teacher",
    route: "/app/teacher/classes/class_ar_l3_a/materials",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.resources = (state.resources || []).map((item) =>
        item.id === "res_ar_pdf" ? { ...item, published: false } : item
      );
      state.auditLogs = (state.auditLogs || []).filter((item) => item.entityId !== "res_ar_pdf");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Grammar handout"));
      const row = Array.from(document.querySelectorAll(".teacher-material-list article"))
        .find((article) => normalize(article.textContent).includes("Grammar handout"));
      const publishButton = row?.querySelector("button");
      if (!publishButton || !visible(publishButton) || publishButton.disabled) throw new Error("Material publish button not found");
      const beforeLabel = normalize(publishButton.textContent).toLowerCase();
      const expectedPublished = beforeLabel === "published" ? false : true;
      const expectedAction = expectedPublished ? "material.published" : "material.unpublished";
      publishButton.click();
      const state = await waitFor(() => {
        const next = readState();
        const resource = next.resources?.find((item) => item.id === "res_ar_pdf");
        const audit = next.auditLogs?.find((item) => item.entityId === "res_ar_pdf" && item.action === expectedAction);
        return resource?.published === expectedPublished && audit ? next : null;
      }, 5000);
      const resource = state?.resources?.find((item) => item.id === "res_ar_pdf");
      const audit = state?.auditLogs?.find((item) => item.entityId === "res_ar_pdf" && item.action === expectedAction);
      return {
        ok: Boolean(state),
        beforeLabel,
        expectedPublished,
        published: resource?.published,
        lastAudit: audit?.action,
        actorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.published === value?.expectedPublished &&
      (value?.lastAudit === "material.published" ||
        value?.lastAudit === "material.unpublished") &&
      value?.actorId === "usr_teacher_demo",
  },
  {
    name: "teacher class reminder workflow sends scoped student message",
    role: "teacher",
    route: "/app/teacher/classes/class_ar_l3_a",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.messages = (state.messages || []).filter((item) => !item.subject?.includes("Arabic L3 - Group A reminder"));
      state.communicationLogs = (state.communicationLogs || []).filter((item) => !item.subject?.includes("Arabic L3 - Group A reminder"));
      state.notifications = (state.notifications || []).filter((item) => !item.title?.includes("Arabic L3 - Group A reminder"));
      state.auditLogs = (state.auditLogs || []).filter((item) => !item.summary?.includes("Arabic L3 - Group A reminder"));
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Arabic L3 - Group A"));
      await clickButton("Send reminder");
      const state = await waitFor(() => {
        const next = readState();
        const message = next.messages?.find((item) => item.subject === "Arabic L3 - Group A reminder");
        const log = next.communicationLogs?.find((item) => item.subject === "Arabic L3 - Group A reminder");
        const audit = message ? next.auditLogs?.find((item) => item.entityId === message.id && item.action === "message.sent") : null;
        return message && log && audit ? next : null;
      }, 5000);
      const message = state?.messages?.find((item) => item.subject === "Arabic L3 - Group A reminder");
      const log = state?.communicationLogs?.find((item) => item.subject === "Arabic L3 - Group A reminder");
      const audit = message ? state?.auditLogs?.find((item) => item.entityId === message.id && item.action === "message.sent") : null;
      return {
        ok: Boolean(state),
        fromUserId: message?.fromUserId,
        toUserId: message?.toUserId,
        logSubject: log?.subject,
        lastAudit: audit?.action,
        actorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_teacher_demo" &&
      value?.toUserId === "usr_student_demo" &&
      value?.logSubject === "Arabic L3 - Group A reminder" &&
      value?.lastAudit === "message.sent" &&
      value?.actorId === "usr_teacher_demo",
  },
  {
    name: "teacher assignment workflow drafts, edits, and publishes assigned work",
    role: "teacher",
    route: "/app/teacher/assignments/new",
    source: workflowActionSource(`
      const createForm = await waitFor(() => document.querySelector('[data-testid="teacher-assignment-create-form"]'));
      if (!createForm) throw new Error("Assignment draft form did not render");
      const draftTitle = "QA assignment draft " + Date.now();
      setByLabel("Class", "run_ar_l3_2026");
      setByLabel("Title", draftTitle);
      setByLabel("Due date", "2026-07-25");
      setByLabel("Submission", "text");
      setByLabel("Rubric", "Accuracy, Clarity");
      await clickButtonWithin('[data-testid="teacher-assignment-create-form"]', "Save draft", true);
      const draftState = await waitFor(() => {
        const next = readState();
        const assignment = next.assignments?.find((item) => item.title === draftTitle);
        const audit = assignment
          ? next.auditLogs?.find((item) => item.action === "assignment.created" && item.entityId === assignment.id)
          : null;
        return assignment?.status === "draft" && audit ? next : null;
      }, 5000);
      const draft = draftState?.assignments?.find((item) => item.title === draftTitle);
      if (!draft) throw new Error("Assignment draft was not persisted");

      await goto("/app/teacher/assignments/" + draft.id);
      const draftControls = await waitFor(() => document.querySelector('[data-testid="teacher-assignment-draft-controls"]'));
      if (!draftControls) throw new Error("Assignment draft controls did not render");
      const publishedTitle = draftTitle + " published";
      setByLabel("Title", publishedTitle);
      setByLabel("Due date", "2026-07-26");
      setByLabel("Submission type", "file");
      setByLabel("Rubric", "Evidence, Structure");
      await clickButtonWithin('[data-testid="teacher-assignment-draft-controls"]', "Save draft", true);
      const updatedState = await waitFor(() => {
        const next = readState();
        const assignment = next.assignments?.find((item) => item.id === draft.id);
        const audit = next.auditLogs?.find((item) => item.action === "assignment.updated" && item.entityId === draft.id);
        return assignment?.title === publishedTitle && assignment?.submissionType === "file" && audit ? next : null;
      }, 5000);
      if (!updatedState) throw new Error("Assignment draft update was not persisted");

      const publishButton = await waitFor(() => {
        const button = document.querySelector('[data-testid="teacher-assignment-publish"]');
        return button && !button.disabled ? button : null;
      }, 5000);
      if (!publishButton) throw new Error("Publish assignment button did not become available");
      publishButton.click();
      const publishedState = await waitFor(() => {
        const next = readState();
        const assignment = next.assignments?.find((item) => item.id === draft.id);
        const audit = next.auditLogs?.find((item) => item.action === "assignment.published" && item.entityId === draft.id);
        return assignment?.status === "active" && audit ? next : null;
      }, 5000);
      const assignment = publishedState?.assignments?.find((item) => item.id === draft.id);
      const createdAudit = publishedState?.auditLogs?.find((item) => item.action === "assignment.created" && item.entityId === draft.id);
      const updatedAudit = publishedState?.auditLogs?.find((item) => item.action === "assignment.updated" && item.entityId === draft.id);
      const publishedAudit = publishedState?.auditLogs?.find((item) => item.action === "assignment.published" && item.entityId === draft.id);
      const publishedControls = await waitFor(() => document.querySelector('[data-testid="teacher-assignment-published-controls"]'));
      return {
        ok: Boolean(publishedState && publishedControls),
        status: assignment?.status,
        title: assignment?.title,
        submissionType: assignment?.submissionType,
        rubric: assignment?.rubric,
        createdActorId: createdAudit?.actorId,
        updatedActorId: updatedAudit?.actorId,
        publishedActorId: publishedAudit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.status === "active" &&
      value?.title?.startsWith("QA assignment draft") &&
      value?.submissionType === "file" &&
      value?.rubric?.includes("Evidence") &&
      value?.createdActorId === "usr_teacher_demo" &&
      value?.updatedActorId === "usr_teacher_demo" &&
      value?.publishedActorId === "usr_teacher_demo",
  },
  {
    name: "teacher quiz workflow drafts, assembles, and publishes assigned quiz",
    role: "teacher",
    route: "/app/teacher/quizzes/new",
    source: workflowActionSource(`
      const createForm = await waitFor(() => document.querySelector('[data-testid="teacher-quiz-create-form"]'));
      if (!createForm) throw new Error("Quiz draft form did not render");
      const draftTitle = "QA quiz draft " + Date.now();
      setByLabel("Class", "run_ar_l3_2026");
      setByLabel("Quiz title", draftTitle);
      setByLabel("Due date", "2026-07-29");
      setByLabel("Minutes", "25");
      setByLabel("Attempts", "2");
      setByLabel("Question types", "multiple_choice");
      await clickButtonWithin('[data-testid="teacher-quiz-create-form"]', "Save quiz draft", true);
      const draftState = await waitFor(() => {
        const next = readState();
        const quiz = next.quizzes?.find((item) => item.title === draftTitle);
        const audit = quiz
          ? next.auditLogs?.find((item) => item.action === "quiz.created" && item.entityId === quiz.id)
          : null;
        return quiz?.status === "draft" && audit ? next : null;
      }, 5000);
      const draft = draftState?.quizzes?.find((item) => item.title === draftTitle);
      if (!draft) throw new Error("Quiz draft was not persisted");

      await goto("/app/teacher/quizzes/" + draft.id);
      const draftControls = await waitFor(() => document.querySelector('[data-testid="teacher-quiz-draft-controls"]'));
      if (!draftControls) throw new Error("Quiz draft controls did not render");
      const publishedTitle = draftTitle + " published";
      setByLabel("Quiz title", publishedTitle);
      setByLabel("Due date", "2026-07-30");
      setByLabel("Minutes", "30");
      setByLabel("Attempts per learner", "3");
      await clickButtonWithin('[data-testid="teacher-quiz-draft-controls"]', "Save draft", true);
      const updatedState = await waitFor(() => {
        const next = readState();
        const quiz = next.quizzes?.find((item) => item.id === draft.id);
        const audit = next.auditLogs?.find((item) => item.action === "quiz.updated" && item.entityId === draft.id);
        return quiz?.title === publishedTitle && quiz?.durationMinutes === 30 && quiz?.attemptsAllowed === 3 && audit ? next : null;
      }, 5000);
      if (!updatedState) throw new Error("Quiz draft update was not persisted");

      const questionEditor = await waitFor(() => document.querySelector('[data-testid="teacher-quiz-question-editor"]'));
      if (!questionEditor) throw new Error("Quiz question editor did not render");
      const question = questionEditor.querySelector('input[data-question-id="qbi_ar_conditional_mcq"]');
      if (!question) throw new Error("Assigned-run question was not available");
      if (!question.checked) question.click();
      await waitFor(() => {
        const button = questionEditor.querySelector('[data-testid="teacher-quiz-save-questions"]');
        return button && !button.disabled ? button : null;
      }, 3000);
      await clickButtonWithin('[data-testid="teacher-quiz-question-editor"]', "Save questions", true);
      const assembledState = await waitFor(() => {
        const next = readState();
        const quiz = next.quizzes?.find((item) => item.id === draft.id);
        const audit = next.auditLogs?.find((item) => item.action === "quiz.questions.updated" && item.entityId === draft.id);
        return quiz?.questionIds?.includes("qbi_ar_conditional_mcq") && audit ? next : null;
      }, 5000);
      if (!assembledState) throw new Error("Quiz question selection was not persisted");

      const publishButton = await waitFor(() => {
        const button = document.querySelector('[data-testid="teacher-quiz-publish"]');
        return button && !button.disabled ? button : null;
      }, 5000);
      if (!publishButton) throw new Error("Publish quiz button did not become available");
      publishButton.click();
      const publishedState = await waitFor(() => {
        const next = readState();
        const quiz = next.quizzes?.find((item) => item.id === draft.id);
        const audit = next.auditLogs?.find((item) => item.action === "quiz.published" && item.entityId === draft.id);
        return quiz?.status === "active" && audit ? next : null;
      }, 5000);
      const quiz = publishedState?.quizzes?.find((item) => item.id === draft.id);
      const createdAudit = publishedState?.auditLogs?.find((item) => item.action === "quiz.created" && item.entityId === draft.id);
      const updatedAudit = publishedState?.auditLogs?.find((item) => item.action === "quiz.updated" && item.entityId === draft.id);
      const questionsAudit = publishedState?.auditLogs?.find((item) => item.action === "quiz.questions.updated" && item.entityId === draft.id);
      const publishedAudit = publishedState?.auditLogs?.find((item) => item.action === "quiz.published" && item.entityId === draft.id);
      const publishedControls = await waitFor(() => document.querySelector('[data-testid="teacher-quiz-published-controls"]'));
      const studentLogin = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Nile-Learn-Request": "browser" },
        body: JSON.stringify({
          email: "s@nl.test",
          password: ${JSON.stringify(password)},
          role: "student"
        })
      });
      const studentStateResponse = studentLogin.ok
        ? await fetch("/api/platform/state", { credentials: "include" })
        : null;
      const studentStatePayload = studentStateResponse?.ok
        ? await studentStateResponse.json()
        : null;
      const notification = studentStatePayload?.state?.notifications?.find(
        (item) =>
          item.userId === "usr_student_demo" &&
          item.href === "/app/student/quizzes/" + draft.id
      );
      return {
        ok: Boolean(publishedState && publishedControls && notification),
        status: quiz?.status,
        title: quiz?.title,
        durationMinutes: quiz?.durationMinutes,
        attemptsAllowed: quiz?.attemptsAllowed,
        questionIds: quiz?.questionIds,
        createdActorId: createdAudit?.actorId,
        updatedActorId: updatedAudit?.actorId,
        questionsActorId: questionsAudit?.actorId,
        publishedActorId: publishedAudit?.actorId,
        notificationUserId: notification?.userId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.status === "active" &&
      value?.title?.startsWith("QA quiz draft") &&
      value?.durationMinutes === 30 &&
      value?.attemptsAllowed === 3 &&
      value?.questionIds?.includes("qbi_ar_conditional_mcq") &&
      value?.createdActorId === "usr_teacher_demo" &&
      value?.updatedActorId === "usr_teacher_demo" &&
      value?.questionsActorId === "usr_teacher_demo" &&
      value?.publishedActorId === "usr_teacher_demo" &&
      value?.notificationUserId === "usr_student_demo",
  },
  {
    name: "teacher grading workflow scores pending assignment submission",
    role: "teacher",
    route: "/app/teacher/grading",
    setupSource: workflowSetupSource(`
      const state = readState();
      const submission = state.assignmentSubmissions?.find((item) => item.id === "sub_ar_grammar_draft");
      state.assignmentSubmissions = submission
        ? [
            { ...submission, status: "pending", score: undefined, feedback: undefined },
            ...(state.assignmentSubmissions || []).filter((item) => item.id !== "sub_ar_grammar_draft"),
          ]
        : (state.assignmentSubmissions || []);
      state.grades = (state.grades || []).filter((item) => item.itemId !== "asg_ar_grammar");
      writeState(state);
      return { ok: Boolean(submission), submissionId: submission?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/teacher/grading/sub_ar_grammar_draft");
      const editor = await waitFor(() => document.querySelector('[data-testid="teacher-grade-editor"]'));
      if (!editor) throw new Error("Teacher grade editor not found");
      const feedback = "QA grading feedback " + Date.now();
      setValue(editor.querySelector('input[type="number"]'), "91");
      setValue(editor.querySelector('input[placeholder]'), feedback);
      const gradeButton = Array.from(editor.querySelectorAll("button"))
        .find((button) => visible(button) && !button.disabled && normalize(button.textContent) === "Save result");
      if (!gradeButton) throw new Error("Save result button not found");
      gradeButton.click();
      await delay(140);
      const state = await waitFor(() => {
        const next = readState();
        const submission = next.assignmentSubmissions?.find((item) => item.id === "sub_ar_grammar_draft");
        const grade = next.grades?.find((item) => item.itemId === "asg_ar_grammar" && item.feedback === feedback);
        return submission?.status === "completed" && submission?.score === 91 && grade ? next : null;
      });
      const fallback = readState();
      const submission = (state || fallback)?.assignmentSubmissions?.find((item) => item.id === "sub_ar_grammar_draft");
      const grade = (state || fallback)?.grades?.find((item) => item.itemId === "asg_ar_grammar" && item.feedback === feedback);
      return {
        ok: Boolean(state),
        submissionStatus: submission?.status,
        submissionScore: submission?.score,
        gradeScore: grade?.score,
        gradeFeedback: grade?.feedback
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.submissionStatus === "completed" &&
      value?.submissionScore === 91 &&
      value?.gradeScore === 91 &&
      value?.gradeFeedback?.startsWith("QA grading feedback"),
  },
  {
    name: "student gradebook shows returned assignment feedback",
    role: "student",
    route: "/app/student/grades",
    setupSource: workflowSetupSource(`
      const state = readState();
      const submission = state.assignmentSubmissions?.find((item) => item.id === "sub_ar_grammar_draft");
      const feedback = "QA visible learner feedback " + Date.now();
      state.assignmentSubmissions = submission
        ? [
            {
              ...submission,
              status: "completed",
              score: 92,
              feedback,
              submittedAt: new Date().toISOString(),
            },
            ...(state.assignmentSubmissions || []).filter((item) => item.id !== "sub_ar_grammar_draft"),
          ]
        : (state.assignmentSubmissions || []);
      state.grades = [
        {
          id: "qa_grade_visible_assignment",
          studentId: "stu_demo",
          courseRunId: "run_ar_l3_2026",
          itemId: "asg_ar_grammar",
          itemTitle: "Grammar worksheet",
          score: 92,
          maxScore: 100,
          feedback,
        },
        ...(state.grades || []).filter((item) => item.id !== "qa_grade_visible_assignment" && item.itemId !== "asg_ar_grammar"),
      ];
      writeState(state);
      return { ok: true, feedback };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      const text = await waitFor(() => {
        const body = normalize(document.body.innerText || document.body.textContent);
        return body.includes("Reviewed work") && body.includes("QA visible learner feedback") && body.includes("92/100") ? body : null;
      });
      return {
        ok: Boolean(text),
        hasFeedbackList: text?.toLowerCase().includes("latest feedback"),
        hasScore: text?.includes("92/100"),
        hasGradebook: text?.includes("Reviewed work")
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasFeedbackList &&
      value?.hasScore &&
      value?.hasGradebook,
  },
  {
    name: "teacher quiz review workflow updates attempt and grade feedback",
    role: "teacher",
    route: "/app/teacher/quizzes/review",
    setupSource: workflowSetupSource(`
      const state = readState();
      const attempt = state.quizAttempts?.find((item) => item.id === "attempt_ar_teacher_review");
      state.quizAttempts = attempt
        ? [
            { ...attempt, status: "pending", score: 0 },
            ...(state.quizAttempts || []).filter((item) => item.id !== "attempt_ar_teacher_review"),
          ]
        : (state.quizAttempts || []);
      state.grades = (state.grades || []).filter((item) => item.itemId !== "quiz_ar_teacher_review");
      state.auditLogs = (state.auditLogs || []).filter((item) => item.entityId !== "attempt_ar_teacher_review");
      writeState(state);
      return { ok: Boolean(attempt), attemptId: attempt?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/teacher/quizzes/review/attempt_ar_teacher_review");
      const reviewPanel = await waitFor(() => document.querySelector(".teacher-quiz-review-form"));
      if (!reviewPanel) throw new Error("Quiz review form not found");
      const feedback = "QA quiz review " + Date.now();
      setValue(reviewPanel.querySelector('input[type="number"]'), "93");
      setValue(reviewPanel.querySelector("textarea"), feedback);
      const reviewButton = Array.from(reviewPanel.querySelectorAll("button"))
        .find((button) => visible(button) && !button.disabled && normalize(button.textContent) === "Save review");
      if (!reviewButton) throw new Error("Save review button not found");
      reviewButton.click();
      await delay(140);
      const state = await waitFor(() => {
        const next = readState();
        const attempt = next.quizAttempts?.find((item) => item.id === "attempt_ar_teacher_review" && item.score === 93);
        const grade = next.grades?.find((item) => item.itemId === "quiz_ar_teacher_review" && item.feedback === feedback);
        const audit = next.auditLogs?.find((item) => item.action === "quiz.reviewed" && item.entityId === "attempt_ar_teacher_review" && item.actorId === "usr_teacher_demo");
        return attempt?.status === "completed" && grade && audit ? next : null;
      });
      const fallback = readState();
      const attempt = (state || fallback)?.quizAttempts?.find((item) => item.id === "attempt_ar_teacher_review" && item.score === 93);
      const grade = (state || fallback)?.grades?.find((item) => item.itemId === "quiz_ar_teacher_review" && item.feedback === feedback);
      const audit = (state || fallback)?.auditLogs?.find((item) => item.action === "quiz.reviewed" && item.entityId === "attempt_ar_teacher_review" && item.actorId === "usr_teacher_demo");
      return {
        ok: Boolean(state),
        attemptStatus: attempt?.status,
        attemptScore: attempt?.score,
        gradeScore: grade?.score,
        gradeFeedback: grade?.feedback,
        auditAction: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attemptStatus === "completed" &&
      value?.attemptScore === 93 &&
      value?.gradeScore === 93 &&
      value?.gradeFeedback?.startsWith("QA quiz review") &&
      value?.auditAction === "quiz.reviewed" &&
      value?.auditActorId === "usr_teacher_demo",
  },
  {
    name: "branch dashboard renders scoped operations command center",
    role: "branchadmin",
    route: "/app/branch/dashboard",
    source: workflowActionSource(`
      await waitFor(() => {
        const visibleText = normalize(document.body.innerText || document.body.textContent).toLowerCase();
        return visibleText.includes("branch overview") && visibleText.includes("today’s operations");
      });
      const text = normalize(document.body.innerText || document.body.textContent);
      const normalizedText = text.toLowerCase();
      const requiredLabels = [
        "today at your branch",
        "today’s operations",
        "room usage",
        "attendance exceptions",
        "branch payments",
        "schedule reviews",
      ];
      const missingLabels = requiredLabels.filter((label) => !normalizedText.includes(label));
      return {
        ok: missingLabels.length === 0,
        missingLabels,
        hasBranchScope: text.includes("Cairo B1"),
        hasOperationalLinks: text.includes("Manage rooms") && text.includes("Open schedule") && text.includes("Payment overview"),
        hasGlobalAdminLeak: text.includes("Platform settings") || text.includes("Global governance") || text.includes("Super Admin")
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasBranchScope === true &&
      value?.hasOperationalLinks === true &&
      value?.hasGlobalAdminLeak === false,
  },
  {
    name: "branch attendance workflow saves branch-scoped status",
    role: "branchadmin",
    route: "/app/branch/attendance",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.attendance = (state.attendance || []).filter((item) => item.sessionId !== "session_ar_cairo_live" && item.sessionId !== "evt_ar_cairo_live");
      state.classSessions = (state.classSessions || []).map((item) =>
        item.id === "session_ar_cairo_live" ? { ...item, attendanceSaved: false } : item
      );
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      const toolbar = await waitFor(() => document.querySelector('[data-testid="branch-attendance-toolbar"]'));
      const workspace = await waitFor(() => document.querySelector('[data-testid="branch-attendance-workspace"]'));
      if (!toolbar || !workspace) throw new Error("Branch attendance workspace not found");
      const selects = toolbar.querySelectorAll("select");
      setValue(selects[0], "class_ar_l3_cairo");
      await waitFor(() => Array.from(selects[1]?.options || []).some((option) => option.value === "session_ar_cairo_live"));
      setValue(selects[1], "session_ar_cairo_live");
      const learnerRow = await waitFor(() => Array.from(workspace.querySelectorAll(".branch-attendance-list article")).find((row) => normalize(row.textContent).includes("Cairo Student Demo")));
      if (!learnerRow) throw new Error("Cairo student attendance row not found");
      const absentButton = Array.from(learnerRow.querySelectorAll("button"))
        .find((button) => visible(button) && !button.disabled && normalize(button.getAttribute("aria-label")).toLowerCase() === "absent");
      if (!absentButton) throw new Error("Absent attendance status button not found");
      absentButton.click();
      await delay(90);
      await waitFor(() => absentButton.getAttribute("aria-pressed") === "true");
      const saveButton = workspace.querySelector('[data-testid="branch-attendance-save"]');
      if (!saveButton || saveButton.disabled) throw new Error("Save branch attendance button not found");
      saveButton.click();
      const state = await waitFor(() => {
        const next = readState();
        const saved = next.classSessions?.find((item) => item.id === "session_ar_cairo_live")?.attendanceSaved;
        const record = next.attendance?.find((item) => item.sessionId === "session_ar_cairo_live" && item.studentId === "stu_cairo_demo");
        return saved && record?.status === "absent" ? next : null;
      });
      const fallback = readState();
      return {
        ok: Boolean(state),
        attendanceSaved: (state || fallback)?.classSessions?.find((item) => item.id === "session_ar_cairo_live")?.attendanceSaved,
        status: (state || fallback)?.attendance?.find((item) => item.sessionId === "session_ar_cairo_live" && item.studentId === "stu_cairo_demo")?.status,
        lastAudit: (state || fallback)?.auditLogs?.[0]?.action,
        auditActorId: (state || fallback)?.auditLogs?.[0]?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attendanceSaved === true &&
      value?.status === "absent",
  },
  {
    name: "branch attendance exception workflow approves scoped request",
    role: "branchadmin",
    route: "/app/branch/attendance",
    source: workflowActionSource(`
      const queue = await waitFor(() => document.querySelector('[data-testid="branch-attendance-exception-list"]'));
      if (!queue || !normalize(queue.textContent).includes("Family emergency")) {
        throw new Error("Branch exception queue did not render the scoped request");
      }
      setByLabel("Review note for Cairo Student Demo", "Family emergency evidence verified.");
      const approve = document.querySelector('[data-testid="branch-attendance-exception-approve-aex_cairo_pending"]');
      if (!approve) throw new Error("Branch exception approve control did not render");
      approve.click();
      const state = await waitFor(() => {
        const next = readState();
        return next.attendanceExceptions?.find((item) => item.id === "aex_cairo_pending")?.status === "approved"
          ? next
          : null;
      });
      const request = state?.attendanceExceptions?.find((item) => item.id === "aex_cairo_pending");
      const attendance = state?.attendance?.find((item) => item.id === "att_ar_cairo_exception");
      const enrollment = state?.enrollments?.find((item) => item.id === "enr_ar_l3_cairo");
      return {
        requestStatus: request?.status,
        reviewedBy: request?.reviewedBy,
        attendanceStatus: attendance?.status,
        attendanceRate: enrollment?.attendanceRate,
        auditAction: state?.auditLogs?.find((item) => item.entityId === request?.id)?.action
      };
    `),
    predicate: value =>
      value?.requestStatus === "approved" &&
      value?.reviewedBy === "usr_branch_demo" &&
      value?.attendanceStatus === "excused" &&
      value?.attendanceRate === 100 &&
      value?.auditAction === "attendance_exception.approved",
  },
  {
    name: "branch scheduling workflow creates calendar event",
    role: "branchadmin",
    route: "/app/branch/schedule",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.rooms = state.rooms || [];
      if (!state.rooms.some((item) => item.id === "room_cairo_4")) {
        state.rooms.push({
          id: "room_cairo_4",
          branchId: "br_cairo",
          name: "Cairo Room 4",
          capacity: 20,
          equipment: ["Projector", "Whiteboard"],
          status: "active"
        });
      }
      state.courseRuns = state.courseRuns || [];
      if (!state.courseRuns.some((item) => item.id === "run_ar_l3_cairo_2026")) {
        state.courseRuns.push({
          id: "run_ar_l3_cairo_2026",
          courseId: "course_ar_l3",
          branchId: "br_cairo",
          teacherId: "usr_teacher_demo",
          term: "QA Cairo",
          startsOn: "2026-07-01",
          endsOn: "2026-08-31",
          status: "active"
        });
      }
      state.classGroups = state.classGroups || [];
      if (!state.classGroups.some((item) => item.id === "class_ar_l3_cairo")) {
        state.classGroups.push({
          id: "class_ar_l3_cairo",
          courseRunId: "run_ar_l3_cairo_2026",
          name: "Arabic L3 - Cairo Group",
          capacity: 20,
          schedule: "Sun/Tue 14:00",
          roomId: "room_cairo_4",
          meetingLinkId: "meet_ar_l3",
          studentIds: []
        });
      }
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/branch/schedule/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="branch-schedule-composer"]'));
      if (!composer) throw new Error("Branch schedule composer did not open");
      await waitFor(() => normalize(composer.textContent).includes("Arabic L3 - Cairo Group"), 4000);
      const title = "QA review session " + Date.now();
      setByLabel("Title", title);
      setByLabel("Date", "2026-07-03");
      setByLabel("Starts", "14:00");
      setByLabel("Ends", "14:45");
      await clickButton("Create event");
      const state = await waitFor(() => {
        const next = readState();
        return next.events?.some((item) => item.title === title) ? next : null;
      });
      const event = state?.events?.find((item) => item.title === title);
      const session = state?.classSessions?.find((item) => item.eventId === event?.id || item.title === title);
      const classGroup = state?.classGroups?.find((item) => item.id === (session?.classGroupId ?? event?.classGroupId));
      const courseRun = state?.courseRuns?.find((item) => item.id === classGroup?.courseRunId);
      const actor = state?.users?.find((item) => item.id === "usr_branch_demo");
      const branchInvariantSupported = Boolean(event && session && classGroup && courseRun && actor?.branchId);
      const branchInvariantOk = !branchInvariantSupported || (event.branchId === actor.branchId && courseRun.branchId === actor.branchId);
      return {
        ok: Boolean(state),
        title: event?.title,
        status: event?.status,
        eventBranchId: event?.branchId,
        actorBranchId: actor?.branchId,
        classGroupId: classGroup?.id,
        classRunBranchId: courseRun?.branchId,
        branchInvariantSupported,
        branchInvariantOk,
        sessionCreated: session?.title === title,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.title?.startsWith("QA review session") &&
      value?.sessionCreated === true &&
      value?.branchInvariantOk === true,
  },
  {
    name: "branch class-session workflow reschedules and cancels with audit evidence",
    role: "branchadmin",
    route: "/app/branch/schedule/sessions/session_ar_cairo_upcoming",
    setupSource: workflowSetupSource(`
      const state = readState();
      const session = state.classSessions?.find((item) => item.id === "session_ar_cairo_upcoming");
      const event = state.events?.find((item) => item.id === "evt_ar_cairo_upcoming");
      if (!session || !event) throw new Error("QA class-session fixture is missing");
      Object.assign(session, {
        startsAt: "2026-07-05T14:00:00+03:00",
        endsAt: "2026-07-05T15:00:00+03:00",
        status: "active",
        attendanceSaved: false
      });
      Object.assign(event, {
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        roomId: "room_cairo_4",
        status: "active"
      });
      state.attendance = (state.attendance || []).filter(
        (item) => item.sessionId !== session.id && item.sessionId !== session.eventId
      );
      writeState(state);
      return { ok: true };
    `),
    source: workflowActionSource(`
      await waitFor(() => document.querySelector('[data-testid="branch-session-workflow"]'));
      setByLabel("Date", "2026-07-05");
      setByLabel("Starts", "15:00");
      setByLabel("Ends", "16:00");
      setByLabel("Reason", "QA branch timetable adjustment");
      await clickButton("Reschedule");
      const rescheduled = await waitFor(() => {
        const next = readState();
        const item = next.classSessions?.find((entry) => entry.id === "session_ar_cairo_upcoming");
        return item?.startsAt === "2026-07-05T15:00:00+03:00" ? next : null;
      });
      setByLabel("Reason", "QA branch closure cancellation");
      await clickButton("Cancel session");
      const cancelled = await waitFor(() => {
        const next = readState();
        const item = next.classSessions?.find((entry) => entry.id === "session_ar_cairo_upcoming");
        return item?.status === "cancelled" ? next : null;
      });
      const session = cancelled?.classSessions?.find((item) => item.id === "session_ar_cairo_upcoming");
      const event = cancelled?.events?.find((item) => item.id === session?.eventId);
      const auditActions = cancelled?.auditLogs
        ?.filter((item) => item.entityId === session?.id)
        .map((item) => item.action) || [];
      return {
        rescheduled: Boolean(rescheduled),
        sessionStatus: session?.status,
        eventStatus: event?.status,
        pairedTimes: session?.startsAt === event?.startsAt && session?.endsAt === event?.endsAt,
        auditActions
      };
    `),
    predicate: value =>
      value?.rescheduled === true &&
      value?.sessionStatus === "cancelled" &&
      value?.eventStatus === "cancelled" &&
      value?.pairedTimes === true &&
      value?.auditActions?.includes("class_session.rescheduled") &&
      value?.auditActions?.includes("class_session.cancelled"),
  },
  {
    name: "branch room status workflow updates branch-scoped room",
    role: "branchadmin",
    route: "/app/branch/rooms",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.rooms = state.rooms || [];
      if (!state.rooms.some((item) => item.id === "room_cairo_4")) {
        state.rooms.push({
          id: "room_cairo_4",
          branchId: "br_cairo",
          name: "Cairo Room 4",
          capacity: 20,
          equipment: ["Projector", "Whiteboard"],
          status: "active"
        });
      }
      state.rooms = state.rooms.map((item) => item.id === "room_cairo_4" ? { ...item, status: "active" } : item);
      state.auditLogs = (state.auditLogs || []).filter((item) => item.entityId !== "room_cairo_4");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Cairo Room 4"));
      const roomStatus = Array.from(document.querySelectorAll(".branch-room-list select"))
        .find((select) => normalize(select.getAttribute("aria-label")).toLowerCase().includes("cairo room 4"));
      if (!roomStatus || roomStatus.disabled) throw new Error("Cairo Room 4 status control was not rendered");
      setValue(roomStatus, "paused");
      const state = await waitFor(() => {
        const next = readState();
        const room = next.rooms?.find((item) => item.id === "room_cairo_4");
        const audit = next.auditLogs?.find((item) => item.action === "room.status_updated" && item.entityId === "room_cairo_4");
        return room?.status === "paused" && audit ? next : null;
      }, 5000);
      const room = state?.rooms?.find((item) => item.id === "room_cairo_4");
      const audit = state?.auditLogs?.find((item) => item.action === "room.status_updated" && item.entityId === "room_cairo_4");
      return {
        ok: Boolean(state),
        roomStatus: room?.status,
        roomBranchId: room?.branchId,
        auditAction: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.roomStatus === "paused" &&
      value?.roomBranchId === "br_cairo" &&
      value?.auditAction === "room.status_updated" &&
      value?.auditActorId === "usr_branch_demo",
  },
  {
    name: "branch room create workflow creates branch-scoped room",
    role: "branchadmin",
    route: "/app/branch/rooms",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.rooms = (state.rooms || []).filter((item) => item.name !== "QA Branch Studio");
      state.auditLogs = (state.auditLogs || []).filter((item) => !item.summary?.includes("QA Branch Studio"));
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/branch/rooms/new");
      await waitFor(() => document.querySelector(".branch-room-form"));
      await waitFor(() => normalize(document.body.textContent).includes("Rooms"));
      setByLabel("Room name", "QA Branch Studio");
      setByLabel("Capacity", "22");
      setByLabel("Equipment", "Projector, Audio");
      await clickButton("Add room");
      const state = await waitFor(() => {
        const next = readState();
        const room = next.rooms?.find((item) => item.name === "QA Branch Studio");
        const audit = room ? next.auditLogs?.find((item) => item.action === "room.created" && item.entityId === room.id) : null;
        return room && audit ? next : null;
      }, 5000);
      const room = state?.rooms?.find((item) => item.name === "QA Branch Studio");
      const audit = room ? state?.auditLogs?.find((item) => item.action === "room.created" && item.entityId === room.id) : null;
      return {
        ok: Boolean(state),
        roomBranchId: room?.branchId,
        capacity: room?.capacity,
        equipment: room?.equipment,
        status: room?.status,
        auditAction: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.roomBranchId === "br_cairo" &&
      value?.capacity === 22 &&
      value?.equipment?.includes("Projector") &&
      value?.equipment?.includes("Audio") &&
      value?.status === "active" &&
      value?.auditAction === "room.created" &&
      value?.auditActorId === "usr_branch_demo",
  },
  {
    name: "branch class workflow creates branch-scoped class",
    role: "branchadmin",
    route: "/app/branch/classes",
    setupSource: workflowSetupSource(`
      const state = readState();
      const removed = new Set(
        (state.classGroups || [])
          .filter((item) => item.name === "QA Branch Evening Class")
          .map((item) => item.id)
      );
      state.classGroups = (state.classGroups || []).filter((item) => !removed.has(item.id));
      state.teachers = (state.teachers || []).map((teacher) => ({
        ...teacher,
        assignedClassIds: (teacher.assignedClassIds || []).filter((id) => !removed.has(id))
      }));
      state.auditLogs = (state.auditLogs || []).filter((item) =>
        item.action !== "class.created" || !removed.has(item.entityId)
      );
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/branch/classes/new");
      await waitFor(() => document.querySelector('[data-testid="branch-class-composer"]'));
      setByLabel("Course run", "run_ar_l3_cairo_2026");
      setByLabel("Class name", "QA Branch Evening Class");
      setByLabel("Capacity", "12");
      setByLabel("Schedule", "Wed 17:00");
      setByLabel("Room", "room_cairo_4");
      await clickButton("Create class");
      const state = await waitFor(() => {
        const next = readState();
        const group = next.classGroups?.find((item) => item.name === "QA Branch Evening Class");
        const audit = group ? next.auditLogs?.find((item) => item.action === "class.created" && item.entityId === group.id) : null;
        return group && audit ? next : null;
      }, 5000);
      const group = state?.classGroups?.find((item) => item.name === "QA Branch Evening Class");
      const audit = group ? state?.auditLogs?.find((item) => item.action === "class.created" && item.entityId === group.id) : null;
      const run = state?.courseRuns?.find((item) => item.id === group?.courseRunId);
      const teacher = state?.teachers?.find((item) => item.userId === "usr_teacher_demo");
      return {
        ok: Boolean(state),
        runBranchId: run?.branchId,
        courseRunId: group?.courseRunId,
        roomId: group?.roomId,
        capacity: group?.capacity,
        studentCount: group?.studentIds?.length,
        teacherAssigned: teacher?.assignedClassIds?.includes(group?.id),
        auditAction: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.runBranchId === "br_cairo" &&
      value?.courseRunId === "run_ar_l3_cairo_2026" &&
      value?.roomId === "room_cairo_4" &&
      value?.capacity === 12 &&
      value?.studentCount === 0 &&
      value?.teacherAssigned === true &&
      value?.auditAction === "class.created" &&
      value?.auditActorId === "usr_branch_demo",
  },
  {
    name: "branch class lifecycle updates and pauses branch-scoped class",
    role: "branchadmin",
    route: "/app/branch/classes/class_ar_l3_cairo",
    source: workflowActionSource(`
      await waitFor(() => document.querySelector('[data-testid="branch-class-detail"]'));
      setByLabel("Class name", "QA Cairo Class Updated");
      setByLabel("Capacity", "18");
      setByLabel("Schedule", "Wed 17:30");
      setByLabel("Room", "room_cairo_4");
      await clickButton("Save class");
      await waitFor(() => {
        const group = readState().classGroups?.find((item) => item.id === "class_ar_l3_cairo");
        return group?.name === "QA Cairo Class Updated";
      }, 5000);
      await clickButton("Pause class");
      const state = await waitFor(() => {
        const next = readState();
        const group = next.classGroups?.find((item) => item.id === "class_ar_l3_cairo");
        const updated = next.auditLogs?.find((item) => item.action === "class.updated" && item.entityId === group?.id);
        const paused = next.auditLogs?.find((item) => item.action === "class.status_updated" && item.entityId === group?.id);
        return group?.status === "paused" && updated && paused ? next : null;
      }, 5000);
      const group = state?.classGroups?.find((item) => item.id === "class_ar_l3_cairo");
      return {
        ok: Boolean(state),
        name: group?.name,
        capacity: group?.capacity,
        schedule: group?.schedule,
        status: group?.status,
        roster: group?.studentIds,
        updatedAudit: state?.auditLogs?.some((item) => item.action === "class.updated" && item.entityId === group?.id),
        statusAudit: state?.auditLogs?.some((item) => item.action === "class.status_updated" && item.entityId === group?.id)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.name === "QA Cairo Class Updated" &&
      value?.capacity === 18 &&
      value?.schedule === "Wed 17:30" &&
      value?.status === "paused" &&
      value?.roster?.includes("stu_cairo_demo") &&
      value?.updatedAudit === true &&
      value?.statusAudit === true,
  },
  {
    name: "teacher scheduling workflow creates assigned live class session",
    role: "teacher",
    route: "/app/teacher/calendar",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.events = (state.events || []).filter((item) => !item.title?.startsWith("QA teacher live session "));
      state.classSessions = (state.classSessions || []).filter((item) => !item.title?.startsWith("QA teacher live session "));
      state.auditLogs = (state.auditLogs || []).filter((item) => !item.summary?.includes("QA teacher live session "));
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/teacher/calendar/new");
      const form = await waitFor(() => document.querySelector("#teacher-calendar-event-form"));
      if (!form) throw new Error("Teacher calendar create form did not open");
      const title = "QA teacher live session " + Date.now();
      setValue(form.querySelector('[name="title"]'), title);
      setValue(form.querySelector('[name="eventType"]'), "live_session");
      setValue(form.querySelector('[name="branchId"]'), "br_online");
      await waitFor(() => form.querySelector('[name="classGroupId"] option[value="class_ar_l3_a"]') && form.querySelector('[name="roomId"] option[value="room_online_a"]'));
      setValue(form.querySelector('[name="classGroupId"]'), "class_ar_l3_a");
      setValue(form.querySelector('[name="roomId"]'), "room_online_a");
      setValue(form.querySelector('[name="date"]'), "2026-07-06");
      setValue(form.querySelector('[name="starts"]'), "11:00");
      setValue(form.querySelector('[name="ends"]'), "11:45");
      const submitButton = document.querySelector('button[form="teacher-calendar-event-form"]');
      if (!submitButton || submitButton.disabled) throw new Error("Create event submit button not found");
      submitButton.click();
      const state = await waitFor(() => {
        const next = readState();
        return next.events?.some((item) => item.title === title && item.type === "live_session") ? next : null;
      });
      const event = state?.events?.find((item) => item.title === title);
      const session = state?.classSessions?.find((item) => item.eventId === event?.id || item.title === title);
      const classGroup = state?.classGroups?.find((item) => item.id === event?.classGroupId);
      const courseRun = state?.courseRuns?.find((item) => item.id === classGroup?.courseRunId);
      const actor = state?.users?.find((item) => item.id === "usr_teacher_demo");
      const audit = event ? state?.auditLogs?.find((item) => (item.action === "calendar.created" || item.action === "calendar.created_with_conflict") && item.entityId === event.id && item.actorId === "usr_teacher_demo") : null;
      return {
        ok: Boolean(state),
        eventType: event?.type,
        eventStatus: event?.status,
        eventBranchId: event?.branchId,
        eventOwnerId: event?.ownerId,
        eventRoomId: event?.roomId,
        eventClassGroupId: event?.classGroupId,
        sessionCreated: Boolean(session),
        sessionAttendanceSaved: session?.attendanceSaved,
        runTeacherId: courseRun?.teacherId,
        runBranchId: courseRun?.branchId,
        actorBranchId: actor?.branchId,
        lastAudit: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.eventType === "live_session" &&
      value?.eventOwnerId === "usr_teacher_demo" &&
      value?.eventBranchId === "br_online" &&
      value?.eventRoomId === "room_online_a" &&
      value?.eventClassGroupId === "class_ar_l3_a" &&
      value?.sessionCreated === true &&
      value?.sessionAttendanceSaved === false &&
      value?.runTeacherId === "usr_teacher_demo" &&
      value?.runBranchId === value?.actorBranchId &&
      value?.auditActorId === "usr_teacher_demo" &&
      ((value?.eventStatus === "active" &&
        value?.lastAudit === "calendar.created") ||
        (value?.eventStatus === "pending" &&
          value?.lastAudit === "calendar.created_with_conflict")),
  },
  {
    name: "registrar scheduling workflow creates placement calendar event",
    role: "registrar",
    route: "/app/registrar/schedule",
    source: workflowActionSource(`
      await goto("/app/registrar/schedule/new");
      await waitFor(() => document.querySelector(".registrar-schedule-composer"));
      const title = "QA placement booking " + Date.now();
      setByLabel("Title", title);
      setByLabel("Type", "placement_test");
      setByLabel("Date", "2026-07-08");
      setByLabel("Starts", "13:00");
      setByLabel("Ends", "13:30");
      await clickButton("Create event");
      const state = await waitFor(() => {
        const next = readState();
        return next.events?.some((item) => item.title === title && item.type === "placement_test") ? next : null;
      });
      const event = state?.events?.find((item) => item.title === title);
      const session = state?.classSessions?.find((item) => item.eventId === event?.id || item.title === title);
      const actor = state?.users?.find((item) => item.id === "usr_registrar_demo");
      return {
        ok: Boolean(state),
        eventType: event?.type,
        eventStatus: event?.status,
        eventBranchId: event?.branchId,
        actorBranchId: actor?.branchId,
        classGroupId: event?.classGroupId,
        sessionCreated: Boolean(session),
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.eventType === "placement_test" &&
      value?.eventBranchId === value?.actorBranchId &&
      value?.classGroupId === undefined &&
      value?.sessionCreated === false &&
      (value?.lastAudit === "calendar.created" ||
        value?.lastAudit === "calendar.created_with_conflict"),
  },
  {
    name: "branch messaging workflow sends branch-scoped message",
    role: "branchadmin",
    route: "/app/branch/messages",
    source: workflowActionSource(`
      await goto("/app/branch/messages/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="portal-message-compose-branchadmin"]'));
      if (!composer) throw new Error("Message composer did not open");
      const recipient = composer.querySelector("select");
      const recipientOption = Array.from(recipient?.options || []).find((option) => option.value === "usr_teacher_demo");
      if (!recipient || !recipientOption) throw new Error("Permitted recipient not found");
      setValue(recipient, recipientOption.value);
      const subject = "QA branch message " + Date.now();
      setByLabel("Subject", subject);
      setByLabel("Message", "Branch operational update from QA.");
      await clickButton("Send branch message");
      const state = await waitFor(() => {
        const next = readState();
        const message = next.messages?.find((item) => item.subject === subject);
        const log = next.communicationLogs?.find((item) => item.subject === subject);
        const audit = message ? next.auditLogs?.find((item) => item.action === "message.sent" && item.entityId === message.id) : null;
        return message && log && audit ? next : null;
      });
      const message = state?.messages?.find((item) => item.subject === subject);
      const log = state?.communicationLogs?.find((item) => item.subject === subject);
      const audit = message ? state?.auditLogs?.find((item) => item.action === "message.sent" && item.entityId === message.id) : null;
      return {
        ok: Boolean(state),
        fromUserId: message?.fromUserId,
        toUserId: message?.toUserId,
        logSubject: log?.subject,
        logActorId: log?.actorId,
        messageAudit: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_branch_demo" &&
      value?.toUserId === "usr_teacher_demo" &&
      value?.logSubject?.startsWith("QA branch message") &&
      value?.logActorId === "usr_branch_demo" &&
      value?.messageAudit === "message.sent" &&
      value?.auditActorId === "usr_branch_demo",
  },
  {
    name: "branch reports render scoped report workspace without audit leakage",
    role: "branchadmin",
    route: "/app/branch/reports",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Branch reports"));
      const recordSort = Array.from(document.querySelectorAll(".platform-report-row.header button"))
        .find((button) => normalize(button.textContent).includes("Record"));
      if (recordSort) recordSort.click();
      await delay(80);
      const text = normalize(document.body.textContent);
      const options = Array.from(document.querySelectorAll('[data-testid="branch-reports-toolbar"] select:first-of-type option')).map((option) => normalize(option.textContent));
      return {
        ok: text.includes("Report type") && text.includes("Export CSV"),
        hasReportTypeSelector: Boolean(document.querySelector('[data-testid="branch-reports-toolbar"] select')),
        hasActivityOption: options.includes("Activity"),
        hasFinanceOption: options.includes("Finance"),
        hasTypedRows: Boolean(document.querySelector(".platform-report-table.typed .platform-report-row-main")) &&
          (text.includes("Cairo Student Demo") || text.includes("Standard Arabic Level 3")),
        hasSortHeader: Boolean(document.querySelector(".platform-report-row.header button[aria-pressed='true']"))
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasReportTypeSelector === true &&
      value?.hasActivityOption === false &&
      value?.hasFinanceOption === true &&
      value?.hasTypedRows === true &&
      value?.hasSortHeader === true,
  },
  {
    name: "HOD curriculum workflow creates server-backed module",
    role: "headofdepartment",
    route: "/app/hod/curriculum",
    source: workflowActionSource(`
      await goto("/app/hod/curriculum/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="hod-module-composer"]'));
      if (!composer) throw new Error("HOD module composer did not open");
      const title = "QA HOD module " + Date.now();
      setByLabel("Module title", title);
      setByLabel("Outcomes", "Map source lesson, Align assessment");
      await clickButton("Add module");
      const state = await waitFor(() => {
        const next = readState();
        const module = next.modules?.find((item) => item.title === title && item.courseId === "course_ar_l3");
        const audit = next.auditLogs?.find((item) => item.action === "curriculum.module_created" && item.summary?.includes(title));
        return module && audit ? next : null;
      }, 5000);
      const readServerState = async () => {
        const response = await fetch("/api/platform/state", { credentials: "include" });
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.state ?? null;
      };
      const verifiedState = state || await readServerState();
      const module = verifiedState?.modules?.find((item) => item.title === title);
      const audit = verifiedState?.auditLogs?.find((item) => item.action === "curriculum.module_created" && item.summary?.includes(title));
      return {
        ok: Boolean(verifiedState),
        courseId: module?.courseId,
        order: module?.order,
        outcomes: module?.outcomes,
        lastAudit: audit?.action,
        actorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.courseId === "course_ar_l3" &&
      value?.order >= 4 &&
      value?.outcomes?.includes("Map source lesson") &&
      value?.lastAudit === "curriculum.module_created" &&
      value?.actorId === "usr_hod_demo",
  },
  {
    name: "HOD course-run workflow creates department delivery run",
    role: "headofdepartment",
    route: "/app/hod/classes/runs/new",
    setupSource: workflowSetupSource(`
      const state = readState();
      const removed = new Set((state.courseRuns || []).filter((item) => item.term === "QA Autumn 2026 Cairo").map((item) => item.id));
      state.courseRuns = (state.courseRuns || []).filter((item) => !removed.has(item.id));
      state.auditLogs = (state.auditLogs || []).filter((item) => item.action !== "course_run.created" || !removed.has(item.entityId));
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      setByLabel("Course", "course_ar_l3");
      setByLabel("Branch", "br_cairo");
      setByLabel("Teacher", "usr_teacher_demo");
      setByLabel("Term", "QA Autumn 2026 Cairo");
      setByLabel("Starts on", "2026-09-01");
      setByLabel("Ends on", "2026-11-30");
      await clickButton("Create course run");
      const state = await waitFor(() => {
        const next = readState();
        const run = next.courseRuns?.find((item) => item.term === "QA Autumn 2026 Cairo");
        const audit = run ? next.auditLogs?.find((item) => item.action === "course_run.created" && item.entityId === run.id) : null;
        return run && audit ? next : null;
      }, 5000);
      const run = state?.courseRuns?.find((item) => item.term === "QA Autumn 2026 Cairo");
      const audit = run ? state?.auditLogs?.find((item) => item.action === "course_run.created" && item.entityId === run.id) : null;
      return {
        ok: Boolean(state),
        courseId: run?.courseId,
        branchId: run?.branchId,
        teacherId: run?.teacherId,
        status: run?.status,
        startsOn: run?.startsOn,
        endsOn: run?.endsOn,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.courseId === "course_ar_l3" &&
      value?.branchId === "br_cairo" &&
      value?.teacherId === "usr_teacher_demo" &&
      value?.status === "pending" &&
      value?.startsOn === "2026-09-01" &&
      value?.endsOn === "2026-11-30" &&
      value?.auditActorId === "usr_hod_demo",
  },
  {
    name: "HOD course catalog workflow updates scoped course status",
    role: "headofdepartment",
    route: "/app/hod/courses",
    source: workflowActionSource(`
      await goto("/app/hod/courses/course_ar_l3");
      const form = await waitFor(() => document.querySelector('[data-testid="hod-course-status-form"]'));
      if (!form) throw new Error("HOD course status form did not open");
      setValue(form.querySelector("select"), "paused");
      await clickButtonWithin('[data-testid="hod-course-status-form"]', "Save status", true);
      const state = await waitFor(() => {
        const next = readState();
        const course = next.courses?.find((item) => item.id === "course_ar_l3");
        const audit = next.auditLogs?.find((item) => item.action === "course.status_updated" && item.entityId === "course_ar_l3");
        return course?.status === "paused" && audit ? next : null;
      }, 5000);
      const audit = state?.auditLogs?.find((item) => item.action === "course.status_updated" && item.entityId === "course_ar_l3");
      return {
        ok: Boolean(state),
        courseStatus: state?.courses?.find((item) => item.id === "course_ar_l3")?.status,
        lastAudit: audit?.action,
        actorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.courseStatus === "paused" &&
      value?.lastAudit === "course.status_updated" &&
      value?.actorId === "usr_hod_demo",
  },
  {
    name: "HOD assessment workflow creates scoped academic assessment",
    role: "headofdepartment",
    route: "/app/hod/assessments",
    source: workflowActionSource(`
      await goto("/app/hod/assessments/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="hod-assignment-composer"]'));
      if (!composer) throw new Error("HOD assignment composer did not open");
      const title = "QA HOD assessment " + Date.now();
      setByLabel("Assignment title", title);
      setByLabel("Submission type", "text");
      await clickButton("Create assignment");
      const state = await waitFor(() => {
        const next = readState();
        const assignment = next.assignments?.find((item) => item.title === title);
        const audit = assignment
          ? next.auditLogs?.find((item) => item.action === "assignment.created" && item.entityId === assignment.id)
          : null;
        return assignment && audit ? next : null;
      });
      const assignment = state?.assignments?.find((item) => item.title === title);
      const audit = assignment
        ? state?.auditLogs?.find((item) => item.action === "assignment.created" && item.entityId === assignment.id)
        : null;
      return {
        ok: Boolean(state),
        title: assignment?.title,
        courseRunId: assignment?.courseRunId,
        lastAudit: audit?.action,
        actorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.title?.startsWith("QA HOD assessment") &&
      value?.courseRunId === "run_ar_l3_2026" &&
      value?.lastAudit === "assignment.created" &&
      value?.actorId === "usr_hod_demo",
  },
  {
    name: "HOD assignment grading workflow scores department submission",
    role: "headofdepartment",
    route: "/app/hod/assessments",
    setupSource: workflowSetupSource(`
      const state = readState();
      const submission = state.assignmentSubmissions?.find((item) => item.id === "sub_ar_grammar_draft");
      state.assignmentSubmissions = submission
        ? [
            { ...submission, status: "pending", score: undefined, feedback: undefined },
            ...(state.assignmentSubmissions || []).filter((item) => item.id !== "sub_ar_grammar_draft"),
          ]
        : (state.assignmentSubmissions || []);
      state.grades = (state.grades || []).filter((item) => item.itemId !== "asg_ar_grammar");
      writeState(state);
      return { ok: Boolean(submission), submissionId: submission?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/hod/assessments/review/sub_ar_grammar_draft");
      const reviewCard = await waitFor(() => document.querySelector('[data-testid="hod-submission-review"]'));
      if (!reviewCard) throw new Error("HOD submission review did not open");
      const feedback = "QA HOD grading feedback " + Date.now();
      const editor = reviewCard.querySelector('[data-testid="hod-grade-editor"]');
      if (!editor) throw new Error("HOD grade editor was not rendered");
      const inputs = Array.from(editor.querySelectorAll("input"));
      const scoreInput = inputs.find((input) => input.type === "number");
      const feedbackInput = inputs.find((input) => input.type !== "number");
      setValue(scoreInput, "89");
      setValue(feedbackInput, feedback);
      const gradeButton = Array.from(editor.querySelectorAll("button"))
        .find((button) => visible(button) && !button.disabled && normalize(button.textContent) === "Save result");
      if (!gradeButton) throw new Error("HOD grade submission button not found");
      gradeButton.click();
      await delay(140);
      const state = await waitFor(() => {
        const next = readState();
        const submission = next.assignmentSubmissions?.find((item) => item.id === "sub_ar_grammar_draft");
        const grade = next.grades?.find((item) => item.itemId === "asg_ar_grammar" && item.feedback === feedback);
        return submission?.status === "completed" && submission?.score === 89 && grade ? next : null;
      });
      const fallback = readState();
      const submission = (state || fallback)?.assignmentSubmissions?.find((item) => item.id === "sub_ar_grammar_draft");
      const grade = (state || fallback)?.grades?.find((item) => item.itemId === "asg_ar_grammar" && item.feedback === feedback);
      return {
        ok: Boolean(state),
        submissionStatus: submission?.status,
        submissionScore: submission?.score,
        gradeScore: grade?.score,
        gradeFeedback: grade?.feedback
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.submissionStatus === "completed" &&
      value?.submissionScore === 89 &&
      value?.gradeScore === 89 &&
      value?.gradeFeedback?.startsWith("QA HOD grading feedback"),
  },
  {
    name: "HOD certificate issue is blocked until approval when issue control exists",
    role: "headofdepartment",
    route: "/app/hod/certificates",
    setupSource: workflowSetupSource(`
      const state = readState();
      const certificate = state.certificates?.find((item) => item.id === "cert_ar_2");
      state.certificates = (state.certificates || []).map((item) =>
        item.id === "cert_ar_2"
          ? { ...item, status: "pending_approval", approvedBy: undefined, approvedAt: undefined, issuedBy: undefined, issuedAt: undefined }
          : item
      );
      state.auditLogs = (state.auditLogs || []).filter((item) => item.entityId !== certificate?.id);
      writeState(state);
      return { ok: Boolean(certificate), certificateId: certificate?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/hod/certificates/cert_ar_2");
      const getButtons = () => Array.from(document.querySelectorAll("button"))
        .filter(visible)
        .map((button) => ({
          label: normalize(button.textContent),
          disabled: button.disabled || button.getAttribute("aria-disabled") === "true"
        }));
      await waitFor(() => normalize(document.body.textContent).includes("NCL-AR2-DEMO"));
      const before = readState().certificates?.find((item) => item.id === "cert_ar_2");
      const issueButton = Array.from(document.querySelectorAll("button"))
        .filter(visible)
        .find((button) => /^issue$/i.test(normalize(button.textContent)));
      const supportsIssueControl = Boolean(issueButton);
      const issueDisabled = Boolean(issueButton?.disabled || issueButton?.getAttribute("aria-disabled") === "true");
      if (issueButton && !issueDisabled) {
        issueButton.click();
        await delay(180);
      }
      const state = readState();
      const after = state.certificates?.find((item) => item.id === before?.id);
      const issuedAuditForCertificate = state.auditLogs?.some((item) => item.action === "certificate.issued" && item.entityId === before?.id) ?? false;
      return {
        ok: Boolean(before),
        beforeStatus: before?.status,
        afterStatus: after?.status,
        supportsIssueControl,
        issueDisabled,
        issuedAuditForCertificate,
        controls: getButtons()
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.beforeStatus === "pending_approval" &&
      (value?.supportsIssueControl === false ||
        value?.issueDisabled === true ||
        (value?.afterStatus !== "issued" &&
          value?.issuedAuditForCertificate === false)),
  },
  {
    name: "HOD certificate workflow approves and issues certificate",
    role: "headofdepartment",
    route: "/app/hod/certificates",
    setupSource: workflowSetupSource(`
      const state = readState();
      const certificate = state.certificates?.find((item) => item.id === "cert_ar_2");
      state.certificates = (state.certificates || []).map((item) =>
        item.id === "cert_ar_2"
          ? { ...item, status: "pending_approval", approvedBy: undefined, approvedAt: undefined, issuedBy: undefined, issuedAt: undefined }
          : item
      );
      state.auditLogs = (state.auditLogs || []).filter((item) => item.entityId !== certificate?.id);
      writeState(state);
      return { ok: Boolean(certificate), certificateId: certificate?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/hod/certificates/cert_ar_2");
      await waitFor(() => normalize(document.body.textContent).includes("NCL-AR2-DEMO"));
      const existing = readState().certificates?.find((item) => item.id === "cert_ar_2");
      if (existing?.status === "issued") {
        return { ok: true, status: "issued", alreadyIssued: true };
      }
      await clickButton("Approve", true);
      await waitFor(() => {
        const certificate = readState().certificates?.find((item) => item.id === "cert_ar_2");
        if (certificate?.status === "issued") return true;
        return Array.from(document.querySelectorAll("button")).some((button) => visible(button) && !button.disabled && /^issue certificate$/i.test(normalize(button.textContent)));
      });
      const approved = readState().certificates?.find((item) => item.id === "cert_ar_2");
      if (approved?.status !== "issued") {
        await clickButton("Issue certificate", true);
      }
      const state = await waitFor(() => {
        const next = readState();
        return next.certificates?.find((item) => item.id === "cert_ar_2")?.status === "issued" ? next : null;
      });
      const certificate = state?.certificates?.find((item) => item.id === "cert_ar_2");
      return {
        ok: Boolean(state),
        status: certificate?.status,
        notification: state?.notifications?.[0]?.title,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value => value?.ok && value?.status === "issued",
  },
  {
    name: "HOD certificate workflow rejects with audit reason",
    role: "headofdepartment",
    route: "/app/hod/certificates",
    setupSource: workflowSetupSource(`
      const state = readState();
      const certificate = state.certificates?.find((item) => item.id === "cert_ar_reject_demo");
      state.certificates = (state.certificates || []).map((item) =>
        item.id === "cert_ar_reject_demo"
          ? {
              ...item,
              status: "pending_approval",
              approvedBy: undefined,
              approvedAt: undefined,
              issuedBy: undefined,
              issuedAt: undefined,
              rejectedBy: undefined,
              rejectedAt: undefined,
              rejectionReason: undefined
            }
          : item
      );
      state.auditLogs = (state.auditLogs || []).filter((item) => item.entityId !== certificate?.id);
      state.documents = (state.documents || []).filter((item) => item.url !== "#certificate-cert_ar_reject_demo");
      writeState(state);
      return { ok: Boolean(certificate), certificateId: certificate?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/hod/certificates/cert_ar_reject_demo");
      await waitFor(() => normalize(document.body.textContent).includes("NCL-AR-REJECT-QA"));
      const rejectCard = await waitFor(() => document.querySelector('[data-testid="hod-certificate-detail"]'));
      if (!rejectCard) throw new Error("Reject certificate card was not rendered");
      await clickButtonWithin('[data-testid="hod-certificate-detail"]', "Reject", true);
      const reasonLabel = Array.from(rejectCard.querySelectorAll("label"))
        .find((item) => normalize(item.textContent).toLowerCase().includes("reason for rejection"));
      const reasonControl = reasonLabel?.querySelector("input, textarea, select");
      setValue(reasonControl, "QA eligibility evidence incomplete");
      const rejectButton = await waitFor(() =>
        Array.from(rejectCard.querySelectorAll("button"))
          .filter((button) => visible(button) && !button.disabled)
          .find((button) => /^confirm rejection$/i.test(normalize(button.textContent)))
      );
      if (!rejectButton) throw new Error("Reject button was not rendered for reject certificate card");
      rejectButton.click();
      await delay(90);
      const state = await waitFor(() => {
        const next = readState();
        return next.certificates?.find((item) => item.id === "cert_ar_reject_demo")?.status === "rejected" ? next : null;
      });
      const certificate = state?.certificates?.find((item) => item.id === "cert_ar_reject_demo");
      const rejectedAudit = state?.auditLogs?.find((item) => item.action === "certificate.rejected" && item.entityId === "cert_ar_reject_demo");
      const issueButton = Array.from(document.querySelectorAll("button"))
        .filter(visible)
        .find((button) => /^issue$/i.test(normalize(button.textContent)));
      if (issueButton && !issueButton.disabled) {
        issueButton.click();
        await delay(120);
      }
      const afterIssueAttempt = readState().certificates?.find((item) => item.id === "cert_ar_reject_demo");
      const issuedAuditForCertificate = readState().auditLogs?.some((item) => item.action === "certificate.issued" && item.entityId === "cert_ar_reject_demo") ?? false;
      return {
        ok: Boolean(certificate && rejectedAudit),
        status: certificate?.status,
        rejectedBy: certificate?.rejectedBy,
        rejectionReason: certificate?.rejectionReason,
        auditAction: rejectedAudit?.action,
        auditActor: rejectedAudit?.actorId,
        auditSummary: rejectedAudit?.summary,
        afterIssueStatus: afterIssueAttempt?.status,
        issuedAuditForCertificate,
        hasIssuedDocument: Boolean(readState().documents?.some((item) => item.url === "#certificate-cert_ar_reject_demo"))
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.status === "rejected" &&
      value?.rejectedBy === "usr_hod_demo" &&
      value?.rejectionReason === "QA eligibility evidence incomplete" &&
      value?.auditAction === "certificate.rejected" &&
      value?.auditActor === "usr_hod_demo" &&
      value?.auditSummary?.includes("QA eligibility evidence incomplete") &&
      value?.afterIssueStatus === "rejected" &&
      value?.issuedAuditForCertificate === false &&
      value?.hasIssuedDocument === false,
  },
  {
    name: "HOD messaging workflow sends department-scoped message",
    role: "headofdepartment",
    route: "/app/hod/messages",
    source: workflowActionSource(`
      await goto("/app/hod/messages/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="portal-message-compose-headofdepartment"]'));
      if (!composer) throw new Error("Message composer did not open");
      const recipient = composer.querySelector("select");
      const recipientOption = Array.from(recipient?.options || []).find((option) => option.value !== "usr_hod_demo");
      if (!recipient || !recipientOption) throw new Error("Permitted recipient not found");
      setValue(recipient, recipientOption.value);
      const subject = "QA HOD message " + Date.now();
      setByLabel("Subject", subject);
      setByLabel("Message", "Department academic update from QA.");
      await clickButton("Send academic message");
      const state = await waitFor(() => {
        const next = readState();
        return next.messages?.[0]?.subject === subject ? next : null;
      });
      return {
        ok: Boolean(state),
        fromUserId: state?.messages?.[0]?.fromUserId,
        toUserId: state?.messages?.[0]?.toUserId,
        logSubject: state?.communicationLogs?.[0]?.subject,
        messageAudit: state?.auditLogs?.find((item) => item.action === "message.sent" && item.summary?.includes(subject))?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_hod_demo" &&
      value?.toUserId !== "usr_hod_demo" &&
      value?.logSubject?.startsWith("QA HOD message") &&
      value?.messageAudit === "message.sent",
  },
  {
    name: "HOD reports exclude finance and save academic preset",
    role: "headofdepartment",
    route: "/app/hod/reports",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Academic reports"));
      const options = Array.from(document.querySelectorAll(".platform-report-controls select option")).map((option) => normalize(option.textContent));
      setByLabel("Report type", "attendance");
      await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Attendance report"));
      const statusSort = Array.from(document.querySelectorAll(".platform-report-row.header button"))
        .find((button) => normalize(button.textContent).includes("Status"));
      if (statusSort) statusSort.click();
      await delay(80);
      await clickButton("Save view");
      const state = await waitFor(() => {
        const next = readState();
        const preset = next.reportPresets?.find((item) =>
          item.ownerUserId === "usr_hod_demo" &&
          item.role === "headofdepartment" &&
          item.reportType === "attendance"
        );
        return preset ? next : null;
      });
      const preset = state?.reportPresets?.find((item) =>
        item.ownerUserId === "usr_hod_demo" &&
        item.role === "headofdepartment" &&
        item.reportType === "attendance"
      );
      return {
        ok: Boolean(preset),
        hasFinanceOption: options.includes("Finance"),
        hasActivityOption: options.includes("Activity"),
        hasTypedRows: Boolean(document.querySelector(".platform-report-table.typed .platform-report-row-main")) &&
          normalize(document.body.innerText || document.body.textContent).includes("Attendance"),
        hasStatusSort: Boolean(document.querySelector(".platform-report-row.header button[aria-pressed='true']")) &&
          normalize(document.querySelector(".platform-report-row.header button[aria-pressed='true']")?.textContent).includes("Status"),
        presetRole: preset?.role,
        presetOwner: preset?.ownerUserId,
        presetType: preset?.reportType,
        auditAction: state?.auditLogs?.find((item) => item.entityType === "ReportPreset")?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasFinanceOption === false &&
      value?.hasActivityOption === false &&
      value?.hasTypedRows === true &&
      value?.hasStatusSort === true &&
      value?.presetRole === "headofdepartment" &&
      value?.presetOwner === "usr_hod_demo" &&
      value?.presetType === "attendance" &&
      value?.auditAction === "report.preset.saved",
  },
  {
    name: "admin academic governance updates catalog status from admin route",
    role: "superadmin",
    route: "/app/admin/courses",
    source: workflowActionSource(`
      setByLabel("Course status", "paused");
      const state = await waitFor(() => {
        const next = readState();
        return next.courses?.find((item) => item.id === "course_ar_l3")?.status === "paused" ? next : null;
      });
      return {
        ok: Boolean(state),
        courseStatus: state?.courses?.find((item) => item.id === "course_ar_l3")?.status,
        lastAudit: state?.auditLogs?.[0]?.action,
        actorId: state?.auditLogs?.[0]?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.courseStatus === "paused" &&
      value?.lastAudit === "course.status_updated" &&
      value?.actorId === "usr_admin_demo",
  },
  {
    name: "teacher Quran review workflow updates progress and approves recitation",
    role: "teacher",
    route: "/app/teacher/quran-review",
    setupSource: workflowSetupSource(`
      const state = readState();
      const submission = state.recitationSubmissions?.find((item) => item.id === "rec_demo");
      state.recitationSubmissions = submission
        ? [
            { ...submission, status: "pending", feedback: undefined },
            ...(state.recitationSubmissions || []).filter((item) => item.id !== "rec_demo"),
          ]
        : (state.recitationSubmissions || []);
      writeState(state);
      return { ok: Boolean(submission), submissionId: submission?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await goto("/app/teacher/quran-review/rec_demo");
      const reviewForm = await waitFor(() => document.querySelector('[data-testid="teacher-recitation-review-form"]'));
      if (!reviewForm) throw new Error("Teacher recitation review form not found");
      const inputs = Array.from(reviewForm.querySelectorAll('input[type="number"]'));
      setValue(inputs[0], "91");
      setValue(inputs[1], "94");
      setValue(reviewForm.querySelector("textarea"), "QA tajweed review accepted.");
      await delay(140);
      const clickReviewButton = async (label) => {
        const expected = normalize(label).toLowerCase();
        const button = Array.from(reviewForm.querySelectorAll("button"))
          .find((item) => visible(item) && !item.disabled && normalize(item.textContent).toLowerCase().includes(expected));
        if (!button) throw new Error("Review button not found: " + label);
        button.click();
        await delay(120);
      };
      await clickReviewButton("Save progress");
      await waitFor(() => readState().quranProgress?.[0]?.memorizedPercent === 91);
      await clickReviewButton("Save review");
      const state = await waitFor(() => {
        const next = readState();
        return next.quranProgress?.[0]?.memorizedPercent === 91 && next.recitationSubmissions?.find((item) => item.id === "rec_demo")?.status === "approved" ? next : null;
      });
      const fallback = readState();
      const submission = (state || fallback)?.recitationSubmissions?.find((item) => item.id === "rec_demo");
      return {
        ok: Boolean(state),
        memorized: (state || fallback)?.quranProgress?.[0]?.memorizedPercent,
        tajweed: (state || fallback)?.quranProgress?.[0]?.tajweedScore,
        recitationStatus: submission?.status,
        notification: (state || fallback)?.notifications?.[0]?.title
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.memorized === 91 &&
      value?.tajweed === 94 &&
      value?.recitationStatus === "approved",
  },
  {
    name: "teacher messaging workflow sends and logs message",
    role: "teacher",
    route: "/app/teacher/messages",
    source: workflowActionSource(`
      await goto("/app/teacher/messages/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="portal-message-compose-teacher"]'));
      if (!composer) throw new Error("Message composer did not open");
      const recipient = composer.querySelector("select");
      const recipientOption = Array.from(recipient?.options || []).find((option) => option.value !== "usr_teacher_demo");
      if (!recipient || !recipientOption) throw new Error("Permitted recipient not found");
      setValue(recipient, recipientOption.value);
      const subject = "QA class update " + Date.now();
      setByLabel("Subject", subject);
      setByLabel("Message", "QA message body for connected workflow.");
      await clickButton("Send message");
      const sentState = await waitFor(() => {
        const next = readState();
        return next.messages?.[0]?.subject === subject && next.communicationLogs?.[0]?.subject === subject ? next : null;
      });
      const sentMessage = sentState?.messages?.[0];
      await goto("/app/teacher/messages");
      const inbox = await waitFor(() => document.querySelector('[data-testid="portal-messages-inbox-teacher"]'));
      const conversation = await waitFor(() =>
        Array.from(inbox?.querySelectorAll("button") || []).find((button) => normalize(button.textContent).includes(subject))
      );
      if (!conversation || !sentMessage) throw new Error("Sent message conversation did not render");
      conversation.click();
      const reply = await waitFor(() => document.querySelector('[data-testid="portal-message-reply-teacher"]'));
      if (!reply) throw new Error("Teacher reply composer did not render");
      setValue(reply.querySelector("textarea"), "QA reply stays in the same conversation.");
      await clickButton("Send reply");
      const state = await waitFor(() => {
        const next = readState();
        return next.messages?.find((item) => item.replyToMessageId === sentMessage.id) ? next : null;
      });
      const replyMessage = state?.messages?.find((item) => item.replyToMessageId === sentMessage.id);
      return {
        ok: Boolean(state),
        messageSubject: sentMessage?.subject,
        logSubject: sentState?.communicationLogs?.[0]?.subject,
        notification: sentState?.notifications?.find((item) => item.title === subject)?.title,
        sentThreadId: sentMessage?.threadId,
        replyThreadId: replyMessage?.threadId,
        replyToMessageId: replyMessage?.replyToMessageId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.messageSubject === value?.logSubject &&
      value?.sentThreadId === value?.replyThreadId &&
      Boolean(value?.replyToMessageId),
  },
  {
    name: "registrar messaging workflow sends and logs an admissions message",
    role: "registrar",
    route: "/app/registrar/messages",
    source: workflowActionSource(`
      await goto("/app/registrar/messages/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="portal-message-compose-registrar"]'));
      if (!composer) throw new Error("Registrar message composer did not open");
      const recipient = composer.querySelector("select");
      const recipientOption = Array.from(recipient?.options || []).find((option) => option.value === "usr_student_demo");
      if (!recipient || !recipientOption) throw new Error("Scoped registrar recipient not found");
      setValue(recipient, recipientOption.value);
      const subject = "QA registrar message " + Date.now();
      setValue(composer.querySelector("input[placeholder]"), subject);
      setValue(composer.querySelector("textarea"), "Admissions follow-up from portal QA.");
      await clickButton("Send message");
      const state = await waitFor(() => {
        const next = readState();
        const message = next.messages?.find((item) => item.subject === subject);
        const log = next.communicationLogs?.find((item) => item.subject === subject);
        return message && log ? next : null;
      });
      const message = state?.messages?.find((item) => item.subject === subject);
      const log = state?.communicationLogs?.find((item) => item.subject === subject);
      const auditVisibleInRegistrarScope = message
        ? state?.auditLogs?.some((item) => item.action === "message.sent" && item.entityId === message.id) === true
        : false;
      const serverResponse = await fetch("/api/platform/state", { credentials: "include" });
      const serverPayload = serverResponse.ok ? await serverResponse.json() : null;
      const serverMessage = serverPayload?.state?.messages?.find((item) => item.subject === subject);
      const localState = readState();
      return {
        ok: Boolean(state),
        fromUserId: message?.fromUserId,
        toUserId: message?.toUserId,
        logActorId: log?.actorId,
        auditVisibleInRegistrarScope,
        selectedRecipientId: recipient.value,
        subjectValue: composer.querySelector("input[placeholder]")?.value,
        bodyValue: composer.querySelector("textarea")?.value,
        composerNotice: normalize(composer.querySelector(".platform-attendance-error")?.textContent),
        localMessageFound: Boolean(localState.messages?.find((item) => item.subject === subject)),
        serverMessageFound: Boolean(serverMessage),
        serverStatus: serverResponse.status
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_registrar_demo" &&
      value?.toUserId === "usr_student_demo" &&
      value?.logActorId === "usr_registrar_demo",
  },
  {
    name: "registrar lead intake creates server-backed lead",
    role: "registrar",
    route: "/app/registrar/leads",
    source: workflowActionSource(`
      await goto("/app/registrar/leads/new");
      await waitFor(() => document.querySelector(".registrar-lead-form"));
      const fullName = "QA Lead " + Date.now();
      setByLabel("Full name", fullName);
      setByLabel("Phone", "+20 100 000 0888");
      setByLabel("Email", "qa.lead." + Date.now() + "@nilelearn.local");
      setByLabel("Subject", "Arabic Language QA");
      setByLabel("Notes", "Created by registrar workflow QA.");
      await clickButton("Add lead");
      const state = await waitFor(() => {
        const next = readState();
        return next.leads?.some((item) => item.fullName === fullName && item.subject === "Arabic Language QA") ? next : null;
      });
      const lead = state?.leads?.find((item) => item.fullName === fullName);
      return {
        ok: Boolean(state),
        leadStatus: lead?.status,
        leadSubject: lead?.subject,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.leadStatus === "lead" &&
      value?.leadSubject === "Arabic Language QA" &&
      value?.lastAudit === "lead.created",
  },
  {
    name: "registrar application workflow creates direct application file",
    role: "registrar",
    route: "/app/registrar/applications",
    source: workflowActionSource(`
      await goto("/app/registrar/applications/new");
      const form = await waitFor(() => document.querySelector(".registrar-application-form"));
      if (!form) throw new Error("Application form not found");
      const stamp = Date.now();
      const fullName = "QA Direct Application " + stamp;
      const email = "qa.application." + stamp + "@nilelearn.local";
      setValue(form.querySelector('[name="applicationFullName"]'), fullName);
      setValue(form.querySelector('[name="applicationEmail"]'), email);
      setValue(form.querySelector('[name="applicationPhone"]'), "+20 100 000 0666");
      setValue(form.querySelector('[name="applicationBranch"]'), "br_cairo");
      setValue(form.querySelector('[name="applicationCourseInterest"]'), "Arabic Language QA");
      setValue(form.querySelector('[name="applicationSchedulePreference"]'), "Weekend mornings");
      setValue(form.querySelector('[name="applicationNotes"]'), "Direct application created by portal QA.");
      await clickButton("Create application");
      const state = await waitFor(() => {
        const next = readState();
        const lead = next.leads?.find((item) => item.email === email);
        const application = next.applications?.find((item) => item.leadId === lead?.id);
        const log = next.communicationLogs?.find((item) => item.subject === "Application intake" && normalize(item.body).includes(fullName));
        return lead && application && log ? next : null;
      }, 8000);
      const lead = state?.leads?.find((item) => item.email === email);
      const application = state?.applications?.find((item) => item.leadId === lead?.id);
      await goto("/app/registrar/applications/" + application?.id);
      await waitFor(() => normalize(document.body.textContent).includes("Application lifecycle") && normalize(document.body.textContent).includes(fullName), 5000);
      await goto("/app/registrar/applications/" + application?.id + "/placement");
      const placementForm = await waitFor(() => {
        const form = document.querySelector(".registrar-placement-booking-form");
        const values = Array.from(form?.querySelectorAll("input, select") || []).map((control) => control.value);
        return values.includes(fullName) && values.includes(email) && values.includes("br_cairo") ? form : null;
      });
      if (!placementForm) throw new Error("Linked placement form not found");
      const placementValues = Array.from(placementForm.querySelectorAll("input, select")).map((control) => control.value);
      const identityPrefilled = placementValues.includes(fullName) && placementValues.includes(email) && placementValues.includes("br_cairo");
      setByLabel("Preferred date", "2026-07-16");
      setByLabel("Current level", "Reads short passages");
      await clickButtonWithin(".registrar-placement-booking-form", "Book placement");
      const linkedState = await waitFor(() => {
        const next = readState();
        return next.placementTests?.find((item) => item.leadId === lead?.id) ? next : null;
      }, 5000);
      const booking = linkedState?.placementTests?.find((item) => item.leadId === lead?.id);
      await goto("/app/registrar/placement-tests/" + booking?.id);
      await waitFor(() => document.querySelector(".registrar-placement-card"));
      setByLabel("Recommended level", "Arabic Level 3");
      setByLabel("Score", "84");
      await clickButton("Record placement result");
      const completedState = await waitFor(() => {
        const next = readState();
        const workflow = next.enrollmentWorkflows?.find((item) => item.applicationId === application?.id && item.placementTestId === booking?.id);
        const result = next.placementResults?.find((item) => item.bookingId === booking?.id && item.score === 84);
        const audit = result ? next.auditLogs?.find((item) => item.action === "placement.result_recorded" && item.entityId === result.id) : null;
        return workflow && result && audit ? next : null;
      }, 8000);
      const workflow = completedState?.enrollmentWorkflows?.find((item) => item.applicationId === application?.id && item.placementTestId === booking?.id);
      return {
        ok: Boolean(state && linkedState && completedState),
        leadStatus: lead?.status,
        applicationStatus: application?.status,
        branchId: application?.branchId,
        courseInterest: application?.courseInterest,
        communicationLogged: state?.communicationLogs?.some((item) => item.subject === "Application intake" && normalize(item.body).includes(fullName)),
        detailOpened: true,
        identityPrefilled,
        bookingLeadId: booking?.leadId,
        workflowApplicationId: workflow?.applicationId,
        workflowPlacementTestId: workflow?.placementTestId,
        workflowSource: workflow?.source,
        placementScore: completedState?.placementResults?.find((item) => item.bookingId === booking?.id)?.score,
        lastAudit: completedState?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.leadStatus === "ready_to_enroll" &&
      value?.applicationStatus === "pending" &&
      value?.branchId === "br_cairo" &&
      value?.courseInterest === "Arabic Language QA" &&
      value?.communicationLogged === true &&
      value?.detailOpened === true &&
      value?.identityPrefilled === true &&
      Boolean(value?.bookingLeadId) &&
      Boolean(value?.workflowApplicationId) &&
      Boolean(value?.workflowPlacementTestId) &&
      value?.workflowSource === "placement" &&
      value?.placementScore === 84 &&
      value?.lastAudit === "placement.result_recorded",
  },
  {
    name: "registrar finance workflow records payment and settles invoice",
    role: "registrar",
    route: "/app/registrar/payments",
    source: workflowActionSource(`
      await waitFor(() => document.querySelector('[data-testid="registrar-payments-list"]'));
      const beforeRows = Array.from(document.querySelectorAll('[data-testid="registrar-payments-list"] [data-invoice-id]')).length;
      const search = document.querySelector('[data-testid="registrar-payments-toolbar"] input');
      if (search) setValue(search, "inv_demo_1");
      await waitFor(() => Array.from(document.querySelectorAll('[data-testid="registrar-payments-list"] [data-invoice-id]')).length === 1);
      const filteredRows = Array.from(document.querySelectorAll('[data-testid="registrar-payments-list"] [data-invoice-id]')).length;
      const before = readState();
      const beforePaid = before.payments?.filter((item) => item.status === "paid").length ?? 0;
      const beforeInvoicePaid = before.payments?.filter((item) => item.invoiceId === "inv_demo_1" && item.status === "paid").length ?? 0;
      const row = document.querySelector('[data-testid="registrar-payments-list"] [data-invoice-id="inv_demo_1"]');
      const link = row?.querySelector('a[href="/app/registrar/payments/inv_demo_1"]');
      if (!link) return { ok: false, hasPaymentList: true, beforeRows, filteredRows, beforePaid, beforeInvoicePaid, reason: "record link unavailable" };
      link.click();
      const form = await waitFor(() => document.querySelector('[data-testid="registrar-payment-record-form"]'));
      const button = form ? Array.from(form.querySelectorAll("button")).find((item) => normalize(item.textContent).toLowerCase().includes("record payment")) : null;
      if (!button || button.disabled) return { ok: false, hasPaymentList: true, hasPaymentForm: Boolean(form), beforeRows, filteredRows, beforePaid, beforeInvoicePaid, reason: "record button unavailable" };
      button.click();
      const state = await waitFor(() => {
        const next = readState();
        const invoice = next.invoices?.find((item) => item.id === "inv_demo_1");
        const invoicePaid = next.payments?.filter((item) => item.invoiceId === "inv_demo_1" && item.status === "paid").length ?? 0;
        return invoice?.status === "paid" && invoicePaid > beforeInvoicePaid ? next : null;
      });
      const invoice = state?.invoices?.find((item) => item.id === "inv_demo_1");
      return {
        ok: Boolean(state),
        hasPaymentList: true,
        hasPaymentForm: Boolean(form),
        beforeRows,
        filteredRows,
        invoiceStatus: invoice?.status,
        beforePaid,
        beforeInvoicePaid,
        afterPaid: state?.payments?.filter((item) => item.status === "paid").length,
        afterInvoicePaid: state?.payments?.filter((item) => item.invoiceId === "inv_demo_1" && item.status === "paid").length,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasPaymentList === true &&
      value?.hasPaymentForm === true &&
      value?.beforeRows >= 2 &&
      value?.filteredRows === 1 &&
      value?.invoiceStatus === "paid" &&
      value?.afterInvoicePaid > value?.beforeInvoicePaid,
  },
  {
    name: "registrar finance workflow records partial payment balance",
    role: "registrar",
    route: "/app/registrar/payments",
    source: workflowActionSource(`
      await waitFor(() => document.querySelector('[data-testid="registrar-payments-list"]'));
      const renderedSeed = await waitFor(() => document.querySelector('[data-testid="registrar-payments-list"] [data-invoice-id="inv_cairo_demo_1"]'), 4000);
      if (!renderedSeed) {
        return {
          ok: false,
          reason: "partial invoice did not render before filtering",
          body: normalize(document.body.innerText || document.body.textContent).slice(0, 700),
          invoiceInState: readState().invoices?.some((item) => item.id === "inv_cairo_demo_1")
        };
      }
      const search = document.querySelector('[data-testid="registrar-payments-toolbar"] input');
      setValue(search, "inv_cairo_demo_1");
      const row = await waitFor(() =>
        document.querySelector('[data-testid="registrar-payments-list"] [data-invoice-id="inv_cairo_demo_1"]')
      );
      if (!row) return { ok: false, reason: "partial invoice row not found" };
      const link = row.querySelector('a[href="/app/registrar/payments/inv_cairo_demo_1"]');
      if (!link) return { ok: false, reason: "partial invoice link not found" };
      link.click();
      const form = await waitFor(() => document.querySelector('[data-testid="registrar-payment-record-form"]'));
      if (!form) return { ok: false, reason: "partial payment form not found" };
      setValue(form.querySelector('input[type="number"]'), "250");
      const method = form.querySelector("select");
      setValue(method, "cash");
      const reference = form.querySelector('input[placeholder]');
      setValue(reference, "CASH-PARTIAL-QA");
      const before = readState();
      const beforeInvoice = before.invoices?.find((item) => item.id === "inv_cairo_demo_1");
      const beforeBalance = beforeInvoice ? beforeInvoice.amount - (before.payments || []).filter((item) => item.invoiceId === beforeInvoice.id && item.status === "paid").reduce((sum, item) => sum + item.amount, 0) : null;
      const button = Array.from(form.querySelectorAll("button"))
        .find((item) => normalize(item.textContent).toLowerCase().includes("record payment"));
      if (!button || button.disabled) return { ok: false, reason: "record button unavailable" };
      button.click();
      const state = await waitFor(() => {
        const next = readState();
        const invoice = next.invoices?.find((item) => item.id === "inv_cairo_demo_1");
        const payment = next.payments?.find((item) => item.invoiceId === "inv_cairo_demo_1");
        return invoice?.status === "pending" && payment?.amount === 250 ? next : null;
      });
      const invoice = state?.invoices?.find((item) => item.id === "inv_cairo_demo_1");
      const payment = state?.payments?.find((item) => item.invoiceId === "inv_cairo_demo_1");
      return {
        ok: Boolean(state),
        invoiceStatus: invoice?.status,
        paymentAmount: payment?.amount,
        paymentMethod: payment?.method,
        paymentReference: payment?.reference,
        balance: invoice ? invoice.amount - (state?.payments || []).filter((item) => item.invoiceId === invoice.id && item.status === "paid").reduce((sum, item) => sum + item.amount, 0) : null,
        beforeBalance,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.invoiceStatus === "pending" &&
      value?.paymentAmount === 250 &&
      value?.paymentMethod === "cash" &&
      value?.paymentReference === "CASH-PARTIAL-QA" &&
      value?.beforeBalance - value?.balance === 250 &&
      value?.lastAudit === "payment.recorded",
  },
  {
    name: "registrar admissions workflow converts new lead",
    role: "registrar",
    route: "/app/registrar/leads",
    source: workflowActionSource(`
      await goto("/app/registrar/leads/new");
      await waitFor(() => document.querySelector(".registrar-lead-form"));
      const fullName = "QA Convert Lead " + Date.now();
      setByLabel("Full name", fullName);
      setByLabel("Phone", "+20 100 000 0999");
      setByLabel("Email", "qa.convert." + Date.now() + "@nilelearn.local");
      setByLabel("Subject", "Arabic Language");
      setByLabel("Notes", "Generated by workflow QA.");
      await clickButton("Add lead");
      const created = await waitFor(() => readState().leads?.find((item) => item.fullName === fullName));
      await goto("/app/registrar/leads/" + created?.id);
      const detail = await waitFor(() => document.querySelector(".registrar-detail-focus"));
      const button = detail ? Array.from(detail.querySelectorAll("button")).find((item) => normalize(item.textContent).includes("Convert lead") && !item.disabled) : null;
      if (!button) return { ok: false, reason: "convert button not found", fullName };
      button.click();
      const state = await waitFor(() => {
        const next = readState();
        const lead = next.leads?.find((item) => item.fullName === fullName);
        return lead && next.applications?.some((item) => item.leadId === lead.id) ? next : null;
      });
      const lead = state?.leads?.find((item) => item.fullName === fullName);
      return {
        ok: Boolean(state),
        leadStatus: lead?.status,
        applicationCreated: state?.applications?.some((item) => item.leadId === lead?.id),
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.leadStatus === "ready_to_enroll" &&
      value?.applicationCreated === true,
  },
  {
    name: "registrar placement workflow records result",
    role: "registrar",
    route: "/app/registrar/placement-tests/pt_demo_1",
    source: workflowActionSource(`
      setByLabel("Recommended level", "Arabic Level 4 QA");
      setByLabel("Score", "86");
      await clickButton("Record placement result");
      const state = await waitFor(() => {
        const next = readState();
        const booking = next.placementTests?.find((item) => item.id === "pt_demo_1");
        return booking?.status === "completed" && booking?.recommendedLevel === "Arabic Level 4 QA" ? next : null;
      });
      const booking = state?.placementTests?.find((item) => item.id === "pt_demo_1");
      const workflow = state?.enrollmentWorkflows?.find((item) => item.placementTestId === "pt_demo_1");
      return {
        ok: Boolean(state),
        bookingStatus: booking?.status,
        recommendedLevel: booking?.recommendedLevel,
        workflowStatus: workflow?.status,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.bookingStatus === "completed" &&
      value?.workflowStatus === "ready_to_enroll",
  },
  {
    name: "registrar placement booking workflow creates scoped booking",
    role: "registrar",
    route: "/app/registrar/placement-tests",
    source: workflowActionSource(`
      await goto("/app/registrar/placement-tests/new");
      await waitFor(() => document.querySelector(".registrar-placement-booking-form"));
      const setPlacementField = (label, value) => {
        const form = document.querySelector(".registrar-placement-booking-form");
        if (!form) throw new Error("Placement booking form not found");
        const expected = normalize(label).toLowerCase();
        const match = Array.from(form.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes(expected));
        const control = match?.querySelector("input, select, textarea");
        setValue(control, value);
      };
      const fullName = "QA Placement " + Date.now();
      setPlacementField("Student name", fullName);
      setPlacementField("Phone", "+20 100 000 0777");
      setPlacementField("Email", "qa.placement." + Date.now() + "@nilelearn.local");
      setPlacementField("Branch", "br_online");
      setPlacementField("Subject", "Arabic Placement QA");
      setPlacementField("Preferred date", "2026-07-15");
      setPlacementField("Current level", "Can read short texts");
      await clickButton("Book placement");
      const state = await waitFor(() => {
        const next = readState();
        return next.placementTests?.some((item) => item.fullName === fullName && item.subject === "Arabic Placement QA") ? next : null;
      });
      const booking = state?.placementTests?.find((item) => item.fullName === fullName);
      return {
        ok: Boolean(state),
        bookingStatus: booking?.status,
        branchId: booking?.branchId,
        preferredDate: booking?.preferredDate,
        currentLevel: booking?.currentLevel,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.bookingStatus === "pending" &&
      value?.branchId === "br_online" &&
      value?.preferredDate === "2026-07-15" &&
      value?.currentLevel === "Can read short texts" &&
      value?.lastAudit === "placement.created",
  },
  {
    name: "registrar direct student workflow creates enrolled student",
    role: "registrar",
    route: "/app/registrar/students",
    source: workflowActionSource(`
      await goto("/app/registrar/students/new");
      const form = await waitFor(() => document.querySelector(".registrar-student-create-form"));
      if (!form) throw new Error("Student creation form did not open");
      const setStudentField = (label, value) => {
        const expected = normalize(label).toLowerCase();
        const match = Array.from(form.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes(expected));
        const control = match?.querySelector("input, select, textarea");
        if (!control) throw new Error("Student field not found: " + label);
        setValue(control, value);
      };
      const stamp = Date.now();
      const fullName = "QA Direct Student " + stamp;
      const email = "qa.direct.student." + stamp + "@nilelearn.local";
      setStudentField("Full name", fullName);
      setStudentField("Email", email);
      setStudentField("Phone / WhatsApp", "+20 100 000 0888");
      setStudentField("Branch", "br_cairo");
      setStudentField("Subject / course interest", "Arabic Language");
      setStudentField("Age group", "Adult");
      await clickButtonWithin(".registrar-student-create-form", "Continue");
      await waitFor(() => {
        const runLabel = Array.from(form.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes("course run"));
        const select = runLabel?.querySelector("select");
        return select && Array.from(select.options).some((option) => option.value === "run_ar_l3_cairo_2026") ? select : null;
      });
      setStudentField("Course run", "run_ar_l3_cairo_2026");
      await waitFor(() => {
        const classLabel = Array.from(form.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes("class / group"));
        const select = classLabel?.querySelector("select");
        return select && Array.from(select.options).some((option) => option.value === "class_ar_l3_cairo") ? select : null;
      });
      setStudentField("Class / group", "class_ar_l3_cairo");
      setStudentField("Current level / placement", "Arabic Level 3");
      setStudentField("Student status", "active");
      await clickButtonWithin(".registrar-student-create-form", "Continue");
      setStudentField("Notes", "Created by portal QA.");
      await clickButton("Create and enroll");
      const state = await waitFor(() => {
        const next = readState();
        const user = next.users?.find((item) => item.email === email && item.activeRole === "student");
        const student = next.students?.find((item) => item.userId === user?.id);
        const enrollment = next.enrollments?.find((item) => item.studentId === student?.id && item.classGroupId === "class_ar_l3_cairo");
        const classGroup = next.classGroups?.find((item) => item.id === "class_ar_l3_cairo");
        const invoice = next.invoices?.find((item) => item.studentId === student?.id);
        return user && student && enrollment && classGroup?.studentIds?.includes(student.id) && invoice ? next : null;
      }, 8000);
      const user = state?.users?.find((item) => item.email === email);
      const student = state?.students?.find((item) => item.userId === user?.id);
      const enrollment = state?.enrollments?.find((item) => item.studentId === student?.id);
      const invoice = state?.invoices?.find((item) => item.studentId === student?.id);
      return {
        ok: Boolean(state),
        userRole: user?.activeRole,
        studentStatus: student?.status,
        source: student?.source,
        assignedRun: enrollment?.courseRunId,
        assignedClass: enrollment?.classGroupId,
        teacherId: enrollment?.teacherId,
        invoiceStatus: invoice?.status,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.userRole === "student" &&
      value?.studentStatus === "active" &&
      value?.source === "direct" &&
      value?.assignedRun === "run_ar_l3_cairo_2026" &&
      value?.assignedClass === "class_ar_l3_cairo" &&
      value?.teacherId === "usr_teacher_demo" &&
      value?.invoiceStatus === "pending" &&
      value?.lastAudit === "enrollment.created",
  },
  {
    name: "registrar enrollment workflow activates student account",
    role: "registrar",
    route: "/app/registrar/enrollments",
    source: workflowActionSource(`
      await goto("/app/registrar/enrollments/ew_demo_1");
      await waitFor(() => document.querySelector('[data-testid="registrar-enrollment-form"]'));
      const setEnrollmentField = (label, value) => {
        const row = document.querySelector('[data-testid="registrar-enrollment-form"]');
        if (!row) throw new Error("Enrollment form not found");
        const expected = normalize(label).toLowerCase();
        const match = Array.from(row.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes(expected));
        const control = match?.querySelector("input, select, textarea");
        setValue(control, value);
      };
      setEnrollmentField("Run", "run_ar_l3_assign_qa");
      await waitFor(() => {
        const row = document.querySelector('[data-testid="registrar-enrollment-form"]');
        const classControl = Array.from(row?.querySelectorAll("label") || [])
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes("class"))
          ?.querySelector("select");
        return classControl && Array.from(classControl.options).some((option) => option.value === "class_ar_l3_assign_qa") ? classControl : null;
      });
      setEnrollmentField("Class", "class_ar_l3_assign_qa");
      await clickButtonWithin('[data-testid="registrar-enrollment-form"]', "Activate enrollment");
      const readServerState = async () => {
        const response = await fetch("/api/platform/state", { credentials: "include" });
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.state ?? null;
      };
      const state = await waitFor(() => {
        const next = readState();
        const workflow = next.enrollmentWorkflows?.find((item) => item.id === "ew_demo_1");
        const student = next.students?.find((item) => item.id === workflow?.studentId);
        const user = next.users?.find((item) => item.id === student?.userId);
        const invoice = next.invoices?.find((item) => item.studentId === student?.id);
        const classGroup = next.classGroups?.find((item) => item.id === "class_ar_l3_assign_qa");
        const enrollment = next.enrollments?.find((item) => item.studentId === student?.id);
        return user && student && workflow?.studentId === student.id && invoice && classGroup?.studentIds?.includes(student.id) && enrollment?.courseRunId === "run_ar_l3_assign_qa" ? next : null;
      }, 8000);
      const verifiedState = state || await readServerState();
      const workflow = verifiedState?.enrollmentWorkflows?.find((item) => item.id === "ew_demo_1");
      const student = verifiedState?.students?.find((item) => item.id === workflow?.studentId);
      const user = verifiedState?.users?.find((item) => item.id === student?.userId);
      const invoice = verifiedState?.invoices?.find((item) => item.studentId === student?.id);
      const classGroup = verifiedState?.classGroups?.find((item) => item.id === "class_ar_l3_assign_qa");
      const enrollment = verifiedState?.enrollments?.find((item) => item.studentId === student?.id);
      const lastAudit = verifiedState?.auditLogs?.[0];
      return {
        ok: Boolean(verifiedState),
        userRole: user?.activeRole,
        workflowStatus: workflow?.status,
        invoiceStatus: invoice?.status,
        assignedRun: enrollment?.courseRunId,
        assignedClass: Boolean(classGroup?.studentIds?.includes(student?.id) || /Assignment QA/i.test(lastAudit?.summary || "")),
        stateSource: state ? "localStorage" : "server",
        lastAudit: lastAudit?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.userRole === "student" &&
      value?.workflowStatus === "active" &&
      value?.invoiceStatus === "pending" &&
      value?.assignedRun === "run_ar_l3_assign_qa" &&
      value?.assignedClass === true &&
      value?.lastAudit === "enrollment.activated",
  },
  {
    name: "registrar enrollment record transfers and resumes class membership",
    role: "registrar",
    route: "/app/registrar/enrollments/records/enr_ar_l3_cairo",
    source: workflowActionSource(`
      const detail = await waitFor(() => document.querySelector('[data-testid="registrar-enrollment-record-detail"]'));
      if (!detail) throw new Error("Enrollment record detail did not render");
      setByLabel("Target class", "class_ar_l3_cairo_evening");
      setByLabel("Transfer reason", "QA schedule transfer");
      await clickButton("Transfer enrollment");
      await waitFor(() => {
        const next = readState();
        const enrollment = next.enrollments?.find((item) => item.id === "enr_ar_l3_cairo");
        const source = next.classGroups?.find((item) => item.id === "class_ar_l3_cairo");
        const target = next.classGroups?.find((item) => item.id === "class_ar_l3_cairo_evening");
        return enrollment?.classGroupId === target?.id && !source?.studentIds?.includes("stu_cairo_demo") && target?.studentIds?.includes("stu_cairo_demo");
      }, 5000);
      setByLabel("Reason for pause or cancellation", "QA temporary pause");
      await clickButton("Pause", true);
      await waitFor(() => readState().enrollments?.find((item) => item.id === "enr_ar_l3_cairo")?.status === "paused", 5000);
      await clickButton("Resume", true);
      const state = await waitFor(() => {
        const next = readState();
        const enrollment = next.enrollments?.find((item) => item.id === "enr_ar_l3_cairo");
        const transferAudit = next.auditLogs?.find((item) => item.action === "enrollment.transferred" && item.entityId === enrollment?.id);
        const statusAudits = next.auditLogs?.filter((item) => item.action === "enrollment.status_updated" && item.entityId === enrollment?.id) || [];
        return enrollment?.status === "active" && transferAudit && statusAudits.length >= 2 ? next : null;
      }, 5000);
      const enrollment = state?.enrollments?.find((item) => item.id === "enr_ar_l3_cairo");
      const source = state?.classGroups?.find((item) => item.id === "class_ar_l3_cairo");
      const target = state?.classGroups?.find((item) => item.id === "class_ar_l3_cairo_evening");
      const student = state?.students?.find((item) => item.id === "stu_cairo_demo");
      const user = state?.users?.find((item) => item.id === student?.userId);
      return {
        ok: Boolean(state),
        classGroupId: enrollment?.classGroupId,
        courseRunId: enrollment?.courseRunId,
        teacherId: enrollment?.teacherId,
        status: enrollment?.status,
        sourceHasStudent: source?.studentIds?.includes("stu_cairo_demo"),
        targetHasStudent: target?.studentIds?.includes("stu_cairo_demo"),
        studentStatus: student?.status,
        userStatus: user?.status,
        transferAudit: state?.auditLogs?.some((item) => item.action === "enrollment.transferred" && item.entityId === enrollment?.id),
        statusAuditCount: state?.auditLogs?.filter((item) => item.action === "enrollment.status_updated" && item.entityId === enrollment?.id).length
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.classGroupId === "class_ar_l3_cairo_evening" &&
      value?.courseRunId === "run_ar_l3_cairo_2026" &&
      value?.teacherId === "usr_teacher_demo" &&
      value?.status === "active" &&
      value?.sourceHasStudent === false &&
      value?.targetHasStudent === true &&
      value?.studentStatus === "active" &&
      value?.userStatus === "active" &&
      value?.transferAudit === true &&
      value?.statusAuditCount >= 2,
  },
  {
    name: "super admin messaging workflow sends and logs a platform message",
    role: "superadmin",
    route: "/app/admin/messages",
    source: workflowActionSource(`
      await goto("/app/admin/messages/new");
      const composer = await waitFor(() => document.querySelector('[data-testid="portal-message-compose-superadmin"]'));
      if (!composer) throw new Error("Super Admin message composer did not open");
      const recipient = composer.querySelector("select");
      const recipientOption = Array.from(recipient?.options || []).find((option) => option.value === "usr_student_alex_demo");
      if (!recipient || !recipientOption) throw new Error("Global message recipient not found");
      setValue(recipient, recipientOption.value);
      const subject = "QA platform message " + Date.now();
      setByLabel("Subject", subject);
      setByLabel("Message", "Platform communication from portal QA.");
      await clickButton("Send message");
      const state = await waitFor(() => {
        const next = readState();
        const message = next.messages?.find((item) => item.subject === subject);
        const log = next.communicationLogs?.find((item) => item.subject === subject);
        const audit = message ? next.auditLogs?.find((item) => item.action === "message.sent" && item.entityId === message.id) : null;
        return message && log && audit ? next : null;
      });
      const message = state?.messages?.find((item) => item.subject === subject);
      const log = state?.communicationLogs?.find((item) => item.subject === subject);
      const audit = message ? state?.auditLogs?.find((item) => item.action === "message.sent" && item.entityId === message.id) : null;
      return {
        ok: Boolean(state),
        fromUserId: message?.fromUserId,
        toUserId: message?.toUserId,
        logActorId: log?.actorId,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_admin_demo" &&
      value?.toUserId === "usr_student_alex_demo" &&
      value?.logActorId === "usr_admin_demo" &&
      value?.auditActorId === "usr_admin_demo",
  },
  {
    name: "admin user workflow creates staff account",
    role: "superadmin",
    route: "/app/admin/users/new",
    source: workflowActionSource(`
      const form = await waitFor(() => document.querySelector(".admin-access-guided-form"));
      const setFormLabel = (label, value) => {
        const expected = normalize(label).toLowerCase();
        const match = Array.from(form.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().startsWith(expected));
        const control = match?.querySelector("input, select, textarea");
        if (!control) throw new Error("Input not found: " + label);
        setValue(control, value);
      };
      const stamp = Date.now();
      const fullName = "QA Registrar Staff " + stamp;
      const email = "qa.registrar.staff." + stamp + "@nilelearn.local";
      await clickButtonWithin(".admin-users-role-grid", "Registrar");
      await clickButton("Continue");
      setFormLabel("Full name", fullName);
      setFormLabel("Email", email);
      setFormLabel("Phone / WhatsApp", "+20 100 000 0303");
      await clickButton("Continue");
      setFormLabel("Branch", "br_cairo");
      setFormLabel("Access level", "admissions");
      await clickButton("Continue");
      await clickButton("Create connected account");
      const createdState = await waitFor(() => {
        const next = readState();
        const user = next.users?.find((item) => item.email === email && item.activeRole === "registrar");
        const profile = next.staffProfiles?.find((item) => item.userId === user?.id && item.role === "registrar");
        return user && profile ? next : null;
      }, 4000);
      if (!createdState) throw new Error("Staff account was not created");
      await waitFor(() => normalize(document.body.textContent).includes("Account overview"));
      const accessLink = Array.from(document.querySelectorAll("a"))
        .find((anchor) => {
          const href = anchor.getAttribute("href") || "";
          return normalize(anchor.textContent).includes("Edit access") || href.endsWith("/access");
        });
      if (!accessLink) throw new Error("Access link not found");
      accessLink.click();
      await delay(120);
      await waitFor(() => normalize(document.body.textContent).includes("Access settings"));
      await clickButton("Pause");
      const findPausedAccountState = (next) => {
        const user = next?.users?.find((item) => item.email === email);
        const profile = next?.staffProfiles?.find((item) => item.userId === user?.id && item.role === "registrar");
        return user?.status === "paused" && profile?.status === "paused" ? next : null;
      };
      const readServerState = async () => {
        const response = await fetch("/api/platform/state", { credentials: "include" });
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.state ?? null;
      };
      const waitForServerState = async (timeout = 5000) => {
        const started = performance.now();
        let last = null;
        while (performance.now() - started < timeout) {
          last = await readServerState();
          if (findPausedAccountState(last)) return last;
          await delay(120);
        }
        return last;
      };
      const localState = await waitFor(() => {
        const next = readState();
        return findPausedAccountState(next);
      }, 5000);
      const state = localState || findPausedAccountState(await waitForServerState(5000));
      const user = state?.users?.find((item) => item.email === email);
      const staffProfile = state?.staffProfiles?.find((item) => item.userId === user?.id && item.role === "registrar");
      const student = state?.students?.find((item) => item.userId === user?.id);
      const audit = state?.auditLogs?.[0];
      const createdAudit = state?.auditLogs?.find((item) => item.action === "staff.user.created" && item.entityId === user?.id);
      return {
        ok: Boolean(state),
        userEmail: user?.email,
        userStatus: user?.status,
        userRole: user?.activeRole,
        userRoles: user?.roles,
        userBranchId: user?.branchId,
        userDepartmentId: user?.departmentId,
        studentUserId: student?.userId,
        profileUserId: staffProfile?.userId,
        profileRole: staffProfile?.role,
        profileStatus: staffProfile?.status,
        profileScope: staffProfile?.permissionScope,
        profileBranchIds: staffProfile?.branchIds,
        profileDepartmentIds: staffProfile?.departmentIds,
        profileOperations: staffProfile?.operationalScope,
        lastAudit: audit?.action,
        auditEntityType: audit?.entityType,
        auditEntityId: audit?.entityId,
        auditActorId: audit?.actorId,
        createdAuditAction: createdAudit?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.userEmail?.endsWith("@nilelearn.local") &&
      value?.userStatus === "paused" &&
      value?.userRole === "registrar" &&
      value?.userRoles?.includes("registrar") &&
      value?.userBranchId === "br_cairo" &&
      value?.userDepartmentId === "dep_admissions" &&
      !value?.studentUserId &&
      value?.profileUserId &&
      value?.profileRole === "registrar" &&
      value?.profileStatus === "paused" &&
      value?.profileScope === "admissions" &&
      value?.profileBranchIds?.includes("br_cairo") &&
      value?.profileDepartmentIds?.includes("dep_admissions") &&
      value?.profileOperations?.includes("placement") &&
      value?.lastAudit === "user.updated" &&
      value?.auditEntityType === "User" &&
      value?.auditEntityId &&
      value?.auditActorId === "usr_admin_demo" &&
      value?.createdAuditAction === "staff.user.created",
  },
  {
    name: "admin teacher assignment workflow reassigns isolated course run",
    role: "superadmin",
    route: "/app/admin/users/usr_teacher_spare/assignment",
    setupSource: workflowSetupSource(`
      const state = readState();
      return {
        ok: Boolean(
          state.users?.some((item) => item.id === "usr_teacher_spare") &&
          state.courseRuns?.some((item) => item.id === "run_ar_l3_assign_qa") &&
          state.classGroups?.some((item) => item.id === "class_ar_l3_assign_qa") &&
          state.events?.some((item) => item.id === "evt_ar_l3_assign_qa")
        )
      };
    `),
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Course run assignment"));
      const form = document.querySelector(".admin-access-teacher-assignment-form");
      if (!form) throw new Error("Teacher assignment form was not rendered");
      const setFormLabel = (label, value) => {
        const expected = normalize(label).toLowerCase();
        const match = Array.from(form.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().startsWith(expected));
        const control = match?.querySelector("input, select, textarea");
        if (!control) throw new Error("Input not found: " + label);
        setValue(control, value);
      };
      setFormLabel("Course run", "run_ar_l3_assign_qa");
      setFormLabel("Department", "dep_arabic");
      setFormLabel("Subjects / specialties", "Arabic grammar, QA reassignment");
      setFormLabel("Availability", "Fri 09:00, Fri 10:30");
      await waitFor(() => normalize(form.textContent).includes("Teacher Spare"));
      await clickButtonWithin(".admin-access-teacher-assignment-form", "teacher");
      const state = await waitFor(() => {
        const next = readState();
        return next.courseRuns?.find((item) => item.id === "run_ar_l3_assign_qa")?.teacherId === "usr_teacher_spare" ? next : null;
      }, 5000);
      const run = state?.courseRuns?.find((item) => item.id === "run_ar_l3_assign_qa");
      const event = state?.events?.find((item) => item.id === "evt_ar_l3_assign_qa");
      const teacher = state?.teachers?.find((item) => item.userId === "usr_teacher_spare");
      const availability = state?.teacherAvailability?.filter((item) => item.teacherId === "usr_teacher_spare") || [];
      const audit = state?.auditLogs?.find((item) => item.action === "teacher.assigned" && item.entityId === "run_ar_l3_assign_qa");
      return {
        ok: Boolean(state),
        runTeacherId: run?.teacherId,
        eventOwnerId: event?.ownerId,
        teacherDepartmentId: teacher?.departmentId,
        teacherSpecialties: teacher?.specialties,
        availabilityCount: availability.length,
        auditAction: audit?.action,
        auditSummary: audit?.summary,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.runTeacherId === "usr_teacher_spare" &&
      value?.eventOwnerId === "usr_teacher_spare" &&
      value?.teacherDepartmentId === "dep_arabic" &&
      value?.teacherSpecialties?.includes("QA reassignment") &&
      value?.availabilityCount === 2 &&
      value?.auditAction === "teacher.assigned" &&
      (value?.auditSummary?.includes("reassigned from Teacher Demo") ||
        value?.auditSummary?.includes("Teacher Spare assigned")) &&
      value?.auditActorId === "usr_admin_demo",
  },
  {
    name: "admin roles overview renders role summaries",
    role: "superadmin",
    route: "/app/admin/roles",
    source: workflowActionSource(`
      const overview = await waitFor(() => document.querySelector('[data-testid="admin-roles-overview"]'), 4000);
      const roleRows = Array.from(document.querySelectorAll('[data-testid^="admin-role-row-"]'));
      const permissionEditor = document.querySelector('[data-testid="admin-permissions-page"], .admin-permission-grid');
      const branchEditor = document.querySelector('[data-testid^="branch-status-"], .admin-branch-list select');
      const text = normalize(document.body.textContent || "");
      return {
        ok: Boolean(overview),
        roleRowCount: roleRows.length,
        hasStudent: Boolean(document.querySelector('[data-testid="admin-role-row-student"]')),
        hasTeacher: Boolean(document.querySelector('[data-testid="admin-role-row-teacher"]')),
        hasAdmin: Boolean(document.querySelector('[data-testid="admin-role-row-superadmin"]')),
        hasAccessRulesLink: text.includes("Access rules"),
        hasPermissionEditor: Boolean(permissionEditor),
        hasBranchEditor: Boolean(branchEditor)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.roleRowCount >= 6 &&
      value?.hasStudent &&
      value?.hasTeacher &&
      value?.hasAdmin &&
      value?.hasAccessRulesLink &&
      value?.hasPermissionEditor === false &&
      value?.hasBranchEditor === false,
  },
  {
    name: "admin governance workflow updates access rules",
    role: "superadmin",
    route: "/app/admin/permissions",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Access rules"));
      const permissionButton = await waitFor(() => document.querySelector('[data-testid="permission-toggle-teacher-payments-read"]'), 4000);
      if (!permissionButton) throw new Error("Payments read permission control was not rendered");
      const beforePermission = readState().permissions?.teacher?.includes("payments:read") === true;
      permissionButton.click();
      const permissionState = await waitFor(() => {
        const next = readState();
        return next.permissions?.teacher?.includes("payments:read") !== beforePermission ? next : null;
      }, 5000);
      const resultState = await waitFor(() => normalize(document.querySelector('[data-testid="permission-result"]')?.textContent || "").includes("Access rule saved"), 5000);
      const state = permissionState;
      const permissionAudit = state?.auditLogs?.find((item) => item.action === "permission.updated" && item.entityId === "teacher");
      return {
        ok: Boolean(state && resultState),
        teacherHasPaymentRead: state?.permissions?.teacher?.includes("payments:read") === true,
        expectedPermission: !beforePermission,
        permissionAuditAction: permissionAudit?.action,
        permissionAuditActorId: permissionAudit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.teacherHasPaymentRead === value?.expectedPermission &&
      value?.permissionAuditAction === "permission.updated" &&
      value?.permissionAuditActorId === "usr_admin_demo",
  },
  {
    name: "admin branch workflow updates branch status",
    role: "superadmin",
    route: "/app/admin/branches",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Branch access"));
      const cairoStatus = await waitFor(() => document.querySelector('[data-testid="branch-status-br_cairo"]'), 4000);
      if (!cairoStatus) throw new Error("Cairo branch status control was not rendered");
      setValue(cairoStatus, "paused");
      const state = await waitFor(() => {
        const next = readState();
        return next.branches?.find((item) => item.id === "br_cairo")?.status === "paused" ? next : null;
      }, 5000);
      const branchAudit = state?.auditLogs?.find((item) => item.action === "branch.updated" && item.entityId === "br_cairo");
      return {
        ok: Boolean(state),
        branchStatus: state?.branches?.find((item) => item.id === "br_cairo")?.status,
        branchAuditAction: branchAudit?.action,
        branchAuditActorId: branchAudit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.branchStatus === "paused" &&
      value?.branchAuditAction === "branch.updated" &&
      value?.branchAuditActorId === "usr_admin_demo",
  },
  {
    name: "admin attendance report filters attendance records",
    role: "superadmin",
    route: "/app/admin/reports/attendance",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Attendance report"));
      const search = document.querySelector('input[placeholder="Search attendance"]');
      if (search) {
        search.value = "Cairo";
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const statusSelect = Array.from(document.querySelectorAll("select"))
        .find((select) => normalize(select.closest("label")?.textContent || "").includes("Status"));
      if (statusSelect) {
        statusSelect.value = "present";
        statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await delay(80);
      const body = normalize(document.body.innerText || document.body.textContent);
      const statuses = Array.from(document.querySelectorAll(".platform-status")).map((item) => normalize(item.textContent));
      return {
        ok: body.includes("Attendance report") && body.includes("Attendance records"),
        hasSearchControl: Boolean(search),
        hasStatusControl: Boolean(statusSelect),
        hasExportAction: Boolean(Array.from(document.querySelectorAll("button")).find((button) => normalize(button.textContent).includes("Export CSV"))),
        filteredRowsVisible: body.includes("Cairo Student Demo"),
        statusesPresentOnly: statuses.length > 0 && statuses.every((item) => item === "present"),
        body: body.slice(0, 500)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasSearchControl === true &&
      value?.hasStatusControl === true &&
      value?.filteredRowsVisible === true &&
      value?.hasExportAction === true &&
      value?.statusesPresentOnly === true,
  },
  {
    name: "branch payment workflow records Cairo-scoped invoice",
    role: "branchadmin",
    route: "/app/branch/payments",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.invoices = (state.invoices || []).map((item) =>
        item.id === "inv_cairo_demo_1" ? { ...item, status: "pending" } : item
      );
      state.auditLogs = (state.auditLogs || []).filter((item) => item.action !== "payment.recorded" || !item.summary?.includes("inv_cairo_demo_1"));
      writeState(state);
      return { ok: state.invoices?.some((item) => item.id === "inv_cairo_demo_1"), invoiceId: "inv_cairo_demo_1" };
    `),
    source: workflowActionSource(`
      await waitFor(() => document.querySelector('[data-testid="branch-payments-list"]'));
      const row = await waitFor(() =>
        Array.from(document.querySelectorAll('[data-testid="branch-payments-list"] [data-invoice-id]'))
          .find((item) => normalize(item.textContent).includes("inv_cairo_demo_1"))
      );
      const link = row?.querySelector('a[href="/app/branch/payments/inv_cairo_demo_1"]');
      if (!link) return { ok: false, reason: "branch payment link not found" };
      link.click();
      const detail = await waitFor(() => document.querySelector('[data-testid="branch-payment-record-detail"]'));
      if (!detail) return { ok: false, reason: "branch payment detail not found" };
      const button = Array.from(detail.querySelectorAll("button"))
        .find((item) => normalize(item.textContent).toLowerCase().includes("record payment"));
      if (!button || button.disabled) return { ok: false, reason: "branch payment button unavailable" };
      button.click();
      const state = await waitFor(() => {
        const next = readState();
        const invoice = next.invoices?.find((item) => item.id === "inv_cairo_demo_1");
        const payment = next.payments?.find((item) => item.invoiceId === "inv_cairo_demo_1");
        const audit = payment ? next.auditLogs?.find((item) => item.action === "payment.recorded" && item.entityId === payment.id) : null;
        return invoice?.status === "paid" && payment?.status === "paid" && audit ? next : null;
      });
      const payment = state?.payments?.find((item) => item.invoiceId === "inv_cairo_demo_1");
      const audit = payment ? state?.auditLogs?.find((item) => item.action === "payment.recorded" && item.entityId === payment.id) : null;
      return {
        ok: Boolean(state),
        invoiceStatus: state?.invoices?.find((item) => item.id === "inv_cairo_demo_1")?.status,
        paymentStatus: payment?.status,
        lastAudit: audit?.action,
        auditActorId: audit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.invoiceStatus === "paid" &&
      value?.paymentStatus === "paid" &&
      value?.lastAudit === "payment.recorded" &&
      value?.auditActorId === "usr_branch_demo",
  },
  {
    name: "admin Moodle source workflow displays server projection state",
    role: "superadmin",
    route: "/app/admin/moodle-source",
    source: workflowActionSource(`
      const list = await waitFor(
        () => document.querySelector('[data-testid="moodle-source-list-superadmin"]'),
        4000
      );
      if (!list) throw new Error("Moodle source list did not render");
      const settled = await waitFor(() => {
        const loading = document.querySelector('[data-testid="moodle-source-loading"]');
        const rows = document.querySelectorAll('[data-testid="moodle-source-course"]');
        const error = document.querySelector('[data-testid="moodle-source-error"]');
        const empty = normalize(list.textContent).includes("No Moodle courses are assigned");
        return !loading && (rows.length > 0 || error || empty)
          ? { rows: rows.length, error: Boolean(error), empty }
          : null;
      }, 5000);
      const text = normalize(list.textContent || "");
      const projectionRequests = performance
        .getEntriesByType("resource")
        .filter((entry) => {
          try {
            return new URL(entry.name).pathname === "/api/integrations/moodle/projections/courses";
          } catch {
            return false;
          }
        }).length;
      return {
        ok: Boolean(settled),
        ...settled,
        hasReadOnlyBoundary: text.includes("Read-only Moodle course source") || settled?.error || settled?.empty,
        projectionSource: list.getAttribute("data-projection-source"),
        projectionRequests,
        hasFreshness: Boolean(document.querySelector('[data-testid="moodle-source-freshness"]'))
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasReadOnlyBoundary === true &&
      value?.projectionRequests > 0 &&
      ["server", "unavailable"].includes(value?.projectionSource) &&
      (value?.error === true ||
        value?.empty === true ||
        (value?.rows > 0 && value?.hasFreshness === true)),
  },
  {
    name: "admin Moodle course content workflow preserves read-only server projection boundary",
    role: "superadmin",
    route: "/app/admin/moodle-source/course_ar_l3",
    source: workflowActionSource(`
      const workspace = await waitFor(
        () => document.querySelector('[data-testid="moodle-course-content-superadmin"]'),
        4000
      );
      if (!workspace) throw new Error("Moodle course content workspace did not render");
      const settled = await waitFor(() => {
        const loading = document.querySelector('[data-testid="moodle-content-loading"]');
        const ready = document.querySelector('[data-testid="moodle-content-ready"]');
        const error = document.querySelector('[data-testid="moodle-content-error"]');
        const empty = document.querySelector('[data-testid="moodle-content-empty"]');
        return !loading && (ready || error || empty)
          ? { ready: Boolean(ready), error: Boolean(error), empty: Boolean(empty) }
          : null;
      }, 5000);
      const expectedPath = "/api/integrations/moodle/projections/courses/course_ar_l3/content";
      const projectionRequests = performance
        .getEntriesByType("resource")
        .filter((entry) => {
          try {
            return new URL(entry.name).pathname === expectedPath;
          } catch {
            return false;
          }
        }).length;
      const directProviderRequests = performance
        .getEntriesByType("resource")
        .filter((entry) => {
          try {
            return new URL(entry.name).hostname.includes("moodle");
          } catch {
            return false;
          }
        }).length;
      return {
        ok: Boolean(settled),
        ...settled,
        projectionRequests,
        directProviderRequests,
        readOnly: workspace.getAttribute("data-read-only") === "true",
        projectionSource: workspace.getAttribute("data-projection-source"),
        forms: workspace.querySelectorAll("form").length,
        fileInputs: workspace.querySelectorAll('input[type="file"]').length,
        editableControls: workspace.querySelectorAll("input, select, textarea").length,
        unexpectedButtons: Array.from(workspace.querySelectorAll("button"))
          .filter((button) => normalize(button.textContent).toLowerCase() !== "retry")
          .length,
        sections: workspace.querySelectorAll('[data-testid="moodle-content-section"]').length,
        activities: workspace.querySelectorAll('[data-testid="moodle-content-activity"]').length,
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.projectionRequests > 0 &&
      value?.directProviderRequests === 0 &&
      value?.readOnly === true &&
      ["server", "unavailable"].includes(value?.projectionSource) &&
      value?.forms === 0 &&
      value?.fileInputs === 0 &&
      value?.editableControls === 0 &&
      value?.unexpectedButtons === 0 &&
      (value?.error === true ||
        value?.empty === true ||
        (value?.ready === true &&
          value?.sections >= 0 &&
          value?.activities >= 0)),
  },
  {
    name: "admin integrations workflow checks mock provider and logs result",
    role: "superadmin",
    route: "/app/admin/integrations",
    source: workflowActionSource(`
      await clickButton("Moodle LMS");
      await clickButton("Record review");
      const checkedState = await waitFor(() => {
        const next = readState();
        return next.auditLogs?.some((item) => item.action === "integration.local_checked" && item.entityId === "moodle") ? next : null;
      }, 5000);
      const found = await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Moodle LMS") && normalize(document.body.innerText || document.body.textContent).includes("Reviewed"));
      const body = normalize(document.body.innerText || document.body.textContent);
      const integration = checkedState?.integrations?.find((item) => item.id === "moodle");
      const checkAudit = checkedState?.auditLogs?.find((item) => item.action === "integration.local_checked" && item.entityId === "moodle");
      return {
        ok: Boolean(found && checkedState),
        checkedProvider: body.includes("Moodle LMS"),
        checkLogged: body.includes("Reviewed"),
        status: integration?.status,
        checkAuditAction: checkAudit?.action,
        checkAuditActorId: checkAudit?.actorId,
        body: body.slice(0, 700)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.checkedProvider === true &&
      value?.checkLogged === true &&
      value?.checkAuditAction === "integration.local_checked" &&
      value?.checkAuditActorId === "usr_admin_demo",
  },
  {
    name: "admin system health workflow records health audit",
    role: "superadmin",
    route: "/app/admin/system-health",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Health checks"));
      await clickButton("Run check");
      const state = await waitFor(() => {
        const next = readState();
        return next.auditLogs?.find((item) => item.action === "system.health_checked" && item.entityId === "health") ? next : null;
      }, 5000);
      const audit = state?.auditLogs?.find((item) => item.action === "system.health_checked" && item.entityId === "health");
      const body = normalize(document.body.innerText || document.body.textContent);
      return {
        ok: Boolean(state),
        healthVisible: body.includes("Health") || body.includes("System health") || body.includes("Platform operations"),
        auditAction: audit?.action,
        auditActorId: audit?.actorId,
        auditSummary: audit?.summary
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.healthVisible === true &&
      value?.auditAction === "system.health_checked" &&
      value?.auditActorId === "usr_admin_demo" &&
      /\d+%/.test(value?.auditSummary ?? ""),
  },
  {
    name: "admin settings workflow saves platform configuration audit",
    role: "superadmin",
    route: "/app/admin/settings",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("School setup"));
      const term = "QA Term " + Date.now();
      setByLabel("Organization", "Nile Center QA");
      setByLabel("Academic term", term);
      setByLabel("Activity retention days", "730");
      await clickButton("Save settings");
      const state = await waitFor(() => {
        const next = readState();
        return next.auditLogs?.find((item) =>
          item.action === "settings.saved" &&
          item.entityType === "PlatformSettings" &&
          item.entityId === "global" &&
          item.summary?.includes("Nile Center QA") &&
          item.summary?.includes("730 day retention")
        ) ? next : null;
      }, 5000);
      const audit = state?.auditLogs?.find((item) =>
        item.action === "settings.saved" &&
        item.entityType === "PlatformSettings" &&
        item.entityId === "global" &&
        item.summary?.includes("Nile Center QA") &&
        item.summary?.includes("730 day retention")
      );
      return {
        ok: Boolean(state),
        auditAction: audit?.action,
        auditActorId: audit?.actorId,
        auditSummary: audit?.summary,
        hasTerm: audit?.summary?.includes(term) ?? false
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.auditAction === "settings.saved" &&
      value?.auditActorId === "usr_admin_demo" &&
      value?.hasTerm === true &&
      value?.auditSummary?.includes("730 day retention"),
  },
];

try {
  recordProgress("open browser");
  await runPw("open", [`${baseUrl}/auth/login`]);

  if (workflowNameFilter) {
    const selectedPublicWorkflows = publicFormWorkflowCases.filter(workflow =>
      workflow.name.toLowerCase().includes(workflowNameFilter)
    );
    const selectedDeepWorkflows = deepWorkflowCases.filter(workflow =>
      workflow.name.toLowerCase().includes(workflowNameFilter)
    );
    const selectedFormsRoleDenials = formsRoleDenialWorkflowName
      .toLowerCase()
      .includes(workflowNameFilter);
    const selectedWorkflows = [
      ...selectedPublicWorkflows,
      ...selectedDeepWorkflows,
      ...(selectedFormsRoleDenials
        ? [{ name: formsRoleDenialWorkflowName }]
        : []),
    ];
    await assertCheck(
      `workflow filter "${workflowNameFilter}" matched cases`,
      {
        count: selectedWorkflows.length,
        names: selectedWorkflows.map(workflow => workflow.name),
      },
      value => value?.count > 0
    );
    for (const workflow of selectedPublicWorkflows) {
      await runPublicFormWorkflow(workflow);
    }
    for (const workflow of selectedDeepWorkflows) {
      await runDeepWorkflow(workflow);
    }
    if (selectedFormsRoleDenials) {
      await runFormsRoleDenialChecks();
    }
    await assertNoUnexpectedBrowserConsoleErrors();
    throw new Error("__QA_FILTER_COMPLETE__");
  }

  if (roleNameFilters.length) {
    await assertCheck(
      `role filter "${roleNameFilters.join(",")}" matched roles`,
      {
        count: selectedRoles.length,
        names: selectedRoles.map(role => role.role),
      },
      value => value?.count > 0
    );
  }

  recordProgress("public routes");
  for (const publicRoute of publicRoutes) {
    assertRunBudget(`checking public route ${publicRoute}`);
    await goto(publicRoute);
    const publicCheck = await pageEval(inspectPublicSource(publicRoute));
    await assertCheck(
      `${publicRoute} renders public page`,
      publicCheck,
      value =>
        value?.path === publicRoute &&
        Boolean(value?.heading) &&
        value?.textLength > (publicRoute === "/404" ? 80 : 160) &&
        value?.errorBoundary === false &&
        (publicRoute === "/404" ? true : value?.notFound === false)
    );
    await assertCheck(
      `${publicRoute} has no horizontal overflow`,
      publicCheck,
      value =>
        value?.overflow <= 1 && (value?.overflowElements?.length ?? 0) === 0
    );
    await assertCheck(
      `${publicRoute} has no unlabeled visible controls`,
      publicCheck,
      value => (value?.unlabeledControls?.length ?? 0) === 0
    );
    await assertCheck(
      `${publicRoute} has meaningful public interactions`,
      publicCheck,
      value => value?.visibleControls >= (publicRoute === "/404" ? 1 : 2)
    );
  }

  recordProgress("auth routes");
  for (const authRoute of authRoutes) {
    assertRunBudget(`checking auth route ${authRoute}`);
    let authCheck = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await goto(authRoute);
      authCheck = await pageEval(inspectAuthSource(authRoute));
      if (
        authCheck?.path === authRoute &&
        Boolean(authCheck?.heading) &&
        authCheck?.textLength > 120
      ) {
        break;
      }
      if (attempt === 1) {
        recordProgress("auth route retry", {
          route: authRoute,
          observedPath: authCheck?.path ?? "unknown",
        });
      }
    }
    await assertCheck(
      `${authRoute} renders auth experience`,
      authCheck,
      value =>
        value?.path === authRoute &&
        Boolean(value?.heading) &&
        value?.textLength > 120 &&
        value?.errorBoundary === false
    );
    await assertCheck(
      `${authRoute} has contextual calligraphy`,
      authCheck,
      value => Boolean(value?.quoteArabic)
    );
    await assertCheck(
      `${authRoute} has no horizontal overflow`,
      authCheck,
      value =>
        value?.overflow <= 1 && (value?.overflowElements?.length ?? 0) === 0
    );
    await assertCheck(
      `${authRoute} has no unlabeled visible controls`,
      authCheck,
      value => (value?.unlabeledControls?.length ?? 0) === 0
    );
  }

  await goto("/auth/login");
  const gateway = await pageEval(`async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let portalLinks = [];
    let quoteArabic = "";
    for (let index = 0; index < 40; index += 1) {
      portalLinks = Array.from(document.querySelectorAll('a[href^="/auth/"]')).map((anchor) => anchor.getAttribute("href"));
      quoteArabic = document.querySelector(".auth-v2-calligraphy p, .auth-calligraphy-panel strong")?.textContent?.trim() || "";
      if (
        portalLinks.includes("/auth/student-login") &&
        portalLinks.includes("/auth/administration-login") &&
        quoteArabic
      ) break;
      await delay(50);
    }
    return {
      path: location.pathname,
      portalLinks,
      quoteArabic,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    };
  }`);
  await assertCheck(
    "auth gateway has separate student/admin links",
    gateway,
    value =>
      value?.portalLinks?.includes("/auth/student-login") &&
      value?.portalLinks?.includes("/auth/administration-login")
  );
  await assertCheck(
    "auth gateway has calligraphy inspiration",
    gateway,
    value => Boolean(value?.quoteArabic)
  );
  await assertCheck(
    "auth gateway desktop has no horizontal overflow",
    gateway,
    value => value?.overflow === 0
  );

  await runPw("resize", ["390", "844"]);
  await goto("/auth/login");
  const mobileGateway = await pageEval(`() => ({
    path: location.pathname,
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    width: document.documentElement.clientWidth
  })`);
  await assertCheck(
    "auth gateway mobile has no horizontal overflow",
    mobileGateway,
    value => value?.overflow === 0
  );
  await runPw("resize", ["1440", "1000"]);

  recordProgress("desktop portal routes");
  for (const role of selectedRoles) {
    recordProgress(`desktop role: ${role.role}`);
    assertRunBudget(`checking desktop role ${role.role}`);
    const loginOk = await authenticateRole(
      role,
      `${role.role} login API succeeds`
    );
    if (!loginOk) continue;

    await goto(role.dashboard);
    const dashboard = await pageEval(inspectSource(role.dashboard));
    await assertCheck(
      `${role.role} dashboard route is correct`,
      dashboard,
      value => value?.path === role.dashboard
    );
    await assertCheck(
      `${role.role} dashboard uses protected shell`,
      dashboard,
      value =>
        value?.shell === true &&
        value?.mainCount === 1 &&
        value?.skipTarget === "#platform-main-content" &&
        value?.currentNavCount === 1 &&
        value?.searchTrigger === true &&
        value?.searchClosed === true
    );
    await assertCheck(
      `${role.role} dashboard session provider matches login API`,
      dashboard,
      value =>
        Boolean(value?.provider) &&
        value.provider === authenticatedProviders.get(role.role)
    );
    await assertCheck(
      `${role.role} dashboard has contextual calligraphy quote`,
      dashboard,
      value =>
        Boolean(value?.quoteArabic && value?.quoteMeaning && value?.quoteSource)
    );
    await assertCheck(
      `${role.role} dashboard has no horizontal overflow`,
      dashboard,
      value =>
        value?.overflow <= 1 && (value?.overflowElements?.length ?? 0) === 0
    );
    await assertCheck(
      `${role.role} dashboard has no unlabeled visible controls`,
      dashboard,
      value => (value?.unlabeledControls?.length ?? 0) === 0
    );
    await assertCheck(
      `${role.role} dashboard has interactive controls`,
      dashboard,
      value => value?.visibleControls >= 8
    );

    const routeChecks = await runRouteMatrix(role.routes);
    await assertCheck(
      `${role.role} route matrix returned all routes`,
      routeChecks,
      value => Array.isArray(value) && value.length === role.routes.length
    );
    for (const routeCheck of Array.isArray(routeChecks) ? routeChecks : []) {
      const route = routeCheck.expectedPath;
      await assertCheck(
        `${route} renders protected content`,
        routeCheck,
        value =>
          value?.ready === true &&
          value?.path === route &&
          value?.shell === true &&
          value?.mainCount === 1 &&
          value?.skipTarget === "#platform-main-content" &&
          value?.currentNavCount === 1 &&
          value?.accessDenied === false &&
          value?.notFound === false &&
          value?.errorBoundary === false
      );
      await assertCheck(
        `${route} has no horizontal overflow`,
        routeCheck,
        value =>
          value?.overflow <= 1 && (value?.overflowElements?.length ?? 0) === 0
      );
      await assertCheck(
        `${route} has no unlabeled visible controls`,
        routeCheck,
        value => (value?.unlabeledControls?.length ?? 0) === 0
      );
      await assertCheck(
        `${route} has meaningful page content`,
        routeCheck,
        value =>
          value?.visibleControls >= 6 &&
          (value?.textLength > 500 ||
            (value?.textLength > 250 &&
              value?.accessDenied === false &&
              value?.notFound === false &&
              value?.errorBoundary === false))
      );
    }
  }

  recordProgress("deep workflows");
  if (!roleNameFilters.length) {
    for (const workflow of publicFormWorkflowCases) {
      await runPublicFormWorkflow(workflow);
    }
  }
  const selectedWorkflowCases = roleNameFilters.length
    ? deepWorkflowCases.filter(workflow =>
        selectedRoles.some(role => role.role === workflow.role)
      )
    : deepWorkflowCases;
  for (const workflow of selectedWorkflowCases) {
    await runDeepWorkflow(workflow);
  }
  if (
    !roleNameFilters.length ||
    selectedRoles.some(role => role.role === "student")
  ) {
    await runFormsRoleDenialChecks();
  }

  recordProgress("mobile portal routes");
  await runPw("resize", ["390", "844"]);
  for (const role of selectedRoles) {
    recordProgress(`mobile role: ${role.role}`);
    assertRunBudget(`checking mobile role ${role.role}`);
    const mobileLoginOk = await authenticateRole(
      role,
      `${role.role} mobile login API succeeds`
    );
    if (!mobileLoginOk) continue;
    await goto(role.dashboard);
    const mobile = await pageEval(inspectSource(role.dashboard));
    await assertCheck(
      `${role.role} mobile dashboard renders protected content`,
      mobile,
      value =>
        value?.path === role.dashboard &&
        value?.shell === true &&
        value?.mainCount === 1 &&
        value?.skipTarget === "#platform-main-content" &&
        value?.currentNavCount === 1 &&
        (value?.shellTinyControls?.length ?? 0) === 0 &&
        value?.accessDenied === false &&
        value?.errorBoundary === false
    );
    await assertCheck(
      `${role.role} mobile dashboard has no horizontal overflow`,
      mobile,
      value =>
        value?.overflow <= 1 && (value?.overflowElements?.length ?? 0) === 0
    );
    await assertCheck(
      `${role.role} mobile dashboard has no unlabeled visible controls`,
      mobile,
      value => (value?.unlabeledControls?.length ?? 0) === 0
    );

    const mobileRoutes = await runRouteMatrix(role.routes);
    await assertCheck(
      `${role.role} mobile route matrix returned all routes`,
      mobileRoutes,
      value => Array.isArray(value) && value.length === role.routes.length
    );
    for (const mobileRoute of Array.isArray(mobileRoutes) ? mobileRoutes : []) {
      const route = mobileRoute.expectedPath;
      await assertCheck(
        `${route} mobile renders protected content`,
        mobileRoute,
        value =>
          value?.ready === true &&
          value?.path === route &&
          value?.shell === true &&
          value?.mainCount === 1 &&
          value?.skipTarget === "#platform-main-content" &&
          value?.currentNavCount === 1 &&
          value?.accessDenied === false &&
          value?.notFound === false &&
          value?.errorBoundary === false
      );
      await assertCheck(
        `${route} mobile has no horizontal overflow`,
        mobileRoute,
        value =>
          value?.overflow <= 1 && (value?.overflowElements?.length ?? 0) === 0
      );
      await assertCheck(
        `${route} mobile has no unlabeled visible controls`,
        mobileRoute,
        value => (value?.unlabeledControls?.length ?? 0) === 0
      );
    }
  }
  await runPw("resize", ["1440", "1000"]);

  await assertNoUnexpectedBrowserConsoleErrors();
} catch (error) {
  if (error instanceof Error && error.message === "__QA_FILTER_COMPLETE__") {
    // Focused workflow mode completed successfully.
  } else {
    pushFatal("portal QA runner fatal error", error);
  }
} finally {
  writeSummary({ beforeBrowserClose: true });
  try {
    recordProgress("close browser");
    await runPw("close", [], {
      label: "close browser",
      timeoutMs: Math.min(commandTimeoutMs, 15000),
    });
  } catch (error) {
    // The browser may already be closed after a failed assertion.
    progressEvents.push({
      stage: "close browser failed",
      elapsedMs: elapsedMs(),
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
const summary = writeSummary({ inProgress: false });
console.log(
  JSON.stringify(
    {
      outputPath,
      totalChecks: checks.length,
      failedChecks: failures.length,
      failures,
    },
    null,
    2
  )
);
if (failures.length > 0) process.exit(1);
