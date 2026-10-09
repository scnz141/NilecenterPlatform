// Date picker on the Add class sheet: keyboard, ranges, limits, Arabic, phone. Nothing is saved.
import { BASE, chromium, settle, signIn, createSuite } from "./lib.mjs";

const suite = createSuite("date-picker");
const OUT = suite.out;
const step = suite.step;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e).slice(0, 160)));
const writes = [];
page.on("request", r => {
  if (r.method() !== "GET" && r.url().includes("/api/ncc/") && !r.url().includes("/auth/")) writes.push(r.url());
});
await signIn(page, "SUPER_ADMIN");

async function openSheet(lang) {
  await page.evaluate(l => localStorage.setItem("nilelearn.locale", l), lang);
  await page.goto(`${BASE}/app/classes`);
  await settle(page, ".staff-page-actions");
  await page.locator(".staff-page-actions .staff-btn[data-variant='primary']").first().click();
  await page.waitForSelector("#class-start", { timeout: 15000 });
}
const pop = () => page.locator(".staff-datepicker");
const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-iso"));
const title = () => pop().locator(".staff-dp-title").innerText();

await openSheet("en");
step("no native date inputs in the staff sheet", (await page.locator(".ui-sheet input[type='date']").count()) === 0);
step("empty field shows a placeholder", (await page.locator("#class-start").innerText()).includes("Choose a date"));

// Pointer: open from the field and from its label.
await page.locator("#class-start").click();
await pop().waitFor();
step("calendar opens", await pop().isVisible());
step("six full weeks", (await pop().locator(".staff-dp-day").count()) === 42);
step("today is marked", (await pop().locator(".staff-dp-day[aria-current='date']").count()) === 1);
await page.waitForTimeout(100);
const start = await focused();
step("focus starts on today", start === (await pop().locator(".staff-dp-day[aria-current='date']").getAttribute("data-iso")), start);
await page.screenshot({ path: `${OUT}/en-open.png` });

// Keyboard.
await page.keyboard.press("ArrowRight");
const right = await focused();
step("ArrowRight moves one day", right > start, `${start} -> ${right}`);
await page.keyboard.press("ArrowDown");
step("ArrowDown moves one week", (await focused()) > right);
const monthBefore = await title();
await page.keyboard.press("PageDown");
await page.waitForTimeout(250);
step("Page Down shows the next month", (await title()) !== monthBefore, `${monthBefore} -> ${await title()}`);
await page.keyboard.press("Shift+PageDown");
await page.waitForTimeout(250);
const pickedIso = await focused();
await page.keyboard.press("Enter");
await page.waitForTimeout(250);
step("Enter picks and closes", (await pop().count()) === 0);
const fieldText = (await page.locator("#class-start").innerText()).trim();
step("field shows the picked date in words", /\d{4}/.test(fieldText) && /[A-Za-z]{3}/.test(fieldText), fieldText);
step("focus returns to the field", await page.evaluate(() => document.activeElement?.id === "class-start"));

// End date: days before the start are unavailable; the range is shaded.
await page.locator("#class-end").click();
await pop().waitFor();
await page.waitForTimeout(150);
const disabledCount = await pop().locator(".staff-dp-day[aria-disabled='true']").count();
step("days before the start date are unavailable", disabledCount > 0, `${disabledCount} unavailable`);
const disabled = pop().locator(".staff-dp-day[aria-disabled='true']").first();
await disabled.click({ force: true });
step("clicking an unavailable day does nothing", (await pop().count()) === 1);
const later = pop().locator(".staff-dp-day:not([aria-disabled]):not([data-outside])").nth(10);
const laterIso = await later.getAttribute("data-iso");
await later.click();
await page.waitForTimeout(200);
await page.locator("#class-end").click();
await pop().waitFor();
const between = await pop().locator(".staff-dp-cell[data-between]").count();
step("range between start and end is shaded", between > 0, `${pickedIso} to ${laterIso}, ${between} days`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/en-range.png` });

// Month and year view.
await pop().locator(".staff-dp-title").click();
await page.waitForTimeout(200);
step("title opens the month view", (await pop().locator(".staff-dp-month").count()) === 12);
await page.screenshot({ path: `${OUT}/en-months.png` });
await pop().locator(".staff-dp-nav").last().click();
await pop().locator(".staff-dp-month:not(:disabled)").nth(2).click();
await page.waitForTimeout(250);
step("picking a month returns to its days", (await pop().locator(".staff-dp-day").count()) === 42, await title());
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
step("Escape closes", (await pop().count()) === 0);

// Arabic: week starts on Saturday, arrows follow reading direction.
await openSheet("ar");
await page.locator("#class-start").click();
await pop().waitFor();
await page.waitForTimeout(150);
const firstHead = await pop().locator(".staff-dp-weekday abbr").first().getAttribute("title");
step("Arabic week starts on Saturday", firstHead === "السبت", firstHead);
const arStart = await focused();
await page.keyboard.press("ArrowLeft");
step("Arabic: ArrowLeft moves forward a day", (await focused()) > arStart);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/ar-open.png` });
await page.keyboard.press("Escape");

// Phone: the calendar fits and targets are 44px.
await page.setViewportSize({ width: 390, height: 844 });
await openSheet("en");
await page.locator("#class-start").click();
await pop().waitFor();
const box = await pop().boundingBox();
step("phone: calendar fits the screen", box && box.x >= 0 && box.x + box.width <= 390, `x=${box?.x} w=${box?.width}`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/phone-open.png` });

step("nothing was saved", writes.length === 0, writes.join(","));
step("no page errors", errors.length === 0, errors.join(" | "));
await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));
await browser.close();
suite.finish();
