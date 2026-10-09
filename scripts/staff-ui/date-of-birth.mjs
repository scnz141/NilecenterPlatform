// Date of birth field on the Add student and staff sheets. Nothing is saved.
import { BASE, chromium, settle, signIn, createSuite } from "./lib.mjs";

const suite = createSuite("date-of-birth");
const OUT = suite.out;
const step = suite.step;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e).slice(0, 160)));
const posts = [];
page.on("request", r => {
  if (r.method() !== "GET" && r.url().includes("/api/ncc/admissions/students")) posts.push(r.url());
});

await signIn(page, "SUPER_ADMIN");

async function openStudentSheet(lang) {
  await page.evaluate(l => localStorage.setItem("nilelearn.locale", l), lang);
  await page.goto(`${BASE}/app/students`);
  await settle(page, ".staff-page-actions");
  await page.locator(".staff-page-actions .staff-btn[data-variant='primary']").first().click();
  await page.waitForSelector(".staff-dob", { timeout: 15000 });
  await page.waitForTimeout(400);
}

const dob = () => page.locator(".staff-dob").first();
async function setDob(day, monthIndex, year) {
  const field = dob();
  await field.locator("[data-part='day'] input").fill(day);
  if (monthIndex !== null) {
    await field.locator("[data-part='month'] [role='combobox']").click();
    await page.getByRole("option").nth(monthIndex).click();
    await page.waitForTimeout(200);
  }
  await field.locator("[data-part='year'] input").fill(year);
}
async function submitAndReadError() {
  await page.locator(".staff-sheet-footer .staff-btn[data-variant='primary']").click();
  await page.waitForTimeout(400);
  return (await dob().locator(".staff-field-error").innerText().catch(() => "")).trim();
}

await openStudentSheet("en");
step("no native date input in the sheet", (await page.locator(".ui-sheet input[type='date']").count()) === 0);
await page.screenshot({ path: `${OUT}/en-empty.png` });

await setDob("1", 2, "0001");
let message = await submitAndReadError();
step("year 0001 is rejected", /1900/.test(message), message);
await page.screenshot({ path: `${OUT}/en-year-0001.png` });

await setDob("1", null, "2030");
message = await submitAndReadError();
step("future date is rejected", /future/i.test(message), message);

await setDob("31", 3, "2012");
message = await submitAndReadError();
step("31 April is rejected", /does not exist/i.test(message), message);

await dob().locator("[data-part='year'] input").fill("20");
message = await submitAndReadError();
step("two-digit year is incomplete", /four-digit/i.test(message), message);

await setDob("4", 2, "2012");
await page.waitForTimeout(200);
const foot = (await dob().locator(".staff-dob-foot").innerText()).trim();
step("valid date shows the age", /years old/.test(foot), foot);
await page.screenshot({ path: `${OUT}/en-valid.png` });
step("no student write was sent", posts.length === 0, posts.join(","));

await openStudentSheet("ar");
await setDob("4", 2, "2012");
const arFoot = (await dob().locator(".staff-dob-foot").innerText()).trim();
step("Arabic shows Arabic month names", /مارس/.test(await dob().innerText()), arFoot);
await page.screenshot({ path: `${OUT}/ar-valid.png` });

await page.setViewportSize({ width: 390, height: 844 });
await openStudentSheet("en");
await setDob("4", 2, "2012");
const box = await dob().boundingBox();
step("fits a 390px phone", box !== null && box.width <= 390, `width=${box?.width}`);
await page.screenshot({ path: `${OUT}/en-phone.png` });

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/app/staff?new=1`);
await page.waitForSelector(".staff-dob", { timeout: 15000 }).catch(() => {});
const staffDob = await page.locator(".staff-dob").count();
step("staff form uses the same field", staffDob === 1);
if (staffDob) {
  await setDob("4", 2, "1990");
  const clear = dob().getByRole("button", { name: "Clear date" });
  step("optional staff date can be cleared", await clear.isVisible());
  await clear.click();
  step("clear empties every part", (await dob().locator("[data-part='year'] input").inputValue()) === "");
  await page.screenshot({ path: `${OUT}/en-staff.png` });
}

step("no page errors", errors.length === 0, errors.join(" | "));
await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));
await browser.close();
suite.finish();
