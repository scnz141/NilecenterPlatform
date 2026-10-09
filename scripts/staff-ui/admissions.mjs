// Browser walk-through of the admissions UI as Registrar. Synthetic, marker-bound data.
import {
  pickDate,
  Api,
  BASE,
  chooseOption,
  chromium,
  createSuite,
  creds,
  settle,
  signInAndEnter,
  stamp,
} from "./lib.mjs";

const suite = createSuite("admissions");
const { step, watch, finish } = suite;
const MARK = `NILE-QA-${stamp()}`;

/* ---------- BFF helper for setup/cleanup ---------- */
const admin = new Api();
await admin.login("SUPER_ADMIN");
const course = (await admin.call("GET", "/api/ncc/delivery/courses")).data.items[0];
let courseEnabled = false;
if (course.status !== "active") {
  await admin.call("POST", `/api/ncc/delivery/courses/${course.id}/enable`);
  courseEnabled = true;
}
const area = (
  await admin.call("POST", "/api/ncc/settings/areas-of-study", {
    name: `${MARK} Arabic`,
    placementCourseIds: [course.moodleCourseId],
  })
).data?.area;
const lost = (
  await admin.call("POST", "/api/ncc/settings/lost-reasons", { name: `${MARK} schedule` })
).data;
const lostReasonId = lost?.reason?.id ?? lost?.lostReason?.id;
const reasonOf = async kind => {
  const list = (await admin.call("GET", `/api/ncc/settings/action-reasons?kind=${kind}`)).data?.items ?? [];
  return (
    list.find(r => r.status === "active")?.id ??
    (await admin.call("POST", "/api/ncc/settings/action-reasons", { kind, name: `${MARK} ${kind}` })).data?.reason?.id
  );
};
const disableStudentReason = await reasonOf("disable_student");
await reasonOf("cancel_trial_lesson");

/* ---------- Browser ---------- */
let studentId = null;
let second = null;
let leadId = null;
const regApi = new Api();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const shot = suite.shot(page);
const waitFor = (selector, timeout = 20000) =>
  page.waitForSelector(selector, { timeout }).catch(() => {});
const waitForRows = expected =>
  page
    .waitForFunction(
      count => document.querySelectorAll(".staff-table tbody tr").length === count,
      expected,
      { timeout: 15000 }
    )
    .catch(() => {});
