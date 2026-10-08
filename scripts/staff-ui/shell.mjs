// Staff shell checks: sidebar collapse/rail/tooltip persistence, role-view chip.
import {
  BASE,
  chromium,
  createSuite,
  settle,
  signIn,
} from "./lib.mjs";

const suite = createSuite("shell");
const { step, watch, finish } = suite;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
watch(p);
try {
  await signIn(p, "SUPER_ADMIN");
  await p.goto(`${BASE}/app/dashboard`);
  await p.waitForSelector(".staff-dash", { timeout: 30000 });
  await settle(p);
  await p.evaluate(() => localStorage.removeItem("nilelearn.staff.sidebar"));
  await p.reload();
  await p.waitForSelector(".staff-dash");
  await settle(p);
  const width = async () => Math.round((await p.locator(".staff-sidebar").boundingBox()).width);
  const wide = await width();
  await p.getByRole("button", { name: "Collapse sidebar" }).click();
  await p.waitForTimeout(500);
  const rail = await width();
  step("collapse folds the sidebar into a rail", rail < 90 && wide > 200, `${wide}px -> ${rail}px`);
  await p.locator(".staff-nav-link").nth(2).hover();
  await p.waitForSelector(".staff-rail-tip", { timeout: 5000 }).catch(() => {});
  step(
    "rail shows a tooltip on hover",
    (await p.locator(".staff-rail-tip").count()) === 1,
    await p.locator(".staff-rail-tip").innerText().catch(() => "")
  );
  await p.screenshot({ path: `${suite.out}/shell-rail.png` });
  await p.reload();
  await p.waitForSelector(".staff-dash");
  await settle(p);
  step("collapse is remembered after reload", (await width()) < 90);
  await p.mouse.click(700, 500);
  await p.keyboard.press("[");
  await p.waitForTimeout(500);
  step("[ expands it again", (await width()) > 200);
  // Role view
  await p.locator(".staff-user-trigger").click();
  await p.getByRole("menuitem", { name: "View as role" }).click();
  await p.getByRole("menuitemradio", { name: /^Branch Admin/ }).click();
  await p.waitForSelector(".staff-roleview-chip, .staff-gate-option", { timeout: 30000 }).catch(() => {});
  if (await p.locator(".staff-gate-option").first().isVisible().catch(() => false)) {
    await p.locator(".staff-gate-option").first().click();
    await p.waitForSelector(".staff-content", { timeout: 30000 });
    await settle(p);
  }
  step(
    "viewing as shows a compact chip, no strip",
    (await p.locator(".staff-roleview-chip").count()) === 1 && (await p.locator(".staff-rolebar").count()) === 0
  );
  await p.screenshot({ path: `${suite.out}/shell-roleview.png` });
  await p.locator(".staff-roleview-chip").click();
  await p.waitForSelector(".staff-roleview-panel", { timeout: 10000 }).catch(() => {});
  step("chip opens the role and scope panel", await p.locator(".staff-roleview-panel").isVisible());
  await p.screenshot({ path: `${suite.out}/shell-roleview-open.png` });
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Return to my role" }).click();
  await p.waitForSelector(".staff-roleview-chip", { state: "detached", timeout: 30000 }).catch(() => {});
  step("exit returns to Super Admin", (await p.locator(".staff-roleview-chip").count()) === 0);
  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
  await p.screenshot({ path: `${suite.out}/error.png` }).catch(() => {});
} finally {
  await b.close();
}

finish();
