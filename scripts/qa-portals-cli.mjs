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
const commandTimeoutMs = readPositiveIntegerEnv("QA_COMMAND_TIMEOUT_MS", 45000);
const routeReadyTimeoutMs = readPositiveIntegerEnv(
  "QA_ROUTE_READY_TIMEOUT_MS",
  5000
);
const routeMatrixRouteTimeoutMs = readPositiveIntegerEnv(
  "QA_ROUTE_MATRIX_ROUTE_TIMEOUT_MS",
  3000
);
const routeMatrixChunkSize = readPositiveIntegerEnv(
  "QA_ROUTE_MATRIX_CHUNK_SIZE",
  6
);
const workflowReadyTimeoutMs = readPositiveIntegerEnv(
  "QA_WORKFLOW_READY_TIMEOUT_MS",
  4000
);
const workflowActionTimeoutMs = readPositiveIntegerEnv(
  "QA_WORKFLOW_ACTION_TIMEOUT_MS",
  5000
);
const maxRunMs = readPositiveIntegerEnv(
  "QA_SUITE_TIMEOUT_MS",
  readPositiveIntegerEnv("QA_MAX_RUN_MS", 20 * 60 * 1000)
);
const workflowNameFilter =
  process.env.QA_ONLY_WORKFLOWS?.trim().toLowerCase() || "";
const pwcli =
  process.env.PWCLI ||
  path.join(
    os.homedir(),
    ".codex",
    "skills",
    "playwright",
    "scripts",
    "playwright_cli.sh"
  );
if (!fs.existsSync(pwcli)) {
  console.error(
    JSON.stringify(
      {
        error: "Playwright CLI wrapper is missing",
        pwcli,
        hint: "Set PWCLI to an executable browser automation runner before running portal QA.",
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
      "/app/student/assignments",
      "/app/student/quizzes",
      "/app/student/grades",
      "/app/student/attendance",
      "/app/student/calendar",
      "/app/student/messages",
      "/app/student/certificates",
      "/app/student/reports",
      "/app/student/support",
      "/app/student/profile",
      "/app/student/quran-progress",
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
      "/app/teacher/assignments",
      "/app/teacher/grading",
      "/app/teacher/quizzes",
      "/app/teacher/question-bank",
      "/app/teacher/calendar",
      "/app/teacher/messages",
      "/app/teacher/reports",
      "/app/teacher/profile",
      "/app/teacher/quran-review",
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
      "/app/registrar/students/stu_demo",
      "/app/registrar/placement-tests/pt_demo_1",
      "/app/registrar/leads",
      "/app/registrar/applications",
      "/app/registrar/students",
      "/app/registrar/placement-tests",
      "/app/registrar/enrollments",
      "/app/registrar/classes",
      "/app/registrar/schedule",
      "/app/registrar/payments",
      "/app/registrar/messages",
      "/app/registrar/reports",
      "/app/registrar/settings",
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
      "/app/hod/levels",
      "/app/hod/curriculum",
      "/app/hod/teachers",
      "/app/hod/classes",
      "/app/hod/schedule",
      "/app/hod/assessments",
      "/app/hod/certificates",
      "/app/hod/reports",
      "/app/hod/messages",
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
      "/app/branch/rooms",
      "/app/branch/schedule",
      "/app/branch/attendance",
      "/app/branch/payments",
      "/app/branch/reports",
      "/app/branch/messages",
      "/app/branch/settings",
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
      "/app/admin/moodle-source",
      "/app/admin/settings",
      "/app/admin/integrations",
      "/app/admin/audit-logs",
      "/app/admin/reports",
      "/app/admin/system-health",
      "/app/admin/platform-blueprint",
    ],
  },
];

const authRoutes = [
  "/auth/login",
  "/auth/student-login",
  "/auth/administration-login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/select-role",
  "/auth/logout",
];

const failures = [];
const checks = [];
const platformStorageKey = "nilelearn.platform.state.v1";
const platformStateUpdatedEvent = "nilelearn:platform-state-updated";
const outputDir = path.resolve(
  process.env.QA_OUTPUT_DIR || path.join(process.cwd(), "output", "playwright")
);
const outputPath = path.join(outputDir, "portal-qa-summary.json");
const startedAt = Date.now();
const progressEvents = [];
const authenticatedProviders = new Map();
let lastBrowserCommand = null;
let summaryWritten = false;
let activeChild = null;
let activeKillTree = null;

function elapsedMs() {
  return Date.now() - startedAt;
}

function writeSummary(extra = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    elapsedMs: elapsedMs(),
    lastBrowserCommand,
    totalChecks: checks.length,
    failedChecks: failures.length,
    progressEvents,
    failures,
    checks,
    ...extra,
  };
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  summaryWritten = true;
  return summary;
}

