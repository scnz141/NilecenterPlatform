// Shared helpers for the staff browser suites in scripts/staff-ui/.
// Env precedence: process.env wins, then .env.local fills gaps.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const envFile = path.join(REPO, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

export const BASE = (
  process.env.STAFF_UI_BASE ?? "http://localhost:3000"
).replace(/\/+$/, "");

export const envVal = key => process.env[key];

export const creds = role => ({
  email: envVal(`EMS_QA_${role}_EMAIL`),
  password: envVal(`EMS_QA_${role}_PASSWORD`),
});

export const stamp = () =>
  new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);

/* ---------- Playwright via the project's @playwright/cli dependency -------- */
const require = createRequire(path.join(REPO, "package.json"));
const cliPackage = require.resolve("@playwright/cli/package.json");
const playwrightEntry = require.resolve("playwright", {
  paths: [path.dirname(cliPackage)],
});
const playwrightModule = await import(pathToFileURL(playwrightEntry).href);
export const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium;
if (!chromium) {
  throw new Error(
    "Playwright resolved through @playwright/cli but exposed no chromium export."
  );
}

/* ---------- BFF calls with a cookie jar (setup and cleanup) ---------------- */
export class Api {
  constructor() {
    this.jar = new Map();
  }
  async call(method, url, body) {
    const headers = {
      Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "),
      "Content-Type": "application/json",
    };
    if (method !== "GET") headers["X-Nile-Learn-Request"] = "browser";
    const response = await fetch(BASE + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return { status: response.status, data: await response.json().catch(() => null) };
  }
  async login(role) {
    return this.call("POST", "/api/auth/login", creds(role));
  }
  async pickWorkspace() {
    const branchId = (await this.call("GET", "/api/auth/workspaces")).data
      ?.items?.[0]?.id;
    if (branchId)
      await this.call("POST", "/api/auth/switch-workspace", { branchId });
    return branchId;
  }
  async logout() {
    return this.call("POST", "/api/auth/logout");
  }
}

/* ---------- Browser sign-in ----------------------------------------------- */
export async function signIn(page, role) {
  const account = creds(role);
  if (!account.email || !account.password)
    throw new Error(`EMS_QA_${role}_EMAIL/PASSWORD is not set.`);
  await page.goto(`${BASE}/auth/administration-login`);
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes("login"), { timeout: 30000 });
}

/** Pick a workspace when the role must choose one (auth page or in-app gate). */
export async function pickWorkspace(page) {
  if (page.url().includes("/auth/select-workspace")) {
    // The branch list renders only after the workspaces fetch returns.
    const option = page.locator(".auth-v2-role-list button").first();
    await option.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      await page
        .waitForURL(u => !u.pathname.includes("select-workspace"), {
          timeout: 30000,
        })
        .catch(() => {});
    }
  }
  const gate = page.locator(".staff-gate-option").first();
  await gate.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  if (await gate.isVisible().catch(() => false)) {
    await gate.click();
    await page
      .waitForSelector(".staff-content", { timeout: 30000 })
      .catch(() => {});
  }
}

export async function signInAndEnter(page, role) {
  await signIn(page, role);
  await pickWorkspace(page);
}

/** Wait for a selector (best effort), network idle, then a short quiet. */
export async function settle(page, selector, { timeout = 30000, quiet = 500 } = {}) {
  if (selector)
    await page.waitForSelector(selector, { timeout }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(quiet);
}

/**
 * Choose an ISO date in a staff DatePicker field (a button, not an input):
 * opens it, steps month by month to the date, and clicks the day.
 */
export async function pickDate(page, selector, iso) {
  await page.locator(selector).click();
  const pop = page.locator(".staff-datepicker");
  await pop.waitFor({ timeout: 10000 });
  for (let step = 0; step < 120; step += 1) {
    const day = pop.locator(`.staff-dp-day[data-iso="${iso}"]:not([data-outside])`);
    if (await day.count()) {
      await day.click();
      await pop.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
      return;
    }
    const shown = await pop.locator(".staff-dp-day:not([data-outside])").first().getAttribute("data-iso");
    // Header order is previous, title, next in every language.
    await pop.locator(".staff-dp-nav").nth(iso > shown ? 1 : 0).click();
  }
  throw new Error(`Date ${iso} is not reachable in ${selector}`);
}

/** Pick an option from an aria-labelled combobox (Select trigger). */
export async function chooseOption(page, triggerName, optionText) {
  await page.getByRole("combobox", { name: triggerName }).click();
  await page.getByRole("option", { name: optionText }).first().click();
  await page.waitForTimeout(300);
}

/* ---------- Result accounting, console errors, screenshots ----------------- */
export function createSuite(name) {
  const out = path.join(REPO, "output", "staff-ui", name);
  mkdirSync(out, { recursive: true });
  const results = [];
  const consoleErrors = [];
  const failedResponses = [];

  const step = (label, ok, note) => {
    results.push({ label, ok, ...(note ? { note } : {}) });
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${note ? ` (${note})` : ""}`);
  };

  /** Watch a page for console errors and failed same-origin /api/ responses. */
  const watch = (page, { ignoreResponses } = {}) => {
    page.on("pageerror", error =>
      consoleErrors.push(`pageerror: ${String(error).slice(0, 240)}`)
    );
    page.on("console", message => {
      if (
        message.type() === "error" &&
        !/net::|Failed to load resource/.test(message.text())
      )
        consoleErrors.push(message.text().slice(0, 240));
    });
    page.on("response", response => {
      if (
        response.url().startsWith(BASE) &&
        response.status() >= 400 &&
        !ignoreResponses?.test(response.url())
      )
        failedResponses.push(
          `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`
        );
    });
  };

  const shot = page => filename =>
    page.screenshot({ path: path.join(out, `${filename}.png`) });

  const finish = () => {
    const passed = results.filter(result => result.ok).length;
    console.log(
      `\n${passed}/${results.length} passed; console errors ${consoleErrors.length}`
    );
    if (failedResponses.length)
      console.log(
        "failed responses:",
        JSON.stringify(failedResponses.slice(0, 12))
      );
    if (consoleErrors.length)
      console.log("console:", JSON.stringify(consoleErrors.slice(0, 6)));
    writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(
        { suite: name, steps: results, consoleErrors, failedResponses },
        null,
        2
      )
    );
    console.log(
      `SUITE_RESULT ${JSON.stringify({ suite: name, passed, total: results.length, consoleErrors: consoleErrors.length })}`
    );
    if (results.some(result => !result.ok)) process.exitCode = 1;
    return { passed, total: results.length };
  };

  return { name, out, step, watch, shot, finish, consoleErrors, failedResponses };
}
