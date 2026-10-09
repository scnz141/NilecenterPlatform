// Browser walk-through of the students UI as Registrar. Synthetic, marker-bound data.
import {
  Api,
  BASE,
  chooseOption,
  chromium,
  createSuite,
  pickWorkspace,
  settle,
  signInAndEnter,
  stamp,
} from "./lib.mjs";

const suite = createSuite("students");
const { step, watch, finish } = suite;
const MARK = `NILE-QA-${stamp()}`;

const admin = new Api();
await admin.login("SUPER_ADMIN");
const reasonOf = async kind => {
  const items = (await admin.call("GET", `/api/ncc/settings/action-reasons?kind=${kind}`)).data.items;
  return (
    items.find(r => r.status === "active")?.id ??
    (await admin.call("POST", "/api/ncc/settings/action-reasons", { kind, name: `${MARK} ${kind}` })).data?.reason?.id
  );
};
await reasonOf("cancel_enrolment");
await reasonOf("disable_student");
await reasonOf("left_enrolment");
const course = (await admin.call("GET", "/api/ncc/delivery/courses")).data.items[0];
await admin.call("POST", `/api/ncc/delivery/courses/${course.id}/enable`);
const courseName = course.displayName ?? course.fullname;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const shot = suite.shot(page);
const wait = selector => page.waitForSelector(selector, { timeout: 20000 }).catch(() => {});
let studentId = null;
try {
  watch(page);
  await signInAndEnter(page, "REGISTRAR");
  await page.goto(`${BASE}/app/students`);
  await page.waitForSelector(".staff-content, .staff-gate-option", { timeout: 30000 }).catch(() => {});
  await pickWorkspace(page);
  await wait(".staff-table, .staff-empty");
  step("students list renders with status tabs", (await page.locator(".staff-segment").count()) === 2);
  await shot("en-laptop-students");

  // Create a student directly
  await page.getByRole("button", { name: "Add student" }).first().click();
  await page.fill("#student-first", MARK);
  await page.fill("#student-last", "Direct");
  await page.fill("#student-email", `nile.qa.direct.${MARK.slice(-12).toLowerCase()}@example.com`);
  await page.fill("#student-fee", "300");
  await page.fill("#student-paid", "100");
  await page.fill("#id-nationality", "EGY");
  await chooseOption(page, "Gender", "Male");
  await page.fill(".staff-dob-part[data-part='day'] input", "5");
  await chooseOption(page, "Month", "May");
  await page.fill(".staff-dob-part[data-part='year'] input", "2011");
  await page.fill("#id-national", `3${String(Date.now()).slice(-9)}${Math.floor(1000 + Math.random() * 8999)}`);
  await page.fill("#id-address", `${MARK} address`);
  const g = page.locator(".staff-guardian").first().locator("input");
  await g.nth(0).fill(`${MARK} Parent`);
  await g.nth(1).fill("Father");
  await g.nth(2).fill("+201000000021");
  await g.nth(3).fill(`nile.qa.parent.${MARK.slice(-12).toLowerCase()}@example.com`);
  await page.getByRole("button", { name: "Create student", exact: true }).click();
  await page.waitForURL(/\/app\/students\/[0-9a-f-]{36}/, { timeout: 25000 }).catch(() => {});
  studentId = page.url().match(/students\/([0-9a-f-]{36})/)?.[1] ?? null;
  step("create student opens the student page", Boolean(studentId));
  await wait(".staff-money");
  step(
    "registration fee shows 200 remaining",
    (await page.locator(".staff-money-figures").innerText()).includes("200")
  );
  step(
    "guardian is listed",
    (await page.locator(".staff-guardian-row", { hasText: "Father" }).count()) === 1
  );
  await shot("en-laptop-student");

  // Sell a course, pay, try to add to a class, cancel
  const probe0 = new Api();
  await probe0.login("REGISTRAR");
  await probe0.pickWorkspace();
  console.log("  probe after create:", (await probe0.call("GET", `/api/ncc/admissions/students/${studentId}`)).status);
  await page.getByRole("tab", { name: "Courses" }).click();
  await wait(".staff-empty, .staff-table");
  await page.getByRole("button", { name: "Sell a course" }).click();
  await chooseOption(page, "Course", courseName);
  await page.fill("#sale-total", "1000");
  await page.fill("#sale-paid", "0");
  await page.locator(".staff-sheet-footer").getByRole("button", { name: "Sell a course" }).click();
  await wait(".staff-table tbody tr");
  step(
    "course sale shows as pending payment",
    (await page.locator(".staff-table tbody tr", { hasText: "Pending payment" }).count()) === 1
  );
  await page.getByRole("button", { name: "Record payment" }).first().click();
  await page.fill("#fee-paid", "1000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .waitForFunction(
      () => /Pending (group|class)/.test(document.querySelector(".staff-table tbody tr")?.innerText ?? ""),
      { timeout: 20000 }
    )
    .catch(() => {});
  const afterPay = await page.locator(".staff-table tbody tr").first().innerText();
  step(
    "full payment moves the sale to waiting for a class",
    /Pending (group|class)/.test(afterPay) && afterPay.includes("Paid in full"),
    afterPay.replace(/\s+/g, " ").slice(0, 120)
  );
  await shot("en-laptop-student-courses");
  await page.getByRole("button", { name: "Add to class" }).first().click();
  await wait(".staff-choice");
  await wait('.staff-banner:has-text("Moodle account")');
  step(
    "add-to-class shows seats and the Moodle requirement",
    (await page.locator(".staff-choice").count()) >= 1 &&
      (await page.locator(".staff-banner", { hasText: "Moodle account" }).count()) === 1
  );
  await shot("en-laptop-attach");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.locator(".staff-table tbody tr").first().getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Cancel sale" }).click();
  await page.getByRole("combobox", { name: "Reason" }).click();
  await page.getByRole("option").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Cancel sale", exact: true }).last().click();
  await wait('.staff-table tbody tr:has-text("Cancelled")');
  step(
    "cancel with reason closes the sale",
    (await page.locator(".staff-table tbody tr", { hasText: "Cancelled" }).count()) === 1
  );

  // Enrolments queue
  await page.goto(`${BASE}/app/enrolments?status=all&q=${encodeURIComponent(`nile.qa.direct.${MARK.slice(-12).toLowerCase()}`)}`);
  await wait(".staff-table, .staff-empty");
  await page
    .waitForFunction(() => document.querySelectorAll(".staff-table tbody tr").length >= 1, { timeout: 15000 })
    .catch(() => {});
  step("enrolments queue finds the sale", (await page.locator(".staff-table tbody tr").count()) === 1);
  await page.goto(`${BASE}/app/enrolments`);
  await wait(".staff-segments");
  await settle(page);
  await shot("en-laptop-enrolments");

  // Moodle-linked QA student: learning and report
  const linked = (await admin.call("GET", "/api/ncc/admissions/students?q=nile.qa.student&status=active")).data.items[0];
  await page.goto(`${BASE}/app/students/${linked.id}?tab=learning`);
  await wait(".staff-table, .staff-muted");
  await settle(page);
  step(
    "learning tab shows grades or the empty state",
    (await page.locator(".staff-table tbody tr").count()) >= 1 ||
      (await page.locator("p.staff-muted", { hasText: "No Moodle grades" }).count()) === 1
  );
  await page.goto(`${BASE}/app/students/${linked.id}?tab=report`);
  await wait(".staff-report");
  step("report tab renders the printable report", (await page.locator(".staff-report-title").count()) === 1);
  await shot("en-laptop-report");
  await page.emulateMedia({ media: "print" });
  await shot("en-print-report");
  await page.emulateMedia({ media: "screen" });

  const probe = new Api();
  await probe.login("REGISTRAR");
  await probe.pickWorkspace();
  const vis = await probe.call("GET", `/api/ncc/admissions/students/${studentId}`);
  console.log("  probe: registrar GET student", vis.status, vis.data?.student?.status ?? vis.data?.error);
  const visAdmin = await admin.call("GET", `/api/ncc/admissions/students/${studentId}`);
  console.log("  probe: admin GET student", visAdmin.status, visAdmin.data?.student?.status);

  // Disable the synthetic student from the UI
  await page.goto(`${BASE}/app/students/${studentId}`);
  await wait(".staff-detail-head");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Disable student" }).click();
  await page.getByRole("combobox", { name: "Reason" }).click();
  await page.getByRole("option").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Disable student", exact: true }).last().click();
  await page.waitForURL(/\/app\/students$/, { timeout: 20000 }).catch(() => {});
  step(
    "disable student returns a registrar to the list",
    /\/app\/students$/.test(new URL(page.url()).pathname) && (await page.locator(".staff-error").count()) === 0,
    page.url()
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app/students/${linked.id}?tab=courses`);
  await settle(page);
  await shot("en-phone-student-courses");
  await page.evaluate(() => localStorage.setItem("nilelearn.locale", "ar"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/app/enrolments?status=all`);
  await settle(page);
  await shot("ar-laptop-enrolments");
  await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));
  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
  await shot("error").catch(() => {});
} finally {
  await browser.close();
  if (studentId)
    await admin.call("POST", `/api/ncc/admissions/students/${studentId}/disable`, {
      reasonId: await reasonOf("disable_student"),
    });
  await admin.call("POST", `/api/ncc/delivery/courses/${course.id}/disable`, {
    reasonId: await reasonOf("disable_course"),
  });
  await admin.logout();
}

finish();