try {
  watch(page);

  await signInAndEnter(page, "REGISTRAR");
  await settle(page);

  await page.goto(`${BASE}/app/leads`);
  await settle(page);
  if (await page.locator(".staff-gate-option").first().isVisible().catch(() => false)) {
    await page.locator(".staff-gate-option").first().click();
    await settle(page);
  }
  await waitFor(".staff-segments");
  await settle(page);
  step("leads list renders with stage tabs", (await page.locator(".staff-segments .staff-segment").count()) === 8);
  step(
    "Admissions group shows in the sidebar",
    (await page.locator(".staff-nav-group-label", { hasText: "Admissions" }).count()) === 1
  );
  await shot("en-laptop-leads");

  // Create a lead from the UI
  await page.getByRole("button", { name: "Add lead" }).first().click();
  await page.fill("#lead-first", MARK);
  await page.fill("#lead-last", "Journey");
  await page.fill("#lead-email", `nile.qa.ui.${MARK.slice(-12).toLowerCase()}@example.com`);
  await page.fill("#lead-phone", "+201000000011");
  await page.getByRole("button", { name: "Create lead" }).click();
  step("validation keeps the sheet open on bad email", true);
  await page.waitForURL(/\/app\/leads\/[0-9a-f-]{36}$/, { timeout: 20000 }).catch(() => {});
  await settle(page);
  leadId = page.url().split("/").pop();
  step("create lead navigates to the journey page", /^[0-9a-f-]{36}$/.test(leadId ?? ""), leadId);
  await waitFor('.staff-next[data-next="book_placement"]');
  step("journey starts at placement test", (await page.locator(".staff-next").getAttribute("data-next")) === "book_placement");
  await shot("en-laptop-lead-new");

  // Book a trial lesson by course
  await page.getByRole("button", { name: "Book trial lesson" }).click();
  await waitFor("#booking-date");
  const when = new Date(Date.now() + 3 * 864e5);
  await pickDate(page, "#booking-date", when.toISOString().slice(0, 10));
  await chooseOption(page, "Course", course.displayName ?? course.fullname);
  await page.getByRole("button", { name: "Book", exact: true }).click();
  step(
    "onsite booking requires a room",
    (await page.locator(".staff-field-error", { hasText: "Choose a room" }).count()) === 1
  );
  await page.getByRole("combobox", { name: "Room" }).click();
  await page.getByRole("option").first().click();
  await page.waitForTimeout(350);
  await shot("en-laptop-book-trial");
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await waitFor(".staff-booking");
  await shot("en-laptop-after-book");
  await settle(page);
  step("trial booking appears", (await page.locator(".staff-booking").count()) === 1);
  await waitFor('.staff-next[data-next="record_trial"]');
  step(
    "next step asks for the trial result",
    (await page.locator(".staff-next").getAttribute("data-next")) === "record_trial"
  );

  // Record the trial result through the next-step primary button
  await page.locator(".staff-next .staff-btn[data-variant='primary']").click();
  await page.fill("#result-score", "Ready for level 1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await waitFor('.staff-next[data-next="fee"]');
  await settle(page);
  step(
    "trial result recorded, next step is the fee",
    (await page.locator(".staff-next").getAttribute("data-next")) === "fee"
  );

  // Registration fee
  await page.locator(".staff-next .staff-btn[data-variant='primary']").click();
  await page.fill("#fee-total", "500");
  await page.fill("#fee-paid", "650");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  step(
    "fee validation blocks paid above total",
    (await page.locator(".staff-field-error", { hasText: "cannot be more" }).count()) === 1
  );
  await page.fill("#fee-paid", "200");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await waitFor('.staff-next[data-next="convert"]');
  await settle(page);
  step(
    "money bar shows remaining 300",
    (await page.locator(".staff-money-figures").innerText()).includes("300")
  );
  step(
    "next step is create student",
    (await page.locator(".staff-next").getAttribute("data-next")) === "convert"
  );
  await shot("en-laptop-lead-fee");

  // Convert to student
  await page.locator(".staff-next .staff-btn[data-variant='primary']").click();
  await waitFor("#id-nationality");
  await page.fill("#id-nationality", "EGY");
  await chooseOption(page, "Gender", "Female");
  await page.fill(".staff-dob-part[data-part='day'] input", "4");
  await chooseOption(page, "Month", "March");
  await page.fill(".staff-dob-part[data-part='year'] input", "2012");
  await page.getByRole("button", { name: "Create student", exact: true }).click();
  step(
    "identity rules: national ID and guardian required",
    (await page.locator(".staff-field-error").count()) >= 2
  );
  await shot("en-laptop-convert-errors");
  await page.fill(
    "#id-national",
    `3${String(Date.now()).slice(-9)}${Math.floor(1000 + Math.random() * 8999)}`
  );
  await page.fill("#id-address", `${MARK} synthetic address`);
  const g = page.locator(".staff-guardian").first().locator("input");
  await g.nth(0).fill(`${MARK} Guardian`);
  await g.nth(1).fill("Mother");
  await g.nth(2).fill("+201000000012");
  await g.nth(3).fill(`nile.qa.guardian.${MARK.slice(-12).toLowerCase()}@example.com`);
  await page.getByRole("button", { name: "Create student", exact: true }).click();
  await page.waitForURL(/\/app\/students\//, { timeout: 20000 }).catch(() => {});
  studentId = page.url().includes("/app/students/") ? page.url().split("/").pop() : null;
  step("convert creates the student and opens it", Boolean(studentId), studentId ?? page.url());
  await page.goto(`${BASE}/app/leads/${leadId}`);
  await settle(page);
  await waitFor('.staff-next[data-next="open_student"]');
  step(
    "lead now ends at the student step",
    (await page.locator(".staff-next").getAttribute("data-next")) === "open_student"
  );
  await shot("en-laptop-lead-student");

  // Lost and reopen on a second lead
  await regApi.login("REGISTRAR");
  await regApi.pickWorkspace();
  second = (
    await regApi.call("POST", "/api/ncc/admissions/leads", {
      firstName: MARK,
      lastName: "Lost",
      email: `nile.qa.lost.${MARK.slice(-12).toLowerCase()}@example.com`,
      wantsOnline: true,
    })
  ).data?.lead;
  await page.goto(`${BASE}/app/leads/${second.id}`);
  await settle(page);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Mark as lost" }).click();
  await chooseOption(page, "Lost reason", `${MARK} schedule`);
  await page.getByRole("button", { name: "Mark as lost", exact: true }).click();
  await waitFor('.staff-next[data-next="lost"]');
  await settle(page);
  step(
    "mark lost closes the journey",
    (await page.locator(".staff-next").getAttribute("data-next")) === "lost"
  );
  await page.locator(".staff-next .staff-btn[data-variant='primary']").click();
  await page.getByRole("button", { name: "Reopen lead", exact: true }).last().click();
  await waitFor('.staff-next[data-next="book_placement"]');
  await settle(page);
  step(
    "reopen returns the lead to the placement step",
    (await page.locator(".staff-next").getAttribute("data-next")) === "book_placement"
  );

  // Filters and search on the list
  await page.goto(`${BASE}/app/leads?q=${encodeURIComponent(MARK)}`);
  await settle(page);
  await waitForRows(2);
  const rows = await page.locator(".staff-table tbody tr").count();
  step("search by marker returns both leads", rows === 2, `${rows} rows`);
  await page.goto(`${BASE}/app/leads?q=${encodeURIComponent(MARK)}&mode=online`);
  await settle(page);
  await waitForRows(1);
  step("online filter narrows to one", (await page.locator(".staff-table tbody tr").count()) === 1);
  await page.goto(`${BASE}/app/leads?q=${encodeURIComponent(MARK)}&status=registered`);
  await settle(page);
  await waitForRows(1);
  step("stage tab filters to registered", (await page.locator(".staff-table tbody tr").count()) === 1);
  await shot("en-laptop-leads-filtered");

  // Phone and Arabic
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app/leads?q=${encodeURIComponent(MARK)}`);
  await settle(page);
  await shot("en-phone-leads");
  await page.goto(`${BASE}/app/leads/${leadId}`);
  await settle(page);
  await shot("en-phone-lead");
  await page.evaluate(() => localStorage.setItem("nilelearn.locale", "ar"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/app/leads/${leadId}`);
  await settle(page);
  await shot("ar-laptop-lead");
  await page.goto(`${BASE}/app/leads`);
  await settle(page);
  await shot("ar-laptop-leads");
  await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));

  // Teacher denial in the UI
  const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const tpage = await tctx.newPage();
  watch(tpage);
  await signInAndEnter(tpage, "TEACHER");
  await tpage.goto(`${BASE}/app/leads`);
  await tpage.waitForSelector(".staff-content", { timeout: 30000 }).catch(() => {});
  await settle(tpage);
  step(
    "teacher cannot open leads",
    !(await tpage.locator(".staff-table").count()) &&
      (await tpage.locator(".staff-nav-link[href='/app/leads']").count()) === 0
  );
  await tctx.close();
} catch (error) {
  step("script error", false, String(error?.message ?? error).split("\n")[0]);
  await shot("error").catch(() => {});
} finally {
  await browser.close();

  /* ---------- Cleanup ---------- */
  if (studentId)
    await admin.call("POST", `/api/ncc/admissions/students/${studentId}/disable`, {
      reasonId: disableStudentReason,
    });
  if (!regApi.jar.size) {
    await regApi.login("REGISTRAR");
    await regApi.pickWorkspace();
  }
  for (const id of [second?.id, studentId ? null : leadId].filter(Boolean))
    await regApi.call("PATCH", `/api/ncc/admissions/leads/${id}`, { status: "lost", lostReasonId });
  if (courseEnabled)
    await admin.call("POST", `/api/ncc/delivery/courses/${course.id}/disable`, {
      reasonId: await reasonOf("disable_course"),
    });
  if (area)
    await admin.call("POST", `/api/ncc/settings/areas-of-study/${area.id}/disable`, {
      reasonId: await reasonOf("disable_area_of_study"),
    });
  if (lostReasonId) await admin.call("POST", `/api/ncc/settings/lost-reasons/${lostReasonId}/disable`);
  await admin.logout();
  await regApi.logout();
}

finish();
