import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3001";
const session = process.env.QA_SESSION || `nile-portals-qa-${process.pid}`;
const password = process.env.NILE_DEMO_PASSWORD || "demo1234";
const commandTimeoutMs = Number(process.env.QA_COMMAND_TIMEOUT_MS || 45000);
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
    email: "student.demo@nilelearn.local",
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
    email: "teacher.demo@nilelearn.local",
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
    email: "registrar.demo@nilelearn.local",
    loginPath: "/auth/administration-login",
    dashboard: "/app/registrar/dashboard",
    routes: [
      "/app/registrar/leads/lead_demo_1",
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
    email: "hod.demo@nilelearn.local",
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
      "/app/hod/assessments",
      "/app/hod/certificates",
      "/app/hod/reports",
      "/app/hod/messages",
    ],
  },
  {
    role: "branchadmin",
    email: "branch.demo@nilelearn.local",
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
    email: "admin.demo@nilelearn.local",
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

function runPw(command, args = []) {
  const result = spawnSync(pwcli, ["-s", session, command, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
    timeout: commandTimeoutMs,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error?.code === "ETIMEDOUT") {
    if (output.includes("### Result")) return output;
    throw new Error(
      `playwright ${command} timed out after ${commandTimeoutMs}ms: ${output.slice(0, 800)}`
    );
  }
  if (result.status !== 0) {
    throw new Error(`playwright ${command} failed: ${output.slice(0, 800)}`);
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

function pageEval(source) {
  return extractResult(runPw("eval", [source]));
}

function goto(pathname) {
  runPw("goto", [`${baseUrl}${pathname}`]);
}

async function assertCheck(name, actual, predicate, details = {}) {
  const ok = Boolean(predicate(actual));
  checks.push({ name, ok, actual, ...details });
  if (!ok) failures.push({ name, actual, ...details });
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
        return rect.width < 32 || rect.height < 32;
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
      while (performance.now() - started < 6000) {
        const text = normalize(document.body.innerText || document.body.textContent);
        const contentText = normalize(document.querySelector(".platform-content")?.textContent || "");
        const changed = contentText !== previousContent;
        const settled = performance.now() - started > 700;
        if (location.pathname === route && document.querySelector(".platform-shell") && !text.includes("Loading workspace") && contentText.length > 80 && (changed || settled)) {
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
      await waitForRoute(route);
      await delay(80);
      results.push(inspect(route));
    }
    return results;
  }`;
}

function loginSource(role) {
  return `async () => {
    localStorage.clear();
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ${JSON.stringify(role.email)},
        password: ${JSON.stringify(password)},
        role: ${JSON.stringify(role.role)}
      })
    });
    const text = await response.text();
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
    const writeState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const waitFor = async (predicate, timeout = 1800) => {
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
    const goto = (route) => {
      history.pushState({}, "", route);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };

    try {
      await waitFor(() => {
        const text = normalize(document.body.innerText || document.body.textContent);
        const contentText = normalize(document.querySelector(".platform-content")?.textContent || "");
        return document.querySelector(".platform-shell") && document.querySelector(".platform-content") && !text.includes("Loading workspace") && contentText.length > 80;
      }, 5000);
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
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
    for (let i = 0; i < 80; i += 1) {
      const loading = document.querySelector(".platform-route-loading");
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
      hasLoading: Boolean(document.querySelector(".platform-route-loading")),
      hasShell: Boolean(document.querySelector(".platform-shell")),
      hasContent: Boolean(document.querySelector(".platform-content")),
      text: normalize(document.body.innerText || document.body.textContent).slice(0, 500)
    };
  }`;
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
  const role = roles.find(item => item.role === roleName);
  if (!role) throw new Error(`Unknown role for deep workflow: ${roleName}`);

  goto(role.loginPath);
  const loginResult = pageEval(loginSource(role));
  await assertCheck(
    `${name} login`,
    loginResult,
    value => value?.ok && value?.activeRole === role.role,
    {
      role: role.role,
      route,
      deepWorkflow: true,
    }
  );

  pageEval(resetPlatformStateSource());
  goto(route);
  const routeReady = pageEval(routeReadySource(route));
  await assertCheck(`${name} route ready`, routeReady, value => value?.ok, {
    role: role.role,
    route,
    deepWorkflow: true,
  });
  if (!routeReady?.ok) return;

  if (setupSource) {
    const setupResult = pageEval(setupSource);
    await assertCheck(`${name} setup`, setupResult, value => value?.ok, {
      role: role.role,
      route,
      deepWorkflow: true,
    });
    if (reloadAfterSetup) {
      goto(route);
      const routeReadyAfterSetup = pageEval(routeReadySource(route));
      await assertCheck(`${name} route ready after setup`, routeReadyAfterSetup, value => value?.ok, {
        role: role.role,
        route,
        deepWorkflow: true,
      });
      if (!routeReadyAfterSetup?.ok) return;
    }
  }

  const result = pageEval(source);
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
    source: workflowActionSource(`
      const before = readState();
      const beforeProgress = before.enrollments?.[0]?.progress ?? 0;
      await clickButtonWithin(".learning-player-actions", "Mark complete");
      const after = await waitFor(() => {
        const state = readState();
        const progress = state.enrollments?.[0]?.progress ?? 0;
        const completed = state.lessonProgress?.some((item) => item.lessonId === "lesson_ar_conditional" && item.status === "completed");
        return progress > beforeProgress && completed ? state : null;
      });
      return {
        ok: Boolean(after),
        beforeProgress,
        afterProgress: after?.enrollments?.[0]?.progress,
        lastAudit: after?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.afterProgress > value?.beforeProgress &&
      value?.lastAudit === "lesson.completed",
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
        return next.assignmentSubmissions?.[0]?.response === response ? next : null;
      });
      return {
        ok: Boolean(state),
        response: state?.assignmentSubmissions?.[0]?.response,
        notification: state?.notifications?.[0]?.title,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.notification === "Assignment submitted" &&
      value?.lastAudit?.startsWith("assignment."),
  },
  {
    name: "student quiz workflow creates attempt and grade",
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
      const before = readState();
      const beforeAttempts = before.quizAttempts?.length ?? 0;
      const beforeGrades = before.grades?.length ?? 0;
      setValue(document.querySelector(".platform-workflow-card input"), "A complete QA short answer");
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card:nth-of-type(2)", "Submit attempt");
      const state = await waitFor(() => {
        const next = readState();
        return (next.quizAttempts?.length ?? 0) > beforeAttempts && (next.grades?.length ?? 0) > beforeGrades ? next : null;
      });
      return {
        ok: Boolean(state),
        beforeAttempts,
        afterAttempts: state?.quizAttempts?.length,
        beforeGrades,
        afterGrades: state?.grades?.length,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.afterAttempts > value?.beforeAttempts &&
      value?.afterGrades > value?.beforeGrades,
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
      const before = readState();
      const quizCard = document.querySelectorAll(".platform-workflow-card")[1];
      setValue(quizCard?.querySelector("input"), "Madd route answer");
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card:nth-of-type(2)", "Submit attempt");
      const state = await waitFor(() => {
        const next = readState();
        return next.quizAttempts?.[0]?.quizId === "quiz_qt_madd" ? next : null;
      });
      return {
        ok: Boolean(state),
        quizId: state?.quizAttempts?.[0]?.quizId,
        beforeAttempts: before.quizAttempts?.length,
        afterAttempts: state?.quizAttempts?.length
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.quizId === "quiz_qt_madd" &&
      value?.afterAttempts > value?.beforeAttempts,
  },
  {
    name: "student attendance and certificates do not expose staff mutations",
    role: "student",
    route: "/app/student/attendance",
    source: workflowActionSource(`
      const attendanceButtons = Array.from(document.querySelectorAll("button")).map((button) => normalize(button.textContent));
      const attendanceText = normalize(document.body.textContent);
      goto("/app/student/certificates");
      await waitFor(() => normalize(document.body.textContent).includes("Certificate wallet"));
      const certificateButtons = Array.from(document.querySelectorAll("button")).map((button) => normalize(button.textContent));
      return {
        ok: true,
        attendanceHasSave: attendanceButtons.includes("Save attendance") || attendanceText.includes("Class attendance"),
        certificateHasApprove: certificateButtons.includes("Approve") || certificateButtons.includes("Issue"),
        certificateText: normalize(document.body.textContent)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.attendanceHasSave === false &&
      value?.certificateHasApprove === false &&
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
      const buttons = Array.from(document.querySelectorAll("button")).map((button) => normalize(button.textContent));
      setByLabel("Recitation title", title);
      await clickButtonWithin(".platform-workflow-main .platform-workflow-card", "Submit recitation");
      const state = await waitFor(() => {
        const next = readState();
        return next.recitationSubmissions?.[0]?.title === title ? next : null;
      });
      return {
        ok: Boolean(state),
        title: state?.recitationSubmissions?.[0]?.title,
        status: state?.recitationSubmissions?.[0]?.status,
        hasTeacherControls: buttons.includes("Update progress") || buttons.includes("Review recitation"),
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.status === "pending" &&
      value?.hasTeacherControls === false &&
      value?.lastAudit === "recitation.submitted",
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
    source: workflowActionSource(`
      await clickButtonWithin(".platform-attendance-grid", "late", true);
      await waitFor(() => Array.from(document.querySelectorAll(".platform-attendance-grid button.active")).some((button) => normalize(button.textContent).toLowerCase() === "late"));
      await clickButtonWithin(".platform-workflow-card", "Save attendance");
      const state = await waitFor(() => {
        const next = readState();
        const saved = next.classSessions?.find((item) => item.id === "session_ar_live")?.attendanceSaved;
        const record = next.attendance?.find((item) => item.sessionId === "session_ar_live" && item.studentId === "stu_demo");
        return saved && record?.status === "late" ? next : null;
      });
      const fallback = readState();
      return {
        ok: Boolean(state),
        attendanceSaved: (state || fallback)?.classSessions?.find((item) => item.id === "session_ar_live")?.attendanceSaved,
        status: (state || fallback)?.attendance?.find((item) => item.sessionId === "session_ar_live" && item.studentId === "stu_demo")?.status,
        records: (state || fallback)?.attendance?.map((item) => ({ sessionId: item.sessionId, status: item.status })).slice(0, 4),
        lastAudit: (state || fallback)?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok && value?.attendanceSaved === true && value?.status === "late",
  },
  {
    name: "branch scheduling workflow creates calendar event",
    role: "branchadmin",
    route: "/app/branch/schedule",
    source: workflowActionSource(`
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
      return {
        ok: Boolean(state),
        title: state?.events?.[0]?.title,
        status: state?.events?.[0]?.status,
        sessionCreated: state?.classSessions?.[0]?.title === title,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.title?.startsWith("QA review session") &&
      value?.sessionCreated === true,
  },
  {
    name: "branch payment workflow records Cairo-scoped invoice",
    role: "branchadmin",
    route: "/app/branch/payments",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.users = (state.users || []).map((user) => user.id === "usr_student_demo" ? { ...user, branchId: "br_cairo" } : user);
      state.invoices = [
        { id: "inv_branch_qa", studentId: "stu_demo", amount: 900, currency: "EGP", dueAt: "2026-07-02", status: "pending" },
        ...(state.invoices || []).filter((item) => item.id !== "inv_branch_qa")
      ];
      state.payments = (state.payments || []).filter((item) => item.invoiceId !== "inv_branch_qa");
      writeState(state);
      return { ok: true, invoiceId: "inv_branch_qa" };
    `),
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("inv_branch_qa"));
      await clickButton("Record payment");
      const state = await waitFor(() => {
        const next = readState();
        return next.invoices?.find((item) => item.id === "inv_branch_qa")?.status === "paid" ? next : null;
      });
      const payment = state?.payments?.find((item) => item.invoiceId === "inv_branch_qa");
      return {
        ok: Boolean(state),
        invoiceStatus: state?.invoices?.find((item) => item.id === "inv_branch_qa")?.status,
        paymentStatus: payment?.status,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.invoiceStatus === "paid" &&
      value?.paymentStatus === "paid" &&
      value?.lastAudit === "payment.recorded",
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
        return next.messages?.[0]?.subject === subject ? next : null;
      });
      return {
        ok: Boolean(state),
        fromUserId: state?.messages?.[0]?.fromUserId,
        toUserId: state?.messages?.[0]?.toUserId,
        logSubject: state?.communicationLogs?.[0]?.subject,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_branch_demo" &&
      value?.toUserId !== "usr_branch_demo" &&
      value?.logSubject?.startsWith("QA branch message") &&
      value?.lastAudit === "message.sent",
  },
  {
    name: "branch reports render operations scope without global report selector",
    role: "branchadmin",
    route: "/app/branch/reports",
    source: workflowActionSource(`
      await waitFor(() => normalize(document.body.textContent).includes("Branch reports"));
      const text = normalize(document.body.textContent);
      return {
        ok: text.includes("Rooms") && text.includes("Attendance") && text.includes("Payments"),
        hasReportTypeSelector: Boolean(document.querySelector(".platform-report-controls select")),
        hasGlobalFinancePreset: text.includes("Finance snapshot")
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.hasReportTypeSelector === false &&
      value?.hasGlobalFinancePreset === false,
  },
  {
    name: "HOD assessment workflow creates scoped academic assessment",
    role: "headofdepartment",
    route: "/app/hod/assessments",
    source: workflowActionSource(`
      const title = "QA HOD assessment " + Date.now();
      setByLabel("Assessment title", title);
      setByLabel("Type", "assignment");
      await clickButton("Create assessment");
      const state = await waitFor(() => {
        const next = readState();
        return next.assignments?.[0]?.title === title ? next : null;
      });
      return {
        ok: Boolean(state),
        title: state?.assignments?.[0]?.title,
        courseRunId: state?.assignments?.[0]?.courseRunId,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.title?.startsWith("QA HOD assessment") &&
      value?.courseRunId === "run_ar_l3_2026" &&
      value?.lastAudit === "assignment.created",
  },
  {
    name: "HOD certificate workflow approves and issues certificate",
    role: "headofdepartment",
    route: "/app/hod/certificates",
    source: workflowActionSource(`
      await clickButton("Approve", true);
      await clickButton("Issue", true);
      const state = await waitFor(() => {
        const next = readState();
        return next.certificates?.[0]?.status === "issued" ? next : null;
      });
      return {
        ok: Boolean(state),
        status: state?.certificates?.[0]?.status,
        notification: state?.notifications?.[0]?.title,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.status === "issued" &&
      value?.notification === "Certificate issued",
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
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.fromUserId === "usr_hod_demo" &&
      value?.toUserId !== "usr_hod_demo" &&
      value?.logSubject?.startsWith("QA HOD message") &&
      value?.lastAudit === "message.sent",
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
    source: workflowActionSource(`
      const inputs = Array.from(document.querySelectorAll('.platform-workflow-card input[type="number"]'));
      setValue(inputs[0], "91");
      setValue(inputs[1], "94");
      setValue(document.querySelector(".platform-workflow-card textarea"), "QA tajweed review accepted.");
      await delay(140);
      await clickButtonWithin(".platform-workflow-card", "Update progress");
      await waitFor(() => readState().quranProgress?.[0]?.memorizedPercent === 91);
      await clickButtonWithin(".platform-workflow-card", "Review recitation");
      const state = await waitFor(() => {
        const next = readState();
        return next.quranProgress?.[0]?.memorizedPercent === 91 && next.recitationSubmissions?.[0]?.status === "approved" ? next : null;
      });
      const fallback = readState();
      return {
        ok: Boolean(state),
        memorized: (state || fallback)?.quranProgress?.[0]?.memorizedPercent,
        tajweed: (state || fallback)?.quranProgress?.[0]?.tajweedScore,
        recitationStatus: (state || fallback)?.recitationSubmissions?.[0]?.status,
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
        notification: state?.notifications?.[0]?.title
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.messageSubject === value?.logSubject &&
      value?.notification?.startsWith("QA class update"),
  },
  {
    name: "registrar finance workflow records payment and settles invoice",
    role: "registrar",
    route: "/app/registrar/payments",
    source: workflowActionSource(`
      const before = readState();
      const beforePaid = before.payments?.filter((item) => item.status === "paid").length ?? 0;
      await clickButton("Record payment");
      const state = await waitFor(() => {
        const next = readState();
        return next.invoices?.[0]?.status === "paid" && (next.payments?.filter((item) => item.status === "paid").length ?? 0) > beforePaid ? next : null;
      });
      return {
        ok: Boolean(state),
        invoiceStatus: state?.invoices?.[0]?.status,
        beforePaid,
        afterPaid: state?.payments?.filter((item) => item.status === "paid").length,
        lastAudit: state?.auditLogs?.[0]?.action
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.invoiceStatus === "paid" &&
      value?.afterPaid > value?.beforePaid,
  },
  {
    name: "registrar admissions workflow converts new lead",
    role: "registrar",
    route: "/app/registrar/leads",
    setupSource: workflowSetupSource(`
      const state = readState();
      state.leads = [
        {
          id: "lead_qa_convert",
          fullName: "QA Convert Lead",
          email: "qa.convert@nilelearn.local",
          phone: "+20 100 000 0999",
          subject: "Arabic Language",
          source: "website",
          status: "lead",
          notes: "Generated by workflow QA.",
          createdAt: new Date().toISOString()
        },
        ...(state.leads || []).filter((item) => item.id !== "lead_qa_convert")
      ];
      state.applications = (state.applications || []).filter((item) => item.leadId !== "lead_qa_convert");
      writeState(state);
      return { ok: true, leadCount: state.leads.length };
    `),
    source: workflowActionSource(`
      await clickButton("Convert", true);
      const state = await waitFor(() => {
        const next = readState();
        return next.applications?.some((item) => item.leadId === "lead_qa_convert") ? next : null;
      });
      return {
        ok: Boolean(state),
        leadStatus: state?.leads?.find((item) => item.id === "lead_qa_convert")?.status,
        applicationCreated: state?.applications?.some((item) => item.leadId === "lead_qa_convert"),
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
    name: "admin reports workflow changes report type and saves preset",
    role: "superadmin",
    route: "/app/admin/reports",
    source: workflowActionSource(`
      setByLabel("Report type", "finance");
      await delay(100);
      await clickButton("Save preset");
      const found = await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Finance snapshot 3"));
      return {
        ok: Boolean(found),
        textIncludesPreset: Boolean(found),
        body: normalize(document.body.innerText || document.body.textContent).slice(0, 500)
      };
    `),
    predicate: value => value?.ok && value?.textIncludesPreset === true,
  },
  {
    name: "admin integrations workflow checks mock provider and logs result",
    role: "superadmin",
    route: "/app/admin/integrations",
    source: workflowActionSource(`
      await clickButton("Moodle LMS");
      await clickButton("Run local check");
      const found = await waitFor(() => normalize(document.body.innerText || document.body.textContent).includes("Moodle LMS") && normalize(document.body.innerText || document.body.textContent).includes("Checked at"));
      const body = normalize(document.body.innerText || document.body.textContent);
      return {
        ok: Boolean(found),
        checkedProvider: body.includes("Moodle LMS"),
        checkLogged: body.includes("Checked at"),
        body: body.slice(0, 700)
      };
    `),
    predicate: value =>
      value?.ok &&
      value?.checkedProvider === true &&
      value?.checkLogged === true,
  },
];

try {
  runPw("open", [`${baseUrl}/auth/login`]);

  for (const authRoute of authRoutes) {
    goto(authRoute);
    const authCheck = pageEval(inspectAuthSource(authRoute));
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

  goto("/auth/login");
  const gateway = pageEval(`() => ({
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

  runPw("resize", ["390", "844"]);
  goto("/auth/login");
  const mobileGateway = pageEval(`() => ({
    path: location.pathname,
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    width: document.documentElement.clientWidth
  })`);
  await assertCheck(
    "auth gateway mobile has no horizontal overflow",
    mobileGateway,
    value => value?.overflow === 0
  );
  runPw("resize", ["1440", "1000"]);

  for (const role of roles) {
    goto(role.loginPath);
    const loginResult = pageEval(loginSource(role));
    await assertCheck(
      `${role.role} login API succeeds`,
      loginResult,
      value => value?.ok && value?.activeRole === role.role
    );

    goto(role.dashboard);
    const dashboard = pageEval(inspectSource(role.dashboard));
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
      `${role.role} dashboard session provider is Supabase`,
      dashboard,
      value => value?.provider === "supabase"
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

    const routeChecks = pageEval(inspectRouteMatrixSource(role.routes));
    await assertCheck(
      `${role.role} route matrix returned all routes`,
      routeChecks,
      value => Array.isArray(value) && value.length === role.routes.length
    );
    for (const routeCheck of routeChecks || []) {
      const route = routeCheck.expectedPath;
      await assertCheck(
        `${route} renders protected content`,
        routeCheck,
        value =>
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
        value => value?.textLength > 500 && value?.visibleControls >= 6
      );
    }
  }

  for (const workflow of deepWorkflowCases) {
    await runDeepWorkflow(workflow);
  }

  for (const role of roles) {
    runPw("resize", ["390", "844"]);
    goto(role.loginPath);
    const mobileLogin = pageEval(loginSource(role));
    await assertCheck(
      `${role.role} mobile login API succeeds`,
      mobileLogin,
      value => value?.ok && value?.activeRole === role.role
    );
    goto(role.dashboard);
    const mobile = pageEval(inspectSource(role.dashboard));
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

    const mobileRoutes = pageEval(inspectRouteMatrixSource(role.routes));
    await assertCheck(
      `${role.role} mobile route matrix returned all routes`,
      mobileRoutes,
      value => Array.isArray(value) && value.length === role.routes.length
    );
    for (const mobileRoute of mobileRoutes || []) {
      const route = mobileRoute.expectedPath;
      await assertCheck(
        `${route} mobile renders protected content`,
        mobileRoute,
        value =>
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
  runPw("resize", ["1440", "1000"]);

  const consoleOutput = runPw("console", ["error"]);
  checks.push({
    name: "browser console errors captured",
    ok: true,
    actual: consoleOutput.slice(0, 1000),
  });
} finally {
  try {
    runPw("close");
  } catch {
    // The browser may already be closed after a failed assertion.
  }
}

const outputDir = path.resolve(
  process.env.QA_OUTPUT_DIR || path.join(process.cwd(), "output", "playwright")
);
fs.mkdirSync(outputDir, { recursive: true });
const summary = {
  baseUrl,
  checkedAt: new Date().toISOString(),
  totalChecks: checks.length,
  failedChecks: failures.length,
  failures,
  checks,
};
const outputPath = path.join(outputDir, "portal-qa-summary.json");
fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
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