function recordProgress(stage, details = {}) {
  const event = { stage, elapsedMs: elapsedMs(), ...details };
  progressEvents.push(event);
  const seconds = Math.round(event.elapsedMs / 1000);
  const suffix = lastBrowserCommand?.label
    ? ` last="${lastBrowserCommand.label}"`
    : "";
  console.error(
    `[portal-qa ${seconds}s] ${stage} checks=${checks.length} failures=${failures.length}${suffix}`
  );
  writeSummary({ inProgress: true });
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
  const child = spawn(pwcli, ["-s", session, command, ...args], {
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
  lastBrowserCommand = {
    command,
    label,
    timeoutMs,
    durationMs,
    timedOut,
    killEscalated,
    pid: child.pid,
  };
  if (timedOut) {
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
  checks.push({ name, ok, actual, ...details });
  if (!ok) failures.push({ name, actual, ...details });
  return ok;
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
    const chunkResult = await pageEval(inspectRouteMatrixSource(routeChunk), {
      label: `route matrix ${routeChunk[0]} ... ${routeChunk[routeChunk.length - 1]}`,
      timeoutMs: routeMatrixTimeout(routeChunk.length),
    });
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
    const quoteArabic = document.querySelector(".auth-calligraphy-panel strong, .auth-flow-calligraphy strong")?.textContent?.trim() || "";
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
        unlabeledControls,
        overflowElements,
        accessDenied: text.includes("Access denied"),
        notFound: text.includes("Page not found"),
        errorBoundary: text.includes("Something went wrong")
      };
    };
    const waitForRoute = async (route) => {
      const previousContent = normalize(document.querySelector(".platform-content")?.textContent || "");
      const started = performance.now();
      while (performance.now() - started < routeTimeoutMs) {
        const text = normalize(document.body.innerText || document.body.textContent);
        const contentText = normalize(document.querySelector(".platform-content")?.textContent || "");
        const loading = document.querySelector(".platform-route-loading");
        const changed = contentText !== previousContent;
        const settled = performance.now() - started > 700;
        if (
          location.pathname === route &&
          document.querySelector(".platform-shell") &&
          !text.includes("Loading workspace") &&
          contentText.length > 80 &&
          !loading &&
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
      await delay(80);
      results.push({ ...inspect(route), ready });
    }
    return results;
  }`;
}

function loginSource(role) {
  return `async () => {
    localStorage.clear();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
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
    return { ok: true, status: response.status, provider: payload?.provider, activeRole: payload?.activeRole };
  }`;
}

function resetPlatformStateSource() {
  return `() => {
    localStorage.removeItem(${JSON.stringify(platformStorageKey)});
    return true;
  }`;
}

function workflowSetupSource(body) {
  return `async () => {
    const STORAGE_KEY = ${JSON.stringify(platformStorageKey)};
    const readState = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const writeState = (state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new Event(${JSON.stringify(platformStateUpdatedEvent)}));
    };
    try {
      ${body}
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }`;
}

function workflowActionSource(body) {
  return `async () => {
    const STORAGE_KEY = ${JSON.stringify(platformStorageKey)};
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const readState = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const writeState = (state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new Event(${JSON.stringify(platformStateUpdatedEvent)}));
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
      const match = Array.from(document.querySelectorAll("label"))
        .find((item) => normalize(item.textContent).toLowerCase().includes(expected));
      const control = match?.querySelector("input, select, textarea");
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
    }
  }`;
}

function routeReadySource(expectedPath) {
  return `async () => {
    const timeoutMs = ${JSON.stringify(routeReadyTimeoutMs)};
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      const loading = document.querySelector("main.platform-route-loading");
      const shell = document.querySelector(".platform-shell");
      const content = document.querySelector(".platform-content");
      const accessDenied = normalize(document.body.innerText || document.body.textContent).includes("Access denied");
      if (location.pathname === ${JSON.stringify(expectedPath)} && !loading && (shell || accessDenied) && content) {
        return { ok: true, path: location.pathname, shell: Boolean(shell), content: Boolean(content) };
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
  await goto(role.loginPath);
  const loginResult = await pageEval(loginSource(role), {
    label: `login ${role.role}`,
    timeoutMs: Math.min(commandTimeoutMs, 15000),
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

async function navigateToProtectedRoute(role, route, checkName, details = {}) {
  assertRunBudget(`navigating ${route}`);
  await goto(route);
  const routeReady = await pageEval(routeReadySource(route));
  const ok = await assertCheck(checkName, routeReady, value => value?.ok, {
    role: role.role,
    route,
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

  const loginOk = await authenticateRole(role, `${name} login`, {
    route,
    deepWorkflow: true,
  });
  if (!loginOk) return;

  await pageEval(resetPlatformStateSource());
  const { ok: routeReadyOk } = await navigateToProtectedRoute(
    role,
    route,
    `${name} route ready`,
    {
      deepWorkflow: true,
    }
  );
  if (!routeReadyOk) return;

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
        }
      );
      if (!routeReadyAfterSetupOk) return;
    }
  }

  const result = await pageEval(source);
  await assertCheck(name, result, predicate, {
    role: role.role,
    route,
    deepWorkflow: true,
  });
}

const deepWorkflowCases = [
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
      setValue(document.querySelector('input[aria-label="Global search"]'), "Grammar worksheet");
      await waitFor(() => document.querySelector(".platform-search-results button"));
      await clickButton("Grammar worksheet");
      const navigatedPath = await waitFor(() => location.pathname.includes("/app/student/assignments/asg_ar_grammar") ? location.pathname : null);
      return {
        ok: Boolean(storedBranch === "Online" && navigatedPath && state),
        storedBranch,
        navigatedPath,
        unread: state?.notifications?.filter((item) => item.userId === "usr_student_demo" && !item.read).length
      };
    `),
    predicate: value =>
      value?.ok && value?.storedBranch === "Online" && value?.unread === 0,
  },
  {
    name: "student learning workflow completes next lesson and persists progress",
    role: "student",
    route: "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
    setupSource: workflowSetupSource(`
      const state = readState();
      const progress = state.lessonProgress?.find((item) => item.lessonId === "lesson_ar_conditional" && item.studentId === "stu_demo");
      if (progress) {
        progress.status = "in_progress";
        delete progress.completedAt;
      } else {
        state.lessonProgress = state.lessonProgress || [];
        state.lessonProgress.push({
          id: "lp_ar_conditional_qa",
          studentId: "stu_demo",
          lessonId: "lesson_ar_conditional",
          status: "in_progress",
          notes: "QA deterministic setup."
        });
      }
      const enrollment = state.enrollments?.find((item) => item.id === "enr_ar_l3");
      if (enrollment) enrollment.progress = 68;
      state.auditLogs = (state.auditLogs || []).filter((item) => item.action !== "lesson.completed" || item.entityId !== "lesson_ar_conditional");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await waitFor(() => !document.querySelector(".learning-sync-pill.loading"), 5000);
      const before = readState();
      const progress = before.lessonProgress?.find((item) => item.lessonId === "lesson_ar_conditional" && item.studentId === "stu_demo");
      if (progress) {
        progress.status = "in_progress";
        delete progress.completedAt;
      } else {
        before.lessonProgress = before.lessonProgress || [];
        before.lessonProgress.push({
          id: "lp_ar_conditional_qa",
          studentId: "stu_demo",
          lessonId: "lesson_ar_conditional",
          status: "in_progress",
          notes: "QA deterministic setup."
        });
      }
      const enrollment = before.enrollments?.find((item) => item.id === "enr_ar_l3");
      if (enrollment) enrollment.progress = 68;
      before.auditLogs = (before.auditLogs || []).filter((item) => item.action !== "lesson.completed" || item.entityId !== "lesson_ar_conditional");
      writeState(before);
      await waitFor(() => {
        const actions = document.querySelector(".learning-player-actions");
        return Array.from(actions?.querySelectorAll("button") || []).some((button) => visible(button) && !button.disabled && normalize(button.textContent).includes("Mark complete"));
      });
      const beforeProgress = before.enrollments?.find((item) => item.id === "enr_ar_l3")?.progress ?? 0;
      await clickButtonWithin(".learning-player-actions", "Mark complete");
      const after = await waitFor(() => {
        const state = readState();
        const progress = state.enrollments?.find((item) => item.id === "enr_ar_l3")?.progress ?? 0;
        const completed = state.lessonProgress?.some((item) => item.lessonId === "lesson_ar_conditional" && item.status === "completed");
        return progress > beforeProgress && completed ? state : null;
      });
      return {
        ok: Boolean(after),
        beforeProgress,
        afterProgress: after?.enrollments?.find((item) => item.id === "enr_ar_l3")?.progress,
        lessonAudit: after?.auditLogs?.find((item) => item.action === "lesson.completed" && item.entityId === "lesson_ar_conditional")?.action
      };
    `),
    predicate: value =>
      value?.ok && value?.afterProgress > value?.beforeProgress,
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
      setValue(document.querySelector(".platform-workflow-card textarea"), response);
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card", "Submit assignment");
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
    setupSource: workflowSetupSource(`
      const state = readState();
      state.quizAttempts = (state.quizAttempts || []).filter((item) => item.quizId !== "quiz_ar_3");
      state.grades = (state.grades || []).filter((item) => item.itemId !== "quiz_ar_3");
      writeState(state);
      return { ok: true };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      const prepared = readState();
      prepared.quizAttempts = (prepared.quizAttempts || []).filter((item) => item.quizId !== "quiz_ar_3");
      prepared.grades = (prepared.grades || []).filter((item) => item.itemId !== "quiz_ar_3");
      writeState(prepared);
      await delay(120);
      const before = readState();
      const beforeAttempts = before.quizAttempts?.length ?? 0;
      await answerQuizQuestions();
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card:nth-of-type(2)", "Submit attempt");
      const state = await waitFor(() => {
        const next = readState();
        const attempt = next.quizAttempts?.find((item) => item.quizId === "quiz_ar_3");
        const grade = next.grades?.find((item) => item.itemId === "quiz_ar_3");
        return attempt?.status === "pending" && !grade && (next.quizAttempts?.length ?? 0) >= beforeAttempts ? next : null;
      });
      const attempt = state?.quizAttempts?.find((item) => item.quizId === "quiz_ar_3");
      const grade = state?.grades?.find((item) => item.itemId === "quiz_ar_3");
      return {
        ok: Boolean(state),
        beforeAttempts,
        afterAttempts: state?.quizAttempts?.length,
        afterGrades: state?.grades?.length,
        attemptQuizId: attempt?.quizId,
        attemptStatus: attempt?.status,
        gradeItemId: grade?.itemId,
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
      const prepared = readState();
      prepared.assignmentSubmissions = (prepared.assignmentSubmissions || []).filter((item) => item.assignmentId !== "asg_qt_audio");
      writeState(prepared);
      await delay(120);
      const response = "QA audio route response " + Date.now();
      await waitFor(() => normalize(document.body.textContent).includes("Audio recitation"));
      setValue(document.querySelector(".platform-workflow-card textarea"), response);
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card", "Submit assignment");
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
      const prepared = readState();
      prepared.quizAttempts = (prepared.quizAttempts || []).filter((item) => item.quizId !== "quiz_qt_madd");
      prepared.grades = (prepared.grades || []).filter((item) => item.itemId !== "quiz_qt_madd");
      writeState(prepared);
      await delay(120);
      const before = readState();
      await answerQuizQuestions();
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card:nth-of-type(2)", "Submit attempt");
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
      const before = readState();
      const attendanceButtons = controlLabels();
      const attendanceText = normalize(document.body.textContent);
      const forbiddenAttendanceControls = attendanceButtons.filter((label) => /^(save attendance|mark all present|mark all late|mark all absent|mark all excused|present|late|absent|excused)$/i.test(label));
      const afterAttendance = readState();
      await goto("/app/student/certificates");
      await waitFor(() => location.pathname === "/app/student/certificates" && normalize(document.body.textContent).includes("Certificate wallet"));
      const certificateButtons = controlLabels();
      const forbiddenCertificateControls = certificateButtons.filter((label) => /^(approve|approved|issue|issued)$/i.test(label));
      return {
        ok: true,
        attendanceReadOnlyRendered: attendanceText.includes("Attendance record") && attendanceText.includes("Request review"),
        forbiddenAttendanceControls,
        attendanceCountUnchanged: (before.attendance?.length ?? 0) === (afterAttendance.attendance?.length ?? 0),
        auditCountUnchanged: (before.auditLogs?.length ?? 0) === (afterAttendance.auditLogs?.length ?? 0),
        forbiddenCertificateControls,
        certificateText: normalize(document.body.textContent)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attendanceReadOnlyRendered === true &&
      (value?.forbiddenAttendanceControls?.length ?? 0) === 0 &&
      value?.attendanceCountUnchanged === true &&
      value?.auditCountUnchanged === true &&
      (value?.forbiddenCertificateControls?.length ?? 0) === 0 &&
      value?.certificateText?.includes("Certificate wallet"),
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
      setByLabel("Recitation title", title);
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card", "Submit recitation");
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
      const options = Array.from(document.querySelectorAll("select option")).map((option) => option.value);
      const subject = "QA student message " + Date.now();
      setValue(document.querySelectorAll(".platform-inline-form input")[0], subject);
      setValue(document.querySelector("textarea"), "Student scoped message body");
      await clickButton("Send message");
      const state = await waitFor(() => {
        const next = readState();
        return next.messages?.[0]?.subject === subject ? next : null;
      });
      return {
        ok: Boolean(state),
        fromUserId: state?.messages?.[0]?.fromUserId,
        toUserId: state?.messages?.[0]?.toUserId,
        hasSelfRecipient: options.includes("usr_student_demo")
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_student_demo" &&
      value?.toUserId !== "usr_student_demo" &&
      value?.hasSelfRecipient === false,
  },
  {
    name: "student reports render personal rows without platform report selector",
    role: "student",
    route: "/app/student/reports",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Student report"));
      const text = normalize(document.body.textContent);
      return {
        ok: text.includes("Standard Arabic Level 3") && text.includes("Export my CSV"),
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
      const teacherSessionSelect = document.querySelectorAll(".platform-attendance-control-grid select")[2];
      if (teacherSessionSelect) setValue(teacherSessionSelect, "session_ar_live");
      await waitFor(() => Array.from(document.querySelectorAll(".platform-attendance-grid button")).some((button) => normalize(button.getAttribute("title")).toLowerCase() === "late"));
      const lateButton = await waitFor(() =>
        Array.from(document.querySelectorAll(".platform-attendance-grid button"))
          .find((button) => visible(button) && !button.disabled && normalize(button.getAttribute("title")).toLowerCase() === "late")
      );
      if (!lateButton) throw new Error("Late attendance status button not found");
      lateButton.click();
      const note = "QA attendance note " + Date.now();
      const noteInput = await waitFor(() => document.querySelector(".platform-attendance-note-input"));
      if (!noteInput || noteInput.disabled) throw new Error("Attendance note input not found");
      setValue(noteInput, note);
      await delay(90);
      await waitFor(() => Array.from(document.querySelectorAll(".platform-attendance-grid button.active")).some((button) => normalize(button.getAttribute("title")).toLowerCase() === "late"));
      await clickButtonWithin(".platform-workflow-card", "Save attendance");
      const state = await waitFor(() => {
        const next = readState();
        const saved = next.classSessions?.find((item) => item.id === "session_ar_live")?.attendanceSaved;
        const record = next.attendance?.find((item) => item.sessionId === "session_ar_live" && item.studentId === "stu_demo");
        return saved && record?.status === "late" && record?.notes === note ? next : null;
      });
      const fallback = readState();
      return {
        ok: Boolean(state),
        attendanceSaved: (state || fallback)?.classSessions?.find((item) => item.id === "session_ar_live")?.attendanceSaved,
        status: (state || fallback)?.attendance?.find((item) => item.sessionId === "session_ar_live" && item.studentId === "stu_demo")?.status,
        note: (state || fallback)?.attendance?.find((item) => item.sessionId === "session_ar_live" && item.studentId === "stu_demo")?.notes,
        records: (state || fallback)?.attendance?.map((item) => ({ sessionId: item.sessionId, status: item.status })).slice(0, 4),
        lastAudit: (state || fallback)?.auditLogs?.[0]?.action,
        auditActorId: (state || fallback)?.auditLogs?.[0]?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attendanceSaved === true &&
      value?.status === "late" &&
      value?.note?.startsWith("QA attendance note"),
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
      await waitFor(() => normalize(document.body.textContent).includes("Manual review") && normalize(document.body.textContent).includes("Draft answer saved locally"));
      const feedback = "QA grading feedback " + Date.now();
      const reviewCard = Array.from(document.querySelectorAll(".platform-workflow-card"))
        .find((card) => normalize(card.textContent).includes("Manual review"));
      const submissionRow = Array.from(reviewCard?.querySelectorAll(".platform-row-list article") || [])
        .find((article) => normalize(article.textContent).includes("Grammar worksheet"));
      const submissionOpen = submissionRow?.querySelector("button");
      if (submissionOpen && visible(submissionOpen) && !submissionOpen.disabled) {
        submissionOpen.click();
        await delay(120);
      }
      const inputs = Array.from(reviewCard?.querySelectorAll("input") || []);
      const scoreInput = inputs.find((input) => input.type === "number");
      const feedbackInput = inputs.find((input) => input.type !== "number");
      setValue(scoreInput, "91");
      setValue(feedbackInput, feedback);
      const gradeButton = Array.from(reviewCard?.querySelectorAll("button") || [])
        .find((button) => visible(button) && !button.disabled && normalize(button.textContent).toLowerCase().includes("grade submission"));
      if (!gradeButton) throw new Error("Grade submission button not found");
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
        const body = normalize(document.body.textContent);
        return body.includes("Gradebook") && body.includes("QA visible learner feedback") && body.includes("92/100") ? body : null;
      });
      return {
        ok: Boolean(text),
        hasFeedbackList: text?.includes("Assignment feedback"),
        hasScore: text?.includes("92/100"),
        hasGradebook: text?.includes("Gradebook")
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
    route: "/app/teacher/grading",
    setupSource: workflowSetupSource(`
      const state = readState();
      const attempt = state.quizAttempts?.find((item) => item.id === "attempt_ar_3_demo");
      state.quizAttempts = attempt
        ? [
            { ...attempt, status: "pending", score: 0 },
            ...(state.quizAttempts || []).filter((item) => item.id !== "attempt_ar_3_demo"),
          ]
        : (state.quizAttempts || []);
      state.grades = (state.grades || []).filter((item) => item.itemId !== "quiz_ar_3");
      writeState(state);
      return { ok: Boolean(attempt), attemptId: attempt?.id };
    `),
    reloadAfterSetup: false,
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Quiz review") && normalize(document.body.textContent).includes("Grammar Quiz 3"));
      const feedback = "QA quiz review " + Date.now();
      const quizCard = Array.from(document.querySelectorAll(".platform-workflow-card"))
        .find((card) => normalize(card.textContent).includes("Quiz review"));
      const attemptRow = Array.from(quizCard?.querySelectorAll(".platform-row-list article") || [])
        .find((article) => normalize(article.textContent).includes("Grammar Quiz 3"));
      const attemptOpen = attemptRow?.querySelector("button");
      if (attemptOpen && visible(attemptOpen) && !attemptOpen.disabled) {
        attemptOpen.click();
        await delay(120);
      }
      const inputs = Array.from(quizCard?.querySelectorAll("input") || []);
      const scoreInput = inputs.find((input) => input.type === "number");
      const feedbackInput = inputs.find((input) => input.type !== "number");
      setValue(scoreInput, "93");
      setValue(feedbackInput, feedback);
      const reviewButton = Array.from(quizCard?.querySelectorAll("button") || [])
        .find((button) => visible(button) && !button.disabled && normalize(button.textContent).toLowerCase().includes("save quiz review"));
      if (!reviewButton) throw new Error("Save quiz review button not found");
      reviewButton.click();
      await delay(140);
      const state = await waitFor(() => {
        const next = readState();
        const attempt = next.quizAttempts?.find((item) => item.quizId === "quiz_ar_3" && item.score === 93);
        const grade = next.grades?.find((item) => item.itemId === "quiz_ar_3" && item.feedback === feedback);
        return attempt?.status === "completed" && grade ? next : null;
      });
      const fallback = readState();
      const attempt = (state || fallback)?.quizAttempts?.find((item) => item.quizId === "quiz_ar_3" && item.score === 93);
      const grade = (state || fallback)?.grades?.find((item) => item.itemId === "quiz_ar_3" && item.feedback === feedback);
      return {
        ok: Boolean(state),
        attemptStatus: attempt?.status,
        attemptScore: attempt?.score,
        gradeScore: grade?.score,
        gradeFeedback: grade?.feedback
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attemptStatus === "completed" &&
      value?.attemptScore === 93 &&
      value?.gradeScore === 93 &&
      value?.gradeFeedback?.startsWith("QA quiz review"),
  },
  {
    name: "branch dashboard renders scoped operations command center",
    role: "branchadmin",
    route: "/app/branch/dashboard",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Cairo B1 operations"));
      const text = normalize(document.body.textContent);
      return {
        ok: text.includes("Assigned branch") &&
          text.includes("Schedule control") &&
          text.includes("Room usage") &&
          text.includes("Attendance exceptions") &&
          text.includes("Branch payments") &&
          text.includes("Branch evidence"),
        hasBranchScope: text.includes("Cairo B1") && text.includes("Cairo branch"),
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
      const branchSessionSelect = document.querySelectorAll(".platform-attendance-control-grid select")[2];
      if (branchSessionSelect) setValue(branchSessionSelect, "session_ar_cairo_live");
      await waitFor(() => Array.from(document.querySelectorAll(".platform-attendance-grid button")).some((button) => normalize(button.getAttribute("title")).toLowerCase() === "absent"));
      const absentButton = await waitFor(() =>
        Array.from(document.querySelectorAll(".platform-attendance-grid button"))
          .find((button) => visible(button) && !button.disabled && normalize(button.getAttribute("title")).toLowerCase() === "absent")
      );
      if (!absentButton) throw new Error("Absent attendance status button not found");
      absentButton.click();
      await delay(90);
      await waitFor(() => Array.from(document.querySelectorAll(".platform-attendance-grid button.active")).some((button) => normalize(button.getAttribute("title")).toLowerCase() === "absent"));
      await clickButtonWithin(".platform-workflow-card", "Save attendance");
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
      if (!state.courseRuns.some((item) => item.id === "run_ar_l3_cairo_qa")) {
        state.courseRuns.push({
          id: "run_ar_l3_cairo_qa",
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
      if (!state.classGroups.some((item) => item.id === "class_ar_l3_cairo_qa")) {
        state.classGroups.push({
          id: "class_ar_l3_cairo_qa",
          courseRunId: "run_ar_l3_cairo_qa",
          name: "Arabic L3 - Cairo QA",
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
      await waitFor(() => normalize(document.body.textContent).includes("Arabic L3 - Cairo QA"), 4000);
      const title = "QA review session " + Date.now();
      setByLabel("Title", title);
      setByLabel("Date", "2026-07-03");
      setByLabel("Starts", "14:00");
      setByLabel("Ends", "14:45");
      await clickButton("Create event");
      const state = await waitFor(() => {
        const next = readState();
        return next.events?.[0]?.title === title ? next : null;
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
      await waitFor(() => normalize(document.body.textContent).includes("Arabic L3 - Group A"));
      const title = "QA teacher live session " + Date.now();
      setByLabel("Title", title);
      setByLabel("Type", "live_session");
      setByLabel("Branch", "br_online");
      setByLabel("Class", "class_ar_l3_a");
      setByLabel("Room", "room_online_a");
      setByLabel("Date", "2026-07-06");
      setByLabel("Starts", "11:00");
      setByLabel("Ends", "11:45");
      await clickButton("Create event");
      const state = await waitFor(() => {
        const next = readState();
        return next.events?.some((item) => item.title === title && item.type === "live_session") ? next : null;
      });
      const event = state?.events?.find((item) => item.title === title);
      const session = state?.classSessions?.find((item) => item.eventId === event?.id || item.title === title);
      const classGroup = state?.classGroups?.find((item) => item.id === event?.classGroupId);
      const courseRun = state?.courseRuns?.find((item) => item.id === classGroup?.courseRunId);
      const actor = state?.users?.find((item) => item.id === "usr_teacher_demo");
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
        lastAudit: state?.auditLogs?.[0]?.action
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
      await waitFor(() => normalize(document.body.textContent).includes("Placement test"));
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
      value?.toUserId !== "usr_branch_demo" &&
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
      const options = Array.from(document.querySelectorAll(".platform-report-controls select option")).map((option) => normalize(option.textContent));
      return {
        ok: text.includes("Report type") && text.includes("Export CSV") && text.includes("Saved views"),
        hasReportTypeSelector: Boolean(document.querySelector(".platform-report-controls select")),
        hasActivityOption: options.includes("Activity"),
        hasFinanceOption: options.includes("Finance"),
        hasSeededBranchPreset: text.includes("Cairo attendance exceptions"),
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
      value?.hasSeededBranchPreset === true &&
      value?.hasTypedRows === true &&
      value?.hasSortHeader === true,
  },
  {
    name: "HOD curriculum workflow creates server-backed module",
    role: "headofdepartment",
    route: "/app/hod/curriculum",
    source: workflowActionSource(`
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
    name: "HOD course catalog workflow updates scoped course status",
    role: "headofdepartment",
    route: "/app/hod/courses",
    source: workflowActionSource(`
      setByLabel("Course status", "paused");
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
      const title = "QA HOD assessment " + Date.now();
      setByLabel("Assignment title", title);
      setByLabel("Submission", "text");
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
      await waitFor(() => normalize(document.body.textContent).includes("Manual review") && normalize(document.body.textContent).includes("Draft answer saved locally"));
      const feedback = "QA HOD grading feedback " + Date.now();
      const reviewCard = Array.from(document.querySelectorAll(".platform-workflow-card"))
        .find((card) => normalize(card.textContent).includes("Manual review"));
      const submissionRow = Array.from(reviewCard?.querySelectorAll(".platform-row-list article") || [])
        .find((article) => normalize(article.textContent).includes("Grammar worksheet"));
      const submissionOpen = submissionRow?.querySelector("button");
      if (submissionOpen && visible(submissionOpen) && !submissionOpen.disabled) {
        submissionOpen.click();
        await delay(120);
      }
      const inputs = Array.from(reviewCard?.querySelectorAll("input") || []);
      const scoreInput = inputs.find((input) => input.type === "number");
      const feedbackInput = inputs.find((input) => input.type !== "number");
      setValue(scoreInput, "89");
      setValue(feedbackInput, feedback);
      const gradeButton = Array.from(reviewCard?.querySelectorAll("button") || [])
        .find((button) => visible(button) && !button.disabled && normalize(button.textContent).toLowerCase().includes("grade submission"));
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
      const prepared = readState();
      prepared.certificates = (prepared.certificates || []).map((item) =>
        item.id === "cert_ar_2"
          ? { ...item, status: "pending_approval", approvedBy: undefined, approvedAt: undefined, issuedBy: undefined, issuedAt: undefined }
          : item
      );
      prepared.auditLogs = (prepared.auditLogs || []).filter((item) => item.entityId !== "cert_ar_2");
      writeState(prepared);
      await delay(120);
      await waitFor(() => normalize(document.body.textContent).includes("NCL-AR2-DEMO"));
      const existing = readState().certificates?.find((item) => item.id === "cert_ar_2");
      if (existing?.status === "issued") {
        return { ok: true, status: "issued", alreadyIssued: true };
      }
      await clickButton("Approve", true);
      await waitFor(() => {
        const certificate = readState().certificates?.find((item) => item.id === "cert_ar_2");
        if (certificate?.status === "issued") return true;
        return Array.from(document.querySelectorAll("button")).some((button) => visible(button) && !button.disabled && /^issue$/i.test(normalize(button.textContent)));
      });
      const approved = readState().certificates?.find((item) => item.id === "cert_ar_2");
      if (approved?.status !== "issued") {
        await clickButton("Issue", true);
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
      await waitFor(() => normalize(document.body.textContent).includes("NCL-AR-REJECT-QA"));
      setByLabel("Reject reason", "QA eligibility evidence incomplete");
      await clickButton("Reject", true);
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
      value?.hasActivityOption === true &&
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
      await waitFor(() => normalize(document.body.textContent).includes("Surah Al-Baqarah 24-29"));
      const recDemoRow = Array.from(document.querySelectorAll(".platform-row-list article"))
        .find((article) => normalize(article.textContent).includes("Surah Al-Baqarah 24-29"));
      const recDemoOpen = recDemoRow?.querySelector("button");
      if (recDemoOpen && visible(recDemoOpen) && !recDemoOpen.disabled) {
        recDemoOpen.click();
        await delay(160);
      }
      const inputs = Array.from(document.querySelectorAll('.platform-workflow-card input[type="number"]'));
      setValue(inputs[0], "91");
      setValue(inputs[1], "94");
      setValue(document.querySelector(".platform-workflow-card textarea"), "QA tajweed review accepted.");
      await delay(140);
      const clickReviewCardButton = async (label) => {
        const expected = normalize(label).toLowerCase();
        const reviewCard = Array.from(document.querySelectorAll(".platform-workflow-card"))
          .find((card) => normalize(card.textContent).includes("Memorization and tajweed"));
        const button = Array.from(reviewCard?.querySelectorAll("button") || [])
          .find((item) => visible(item) && !item.disabled && normalize(item.textContent).toLowerCase().includes(expected));
        if (!button) throw new Error("Review card button not found: " + label);
        button.click();
        await delay(120);
      };
      await clickReviewCardButton("Update progress");
      await waitFor(() => readState().quranProgress?.[0]?.memorizedPercent === 91);
      await clickReviewCardButton("Review recitation");
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
      const subject = "QA class update " + Date.now();
      setByLabel("Subject", subject);
      setValue(document.querySelector(".platform-workflow-card textarea"), "QA message body for connected workflow.");
      await clickButton("Send message");
      const state = await waitFor(() => {
        const next = readState();
        return next.messages?.[0]?.subject === subject && next.communicationLogs?.[0]?.subject === subject ? next : null;
      });
      return {
        ok: Boolean(state),
        messageSubject: state?.messages?.[0]?.subject,
        logSubject: state?.communicationLogs?.[0]?.subject,
        notification: state?.notifications?.find((item) => item.title === subject)?.title
      };
    `),
    predicate: value =>
      value?.ok && value?.messageSubject === value?.logSubject,
  },
  {
    name: "registrar lead intake creates server-backed lead",
    role: "registrar",
    route: "/app/registrar/leads",
    source: workflowActionSource(`
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
      const form = await waitFor(() => document.querySelector(".registrar-application-form"));
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
      const link = await waitFor(() =>
        Array.from(document.querySelectorAll(".registrar-application-list a"))
          .find((item) => item.getAttribute("href") === "/app/registrar/applications/" + application?.id)
      );
      link?.click();
      await waitFor(() => normalize(document.body.textContent).includes("Application lifecycle") && normalize(document.body.textContent).includes(fullName), 5000);
      return {
        ok: Boolean(state),
        leadStatus: lead?.status,
        applicationStatus: application?.status,
        branchId: application?.branchId,
        courseInterest: application?.courseInterest,
        communicationLogged: state?.communicationLogs?.some((item) => item.subject === "Application intake" && normalize(item.body).includes(fullName)),
        detailOpened: normalize(document.body.textContent).includes("Application lifecycle"),
        lastAudit: state?.auditLogs?.[0]?.action
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
      value?.lastAudit === "application.created",
  },
  {
    name: "registrar finance workflow records payment and settles invoice",
    role: "registrar",
    route: "/app/registrar/payments",
    source: workflowActionSource(`
      await waitFor(() => document.querySelector(".registrar-payment-desk") && document.querySelector(".registrar-payment-table"));
      const beforeRows = Array.from(document.querySelectorAll(".registrar-payment-row")).length;
      const search = document.querySelector(".registrar-payment-toolbar input");
      if (search) setValue(search, "inv_demo_1");
      await waitFor(() => Array.from(document.querySelectorAll(".registrar-payment-row")).length === 1);
      const filteredRows = Array.from(document.querySelectorAll(".registrar-payment-row")).length;
      const before = readState();
      const beforePaid = before.payments?.filter((item) => item.status === "paid").length ?? 0;
      const beforeInvoicePaid = before.payments?.filter((item) => item.invoiceId === "inv_demo_1" && item.status === "paid").length ?? 0;
      const row = Array.from(document.querySelectorAll(".registrar-payment-row"))
        .find((item) => normalize(item.textContent).includes("inv_demo_1"));
      const button = row ? Array.from(row.querySelectorAll("button")).find((item) => normalize(item.textContent).toLowerCase().includes("record payment")) : null;
      if (!button || button.disabled) return { ok: false, hasPaymentDesk: true, hasLedger: true, beforeRows, filteredRows, beforePaid, beforeInvoicePaid, reason: "record button unavailable" };
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
        hasPaymentDesk: Boolean(document.querySelector(".registrar-payment-desk")),
        hasLedger: Boolean(document.querySelector(".registrar-payment-table")),
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
      value?.hasPaymentDesk === true &&
      value?.hasLedger === true &&
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
      await waitFor(() => document.querySelector(".registrar-payment-desk") && document.querySelector(".registrar-payment-table"));
      const visiblePageText = () => normalize(document.body.innerText || document.body.textContent);
      const renderedSeed = await waitFor(() => visiblePageText().includes("inv_cairo_demo_1"), 4000);
      if (!renderedSeed) {
        return {
          ok: false,
          reason: "partial invoice did not render before filtering",
          body: visiblePageText().slice(0, 700),
          invoiceInState: readState().invoices?.some((item) => item.id === "inv_cairo_demo_1")
        };
      }
      const search = document.querySelector(".registrar-payment-toolbar input");
      setValue(search, "inv_cairo_demo_1");
      const row = await waitFor(() =>
        Array.from(document.querySelectorAll(".registrar-payment-row"))
          .find((item) => normalize(item.textContent).includes("inv_cairo_demo_1"))
      );
      if (!row) return { ok: false, reason: "partial invoice row not found" };
      setValue(row.querySelector(".registrar-payment-amount-input"), "250");
      const method = row.querySelector(".registrar-payment-record-fields select");
      setValue(method, "cash");
      const reference = Array.from(row.querySelectorAll(".registrar-payment-record-fields input"))
        .find((input) => !input.classList.contains("registrar-payment-amount-input"));
      setValue(reference, "CASH-PARTIAL-QA");
      const before = readState();
      const beforeInvoice = before.invoices?.find((item) => item.id === "inv_cairo_demo_1");
      const beforeBalance = beforeInvoice ? beforeInvoice.amount - (before.payments || []).filter((item) => item.invoiceId === beforeInvoice.id && item.status === "paid").reduce((sum, item) => sum + item.amount, 0) : null;
      const button = Array.from(row.querySelectorAll("button"))
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
      const fullName = "QA Convert Lead " + Date.now();
      setByLabel("Full name", fullName);
      setByLabel("Phone", "+20 100 000 0999");
      setByLabel("Email", "qa.convert." + Date.now() + "@nilelearn.local");
      setByLabel("Subject", "Arabic Language");
      setByLabel("Notes", "Generated by workflow QA.");
      await clickButton("Add lead");
      await waitFor(() => readState().leads?.some((item) => item.fullName === fullName));
      const row = Array.from(document.querySelectorAll(".registrar-lead-list article"))
        .find((item) => normalize(item.textContent).includes(fullName));
      const button = row ? Array.from(row.querySelectorAll("button")).find((item) => normalize(item.textContent) === "Convert" && !item.disabled) : null;
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
        return next.placementTests?.[0]?.status === "completed" && next.placementTests?.[0]?.recommendedLevel === "Arabic Level 4 QA" ? next : null;
      });
      return {
        ok: Boolean(state),
        bookingStatus: state?.placementTests?.[0]?.status,
        recommendedLevel: state?.placementTests?.[0]?.recommendedLevel,
        workflowStatus: state?.enrollmentWorkflows?.[0]?.status,
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
      const form = await waitFor(() => document.querySelector(".registrar-student-create-form"));
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
      setStudentField("Subject / course interest", "Arabic Language");
      setStudentField("Age group", "Adult");
      setStudentField("Current level / placement", "Arabic Level 3");
      setStudentField("Student status", "active");
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
      const setEnrollmentField = (label, value) => {
        const row = Array.from(document.querySelectorAll(".registrar-workflow-list article"))
          .find((item) => normalize(item.textContent).includes("Lead Demo")) ?? document.querySelector(".registrar-workflow-list article");
        if (!row) throw new Error("Enrollment workflow row not found");
        const expected = normalize(label).toLowerCase();
        const match = Array.from(row.querySelectorAll("label"))
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes(expected));
        const control = match?.querySelector("input, select, textarea");
        setValue(control, value);
      };
      setEnrollmentField("Run", "run_ar_l3_assign_qa");
      await waitFor(() => {
        const row = document.querySelector(".registrar-workflow-list article");
        const classControl = Array.from(row?.querySelectorAll("label") || [])
          .find((item) => normalize(item.childNodes[0]?.textContent ?? item.textContent).toLowerCase().includes("class"))
          ?.querySelector("select");
        return classControl && Array.from(classControl.options).some((option) => option.value === "class_ar_l3_assign_qa") ? classControl : null;
      });
      setEnrollmentField("Class", "class_ar_l3_assign_qa");
      await clickButton("Activate");
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
      await waitFor(() => document.querySelector(".admin-access-panel.selected-user"));
      await clickButtonWithin(".admin-access-panel.selected-user", "Pause");
      const state = await waitFor(() => {
        const next = readState();
        const user = next.users?.find((item) => item.email === email);
        const profile = next.staffProfiles?.find((item) => item.userId === user?.id && item.role === "registrar");
        return user?.status === "paused" && profile?.status === "paused" ? next : null;
      }, 5000);
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
    route: "/app/admin/users/usr_teacher_spare",
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
      await clickButtonWithin(".admin-user-detail-tabs", "Related records");
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
    name: "admin governance workflow updates permission matrix and branch status",
    role: "superadmin",
    route: "/app/admin/roles",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Permission matrix"));
      const permissionButton = await waitFor(() =>
        Array.from(document.querySelectorAll(".admin-permission-grid button"))
          .find((button) => normalize(button.textContent).toLowerCase().includes("payments / read")),
        4000
      );
      if (!permissionButton) throw new Error("Payments read permission control was not rendered");
      const beforePermission = readState().permissions?.teacher?.includes("payments:read") === true;
      permissionButton.click();
      const permissionState = await waitFor(() => {
        const next = readState();
        return next.permissions?.teacher?.includes("payments:read") !== beforePermission ? next : null;
      }, 5000);
      const cairoStatus = Array.from(document.querySelectorAll(".admin-branch-list select"))
        .find((select) => normalize(select.getAttribute("aria-label")).toLowerCase().includes("cairo"));
      if (!cairoStatus) throw new Error("Cairo branch status control was not rendered");
      setValue(cairoStatus, "paused");
      const state = await waitFor(() => {
        const next = readState();
        return next.branches?.find((item) => item.id === "br_cairo")?.status === "paused" ? next : null;
      }, 5000);
      const permissionAudit = state?.auditLogs?.find((item) => item.action === "permission.updated" && item.entityId === "teacher");
      const branchAudit = state?.auditLogs?.find((item) => item.action === "branch.updated" && item.entityId === "br_cairo");
      return {
        ok: Boolean(state && permissionState),
        teacherHasPaymentRead: state?.permissions?.teacher?.includes("payments:read") === true,
        expectedPermission: !beforePermission,
        branchStatus: state?.branches?.find((item) => item.id === "br_cairo")?.status,
        permissionAuditAction: permissionAudit?.action,
        permissionAuditActorId: permissionAudit?.actorId,
        branchAuditAction: branchAudit?.action,
        branchAuditActorId: branchAudit?.actorId
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.teacherHasPaymentRead === value?.expectedPermission &&
      value?.branchStatus === "paused" &&
      value?.permissionAuditAction === "permission.updated" &&
      value?.permissionAuditActorId === "usr_admin_demo" &&
      value?.branchAuditAction === "branch.updated" &&
      value?.branchAuditActorId === "usr_admin_demo",
  },
  {
    name: "admin reports workflow changes report type and saves preset",
    role: "superadmin",
    route: "/app/admin/reports",
    source: workflowActionSource(`
      setByLabel("Report type", "finance");
      await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Finance report"));
      setByLabel("Search rows", "inv_cairo_demo_1");
      setByLabel("Status", "pending");
      const filtered = await waitFor(() => /1 of \\d+ finance rows/i.test(normalize(document.body.innerText || document.body.textContent)));
      const metricSort = Array.from(document.querySelectorAll(".platform-report-row.header button"))
        .find((button) => normalize(button.textContent).includes("Metric"));
      if (metricSort) metricSort.click();
      await delay(80);
      await clickButton("Save view");
      const savedState = await waitFor(() => {
        const next = readState();
        const preset = next.reportPresets?.find((item) =>
          item.ownerUserId === "usr_admin_demo" &&
          item.role === "superadmin" &&
          item.reportType === "finance" &&
          item.search === "inv_cairo_demo_1" &&
          item.status === "pending"
        );
        return preset ? next : null;
      });
      const found = await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Finance snapshot"));
      const applyButton = Array.from(document.querySelectorAll(".platform-row-list.compact button"))
        .find((button) => normalize(button.textContent) === "Apply");
      if (applyButton) applyButton.click();
      await delay(100);
      const body = normalize(document.body.innerText || document.body.textContent);
      return {
        ok: Boolean(found && filtered),
        textIncludesPreset: Boolean(found),
        hasSearchControl: Boolean(Array.from(document.querySelectorAll(".platform-report-controls label")).some((label) => normalize(label.textContent).includes("Search rows"))),
        hasStatusControl: Boolean(Array.from(document.querySelectorAll(".platform-report-controls label")).some((label) => normalize(label.textContent).includes("Status"))),
        filteredRowsVisible: /1 of \\d+ finance rows/i.test(body),
        presetSaved: Boolean(savedState),
        auditAction: savedState?.auditLogs?.find((item) => item.entityType === "ReportPreset")?.action,
        hasTypedFinanceRows: Boolean(document.querySelector(".platform-report-table.typed .platform-report-row-metric")) &&
          body.includes("balance") &&
          body.includes("Cairo Student Demo"),
        hasMetricSort: Boolean(document.querySelector(".platform-report-row.header button[aria-pressed='true']")) &&
          normalize(document.querySelector(".platform-report-row.header button[aria-pressed='true']")?.textContent).includes("Metric"),
        body: body.slice(0, 500)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.textIncludesPreset === true &&
      value?.hasSearchControl === true &&
      value?.hasStatusControl === true &&
      value?.filteredRowsVisible === true &&
      value?.presetSaved === true &&
      value?.auditAction === "report.preset.saved" &&
      value?.hasTypedFinanceRows === true &&
      value?.hasMetricSort === true,
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
      await waitFor(() => normalize(document.body.textContent).includes("inv_cairo_demo_1"));
      await clickButton("Record payment");
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
    name: "admin integrations workflow checks mock provider and logs result",
    role: "superadmin",
    route: "/app/admin/integrations",
    source: workflowActionSource(`
      await clickButton("Moodle LMS");
      setByLabel("Status", "connected");
      const connectedState = await waitFor(() => {
        const next = readState();
        return next.integrations?.find((item) => item.id === "moodle")?.status === "connected" ? next : null;
      }, 5000);
      await clickButton("Run local check");
      const checkedState = await waitFor(() => {
        const next = readState();
        return next.auditLogs?.some((item) => item.action === "integration.local_checked" && item.entityId === "moodle") ? next : null;
      }, 5000);
      const found = await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Moodle LMS") && normalize(document.body.innerText || document.body.textContent).includes("Checked at"));
      const body = normalize(document.body.innerText || document.body.textContent);
      const integration = checkedState?.integrations?.find((item) => item.id === "moodle");
      const statusAudit = checkedState?.auditLogs?.find((item) => item.action === "integration.status_updated" && item.entityId === "moodle");
      const checkAudit = checkedState?.auditLogs?.find((item) => item.action === "integration.local_checked" && item.entityId === "moodle");
      return {
        ok: Boolean(found && connectedState && checkedState),
        checkedProvider: body.includes("Moodle LMS"),
        checkLogged: body.includes("Checked at"),
        status: integration?.status,
        hasLastSync: Boolean(integration?.lastSyncAt),
        statusAuditAction: statusAudit?.action,
        statusAuditActorId: statusAudit?.actorId,
        checkAuditAction: checkAudit?.action,
        checkAuditActorId: checkAudit?.actorId,
        body: body.slice(0, 700)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.checkedProvider === true &&
      value?.checkLogged === true &&
      value?.status === "connected" &&
      value?.hasLastSync === true &&
      value?.statusAuditAction === "integration.status_updated" &&
      value?.statusAuditActorId === "usr_admin_demo" &&
      value?.checkAuditAction === "integration.local_checked" &&
      value?.checkAuditActorId === "usr_admin_demo",
  },
  {
    name: "admin system health workflow records health audit",
    role: "superadmin",
    route: "/app/admin/system-health",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Operational checks"));
      await clickButton("Run checks");
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
      await waitFor(() => normalize(document.body.textContent).includes("Global platform settings"));
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
    const selectedWorkflows = deepWorkflowCases.filter(workflow =>
      workflow.name.toLowerCase().includes(workflowNameFilter)
    );
    await assertCheck(
      `workflow filter "${workflowNameFilter}" matched cases`,
      {
        count: selectedWorkflows.length,
        names: selectedWorkflows.map(workflow => workflow.name),
      },
      value => value?.count > 0
    );
    for (const workflow of selectedWorkflows) {
      await runDeepWorkflow(workflow);
    }
    throw new Error("__QA_FILTER_COMPLETE__");
  }

  recordProgress("auth routes");
  for (const authRoute of authRoutes) {
    assertRunBudget(`checking auth route ${authRoute}`);
    await goto(authRoute);
    const authCheck = await pageEval(inspectAuthSource(authRoute));
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
  const gateway = await pageEval(`() => ({
    path: location.pathname,
    portalLinks: Array.from(document.querySelectorAll('a[href^="/auth/"]')).map((anchor) => anchor.getAttribute("href")),
    quoteArabic: document.querySelector(".auth-calligraphy-panel strong")?.textContent?.trim() || "",
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  })`);
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
  for (const role of roles) {
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
      value => value?.shell === true
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
  for (const workflow of deepWorkflowCases) {
    await runDeepWorkflow(workflow);
  }

  recordProgress("mobile portal routes");
  for (const role of roles) {
    recordProgress(`mobile role: ${role.role}`);
    assertRunBudget(`checking mobile role ${role.role}`);
    await runPw("resize", ["390", "844"]);
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

  const consoleOutput = await runPw("console", ["error"]);
  checks.push({
    name: "browser console errors captured",
    ok: true,
    actual: consoleOutput.slice(0, 1000),
  });
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
