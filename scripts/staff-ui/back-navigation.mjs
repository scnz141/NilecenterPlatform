// Back to the parent list from sub-pages: filters, scroll, deep links, history, Arabic, phone.
import { BASE, chromium, settle, signIn, createSuite } from "./lib.mjs";

const suite = createSuite("back-navigation");
const OUT = suite.out;
const step = suite.step;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e).slice(0, 160)));
await signIn(page, "SUPER_ADMIN");
await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));

const back = () => page.locator(".staff-topbar .staff-back");
const scrollTop = () => page.locator(".staff-main").evaluate(el => Math.round(el.scrollTop));

// Top-level pages have no Back.
await page.goto(`${BASE}/app/leads`);
await settle(page, ".staff-content a[href^='/app/leads/']");
step("no Back on a top-level page", (await back().count()) === 0);

// Filter the list, scroll, open a student. A short window makes the list scroll.
await page.setViewportSize({ width: 1440, height: 520 });
await page.goto(`${BASE}/app/leads?status=lost`);
await settle(page, ".staff-content a[href^='/app/leads/']");
await page.waitForFunction(() => document.querySelectorAll(".staff-content a[href^='/app/leads/']").length > 5, null, { timeout: 30000 });
await page.locator(".staff-main").evaluate(el => el.scrollTo({ top: 300 }));
await page.waitForTimeout(250);
const before = await scrollTop();
const first = page.locator(".staff-content a[href^='/app/leads/']:visible").nth(2);
await first.click();
await settle(page, ".staff-detail-name, .staff-page-header h1");
step("Back shows on a detail page", (await back().count()) === 1);
step("Back names the parent list", (await back().innerText()).trim() === "Leads", await back().innerText());
step("Back has a full label for screen readers", (await back().getAttribute("aria-label")) === "Back to Leads");
await page.screenshot({ path: `${OUT}/detail-en.png` });

// Switch tabs on the detail page, then go back: one click returns to the list.
const tabs = page.locator(".staff-tab");
if ((await tabs.count()) > 1) {
  await tabs.nth(1).click();
  await page.waitForTimeout(300);
}
await back().click();
await settle(page, ".staff-content a[href^='/app/leads/']");
const url = new URL(page.url());
step("returns to the list in one click, past tab changes", url.pathname === "/app/leads", url.pathname);
step("keeps the list filters", url.searchParams.get("status") === "lost", url.search);
await page.waitForTimeout(500);
const after = await scrollTop();
step("restores the list scroll position", before > 100 && Math.abs(after - before) < 40, `before=${before} after=${after}`);
await page.setViewportSize({ width: 1440, height: 900 });

// Deep link straight to a detail page: Back opens the list with its last filters.
const detailHref = await page.locator(".staff-content a[href^='/app/leads/']").first().getAttribute("href");
const fresh = await context.newPage();
await fresh.goto(`${BASE}${detailHref}`);
await settle(fresh, ".staff-detail-name, .staff-page-header h1");
await fresh.locator(".staff-topbar .staff-back").click();
await settle(fresh, ".staff-content");
step("deep link: Back goes up to the list", new URL(fresh.url()).pathname === "/app/leads", fresh.url());
await fresh.close();

// Up went back through history, so browser Forward returns to the detail, and Back to the list.
await page.goForward();
await settle(page, ".staff-detail-name, .staff-page-header h1");
step("browser Forward after Up returns to the detail", new URL(page.url()).pathname.startsWith("/app/leads/"));

// Ctrl/Cmd-click opens the parent in a new tab without leaving the page.
const [popup] = await Promise.all([
  context.waitForEvent("page", { timeout: 5000 }).catch(() => null),
  back().click({ modifiers: [process.platform === "darwin" ? "Meta" : "Control"] }),
]);
step("modified click opens the list in a new tab", Boolean(popup) && new URL(page.url()).pathname.startsWith("/app/leads/"));
await popup?.close();

// Other detail families.
for (const [list, label] of [["/app/students", "Students"], ["/app/classes", "Classes"], ["/app/branches", "Branches"], ["/app/staff", "Staff"]]) {
  await page.goto(`${BASE}${list}`);
  await settle(page, `.staff-content a[href^='${list}/']`);
  const link = page.locator(`.staff-content a[href^='${list}/']`).first();
  if (!(await link.count())) {
    step(`${label}: has a record to open`, false);
    continue;
  }
  await link.click();
  await settle(page, ".staff-detail-name, .staff-page-header h1");
  step(`${label} detail: Back names ${label}`, (await back().innerText()).trim() === label, await back().innerText());
}

// Arabic: label in Arabic, chevron points right.
await page.evaluate(() => localStorage.setItem("nilelearn.locale", "ar"));
await page.reload();
await settle(page, ".staff-topbar .staff-back");
const flip = await page.locator(".staff-back-glyph").evaluate(el => getComputedStyle(el).scale);
step("Arabic: chevron mirrors", flip === "-1 1", flip);
await page.screenshot({ path: `${OUT}/detail-ar.png` });

// Phone: Back stays visible when the title compacts.
await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));
await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await settle(page, ".staff-topbar .staff-back");
await page.locator(".staff-main").evaluate(el => el.scrollTo({ top: 600 }));
await page.waitForTimeout(400);
step("phone: Back visible after scrolling", await back().isVisible());
await page.screenshot({ path: `${OUT}/detail-phone.png` });

step("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
suite.finish();
