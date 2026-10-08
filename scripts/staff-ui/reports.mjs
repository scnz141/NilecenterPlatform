// Reports page checks: tabs per role, period and branch controls, CSV export,
// and live EMS number cross-checks for admissions and classes.
import {
  Api,
  BASE,
  chromium,
  createSuite,
  settle,
  signIn,
  pickWorkspace,
} from "./lib.mjs";
import { readFileSync } from "node:fs";

const suite = createSuite("reports");
const { step, watch, finish } = suite;

const digits = text => Number((text ?? "").replace(/[^\d]/g, ""));
/** Lines in a CSV, ignoring CRLF inside quoted cells. */
const csvLineCount = text => {
  let lines = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (c === "\n" && !quoted) lines++;
  }
  return lines;
};
const tileValue = async (page, label) =>
  digits(
    await page
      .locator(".staff-tile", { hasText: label })
      .locator(".staff-tile-value")
      .first()
      .innerText()
      .catch(() => null)
  );
const tabNames = async page =>
  page.locator(".staff-report-tabs .staff-segment").allInnerTexts();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
watch(p);

try {
  /* ---- Super Admin: every report, period, branch, export, cross-check ---- */
  await signIn(p, "SUPER_ADMIN");
  const api = new Api();
  await api.login("SUPER_ADMIN");

  await p.goto(`${BASE}/app/reports`);
  await settle(p, ".staff-tile-value");
  step(
    "super admin sees all four reports",
    (await tabNames(p)).length === 4,
    (await tabNames(p)).join(", ")
  );

  // Admissions in "all" must match the live leads total.
  await p.goto(`${BASE}/app/reports?report=admissions&period=all`);
  await settle(p, ".staff-tile-value");
  const leadsTotal = (await api.call("GET", "/api/ncc/admissions/leads?pageSize=1")).data?.total;
  const newLeads = await tileValue(p, "New leads");
  step("admissions all-time new leads == EMS total", newLeads === leadsTotal, `page ${newLeads} vs ems ${leadsTotal}`);

  // Period switching updates the URL and re-renders.
  await p.getByRole("button", { name: "90 days" }).click();
  await settle(p, ".staff-tile-value");
  step("period switch writes ?period=90d", p.url().includes("period=90d"), p.url().split("?")[1]);
  const windowLeads = await tileValue(p, "New leads");
  step("90-day window narrows or matches all-time", windowLeads <= leadsTotal, `${windowLeads} <= ${leadsTotal}`);

  // Branch filter appears for super admin when staging has >1 active branch.
  const branchSelect = p.getByRole("combobox", { name: "Branch" });
  const hasBranchPicker = await branchSelect.isVisible().catch(() => false);
  if (hasBranchPicker) {
    await branchSelect.click();
    const options = await p.getByRole("option").allInnerTexts();
    if (options.length > 1) {
      await p.getByRole("option").nth(1).click();
      await settle(p, ".staff-tile-value");
      step("branch filter writes ?branch=", p.url().includes("branch="), p.url().split("branch=")[1]?.split("&")[0]);
      const scoped = await tileValue(p, "New leads");
      step("branch-scoped leads <= all leads", scoped <= windowLeads || scoped <= leadsTotal, `${scoped}`);
      await p.goto(`${BASE}/app/reports?report=admissions&period=all`);
      await settle(p, ".staff-tile-value");
    } else {
      step("branch filter", true, "skipped — single active branch");
    }
  } else {
    step("branch filter", true, "skipped — picker hidden (single branch)");
  }

  // CSV export downloads a BOM'd file of lead records, one row per EMS lead.
  await p.goto(`${BASE}/app/reports?report=admissions&period=all`);
  await settle(p, ".staff-tile-value");
  const [download] = await Promise.all([
    p.waitForEvent("download", { timeout: 15000 }),
    p.getByRole("button", { name: /Export CSV/ }).click(),
  ]);
  const bytes = readFileSync(await download.path());
  const text = bytes.toString("utf8");
  const header = text.split("\r\n")[0].replace(/^\uFEFF/, "");
  step(
    "CSV has UTF-8 BOM",
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    download.suggestedFilename()
  );
  step(
    "CSV header lists lead record columns",
    header ===
      "Name,Email,Phone,Branch,Source,Status,Lost reason,Owner,Area of study,Study mode,Created",
    header.slice(0, 90)
  );
  step(
    "CSV rows == EMS leads total",
    csvLineCount(text) - 1 === leadsTotal,
    `${csvLineCount(text) - 1} vs ${leadsTotal}`
  );

  // Bookings and enrolments render.
  await p.goto(`${BASE}/app/reports?report=bookings`);
  await settle(p, ".staff-panel, .staff-empty");
  step("bookings report renders panels", (await p.locator(".staff-panel").count()) >= 2);
  await p.goto(`${BASE}/app/reports?report=enrolments`);
  await settle(p, ".staff-tile, .staff-empty");
  step("enrolments report renders tiles", (await p.locator(".staff-tile").count()) >= 4);

  // Classes: "As of today" instead of a period switch, count matches EMS.
  await p.goto(`${BASE}/app/reports?report=classes`);
  await settle(p, ".staff-tile-value, .staff-empty");
  const classesTotal = (
    await api.call("GET", "/api/ncc/delivery/classes?status=active&pageSize=1")
  ).data?.total;
  const pageClasses = await tileValue(p, "Active classes");
  step("classes active count == EMS active total", pageClasses === classesTotal, `page ${pageClasses} vs ems ${classesTotal}`);
  step(
    "classes shows As of today, no period switch",
    (await p.getByText("As of today").count()) === 1 &&
      (await p.getByRole("button", { name: "90 days" }).count()) === 0
  );

  /* ---- Registrar: three admissions reports plus classes ------------------- */
  await api.logout();
  await p.goto(`${BASE}/auth/administration-login`);
  await signIn(p, "REGISTRAR");
  await pickWorkspace(p);
  await p.goto(`${BASE}/app/reports`);
  await settle(p, ".staff-segment, .staff-empty, .staff-tile");
  const regTabs = await tabNames(p);
  step(
    "registrar sees admissions, bookings, enrolments, classes",
    regTabs.length === 4,
    regTabs.join(", ")
  );
  step(
    "registrar admissions report loads tiles",
    (await p.locator(".staff-tile").count()) >= 4
  );

  /* ---- HOD: classes only --------------------------------------------------- */
  await api.logout();
  await signIn(p, "HOD");
  await pickWorkspace(p);
  await p.goto(`${BASE}/app/reports`);
  await settle(p, ".staff-segment, .staff-empty");
  const hodTabs = await tabNames(p);
  step("hod sees only the classes report", hodTabs.length === 1, hodTabs.join(", "));
  step(
    "hod classes report loads",
    (await p.locator(".staff-tile, .staff-empty").count()) > 0
  );
  step(
    "hod forced to admissions falls back to classes",
    await (async () => {
      await p.goto(`${BASE}/app/reports?report=admissions`);
      await settle(p, ".staff-segment, .staff-tile, .staff-empty");
      return (await tabNames(p)).length === 1;
    })()
  );

  /* ---- Teacher: no nav item, route shows no access -------------------------- */
  await api.logout();
  await signIn(p, "TEACHER");
  await pickWorkspace(p);
  await p.goto(`${BASE}/app/dashboard`);
  await settle(p, ".staff-content");
  const navReports = await p.locator(".staff-nav-link", { hasText: "Reports" }).count();
  step("teacher has no Reports nav item", navReports === 0);
  await p.goto(`${BASE}/app/reports`);
  await settle(p, ".staff-empty, .staff-content");
  const denied =
    (await p.getByText("No access").count()) > 0 &&
    (await p.locator(".staff-segment").count()) === 0;
  step("teacher hitting /app/reports sees no-access", denied);

  /* ---- Arabic + phone screenshots ------------------------------------------ */
  await api.logout();
  await signIn(p, "SUPER_ADMIN");
  await p.evaluate(() => localStorage.setItem("nilelearn.locale", "ar"));
  await p.goto(`${BASE}/app/reports?report=admissions`);
  await settle(p, ".staff-tile-value");
  await p.screenshot({ path: `${suite.out}/reports-admissions-ar-1440.png` });
  await p.goto(`${BASE}/app/reports?report=classes`);
  await settle(p, ".staff-tile-value, .staff-empty");
  await p.screenshot({ path: `${suite.out}/reports-classes-ar-1440.png` });
  await p.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));

  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const m = await phone.newPage();
  watch(m);
  await signIn(m, "SUPER_ADMIN");
  await m.goto(`${BASE}/app/reports`);
  await settle(m, ".staff-tile-value");
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > 390);
  await m.screenshot({ path: `${suite.out}/reports-admissions-en-390.png` });
  step("no horizontal overflow at 390px", !overflow);
  await m.goto(`${BASE}/app/reports?report=enrolments`);
  await settle(m, ".staff-tile, .staff-empty");
  await m.screenshot({ path: `${suite.out}/reports-enrolments-en-390.png` });
  await m.close();
  await phone.close();

  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
  await p.screenshot({ path: `${suite.out}/error.png` }).catch(() => {});
} finally {
  await b.close();
}

finish();
