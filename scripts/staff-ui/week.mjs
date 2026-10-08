// Teacher "My week" walk-through: read-only.
import {
  BASE,
  chromium,
  createSuite,
  settle,
  signIn,
} from "./lib.mjs";

const suite = createSuite("week");
const { step, watch, finish } = suite;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
watch(p);
try {
  await signIn(p, "TEACHER");
  await p.goto(`${BASE}/app/dashboard`);
  await p.waitForSelector(".staff-dash");
  await settle(p);
  step("teacher nav shows My week", (await p.locator(".staff-nav a", { hasText: "My week" }).count()) === 1);
  await p.goto(`${BASE}/app/sessions`);
  await p.waitForSelector(".staff-week, .staff-empty", { timeout: 30000 });
  await settle(p);
  await p.screenshot({ path: `${suite.out}/en-week-now.png` });
  for (let i = 0; i < 3; i++) {
    await p.getByRole("button", { name: "Previous week" }).click();
    await p.waitForTimeout(300);
  }
  await settle(p);
  const rows = await p.locator(".staff-week .staff-session-item").count();
  step("past week shows sessions across classes", rows >= 2, `${rows} sessions`);
  step(
    "session with a Moodle attendance session offers Take attendance",
    (await p.getByRole("button", { name: "Take attendance" }).count()) >= 1
  );
  await p.screenshot({ path: `${suite.out}/en-week-past.png` });
  await p.getByRole("button", { name: "Take attendance" }).first().click();
  await p.waitForSelector(".ui-sheet", { timeout: 20000 }).catch(() => {});
  step("attendance sheet opens from the week", (await p.locator(".ui-sheet").count()) === 1);
  step(
    "save is disabled with nothing to save",
    await p.getByRole("button", { name: "Save attendance" }).isDisabled()
  );
  await p.keyboard.press("Escape");
  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
  await p.screenshot({ path: `${suite.out}/error.png` }).catch(() => {});
} finally {
  await b.close();
}

finish();
