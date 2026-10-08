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
  "/auth/select-workspace",
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
      ) &&
        line.includes("/api/integrations/moodle/projections/courses")) ||
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
    let session = null;
    try {
      const sessionResponse = await fetch("/api/auth/session", {
        credentials: "include"
      });
      session = sessionResponse.ok
        ? await sessionResponse.json().catch(() => null)
        : null;
    } catch {}
    const browserSessionPersisted = Boolean(
      localStorage.getItem("nilelearn.auth.session") ||
      localStorage.getItem("nilelearn.activeRole")
    );
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
      browserSessionPersisted,
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
    const sessionResponse = await fetch("/api/auth/session", {
      credentials: "include"
    });
    const verifiedSession = sessionResponse.ok
      ? await sessionResponse.json().catch(() => null)
      : null;
    if (
      !verifiedSession ||
      verifiedSession.activeRole !== ${JSON.stringify(role.role)} ||
      verifiedSession.userId !== payload?.userId
    ) {
      return {
        ok: false,
        status: sessionResponse.status,
        body: "The server session did not match the authenticated identity."
      };
    }
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

  const registrar = {
    role: "registrar",
    email: "r@nl.test",
    loginPath: "/auth/administration-login",
  };
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
    name: "student support shows only teacher-shared intervention",
    role: "student",
    route: "/app/student/support",
    source: workflowActionSource(`
      const section = await waitFor(() =>
        document.querySelector(".student-support-record-card")
      );
      const text = normalize(section?.textContent);
      return {
        ok: Boolean(section),
        showsPlan: text.includes("Attendance"),
        showsNextStep: text.includes("Review punctuality after the next two class sessions"),
        showsMonitoring: text.includes("Monitoring"),
        exposesStaffOnly: text.includes("Private staff intervention")
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.showsPlan &&
      value?.showsNextStep &&
      value?.showsMonitoring &&
      value?.exposesStaffOnly === false,
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
        value.provider === authenticatedProviders.get(role.role) &&
        value.sessionRole === role.role &&
        value.browserSessionPersisted === false
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
