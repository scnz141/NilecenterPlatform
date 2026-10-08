// Browser walk-through of the teaching UI as Super Admin (+ teacher read-only check).
import {
  Api,
  BASE,
  chromium,
  createSuite,
  settle,
  signIn,
} from "./lib.mjs";

const suite = createSuite("teaching");
const { step, watch, finish } = suite;

const admin = new Api();
await admin.login("SUPER_ADMIN");
const CLASS = "916369b8-384a-4fc2-943c-0dc3aa7cd89e";
const cls = (await admin.call("GET", `/api/ncc/delivery/classes/${CLASS}`)).data.class;
const TEACHER = cls.teacherIds[0];
const ROOM = (await admin.call("GET", "/api/ncc/delivery/rooms")).data.items.find(
  r => r.branchId === cls.branchId
).id;
const course = (await admin.call("GET", `/api/ncc/delivery/courses/${cls.courseId}`)).data.course;
const reasonOf = async kind =>
  (await admin.call("GET", `/api/ncc/settings/action-reasons?kind=${kind}`)).data.items.find(
    r => r.status === "active"
  )?.id;
const courseWasDisabled = course.status !== "active";
if (courseWasDisabled) await admin.call("POST", `/api/ncc/delivery/courses/${cls.courseId}/enable`);
// Tue and Thu, 24 and 26 Nov 2026, 10:00-13:00 Cairo: the class's usual days (1, 3).
const cells = [];
for (const date of ["2026-11-24", "2026-11-26"])
  for (const hour of [10, 11, 12]) cells.push({ date, hour });
await admin.call("PATCH", `/api/ncc/directory/users/${TEACHER}/hour-cells`, {
  ops: cells.map(c => ({ ...c, status: "available" })),
});
await admin.call("PATCH", `/api/ncc/delivery/rooms/${ROOM}/hour-cells`, {
  ops: cells.map(c => ({ ...c, status: "available" })),
});
const before = new Set(
  ((await admin.call("GET", `/api/ncc/delivery/classes/${CLASS}/sessions`)).data?.items ?? []).map(
    s => s.id
  )
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const shot = suite.shot(page);
// The planner's /propose endpoint returns a 400 for invalid ranges by design.
watch(page, { ignoreResponses: /propose/ });
try {
  await signIn(page, "SUPER_ADMIN");
  await page.goto(`${BASE}/app/courses`);
  await settle(page, ".staff-table, .staff-empty");
  step(
    "courses list shows the linked course",
    (await page.locator(".staff-table tbody tr", { hasText: course.displayName ?? course.fullname }).count()) === 1
  );
  await shot("en-courses");
  await page.goto(`${BASE}/app/courses/${cls.courseId}`);
  await settle(page, ".staff-tiles");
  step("course page shows live demand", (await page.locator(".staff-tile").count()) === 4);
  step(
    "course page lists its class",
    (await page.locator(".staff-class-list li", { hasText: cls.name }).count()) === 1
  );
  await shot("en-course");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.waitForSelector("#course-hours");
  step("course edit shows total hours", (await page.locator("#course-hours").inputValue()) !== "");
  await shot("en-course-edit");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.goto(`${BASE}/app/classes`);
  await settle(page, ".staff-table");
  step(
    "classes list shows seats and usual time",
    (await page.locator(".staff-table tbody tr").first().innerText()).includes("Tue, Thu"),
    (await page.locator(".staff-table tbody tr").first().innerText()).replace(/\s+/g, " ").slice(0, 120)
  );
  await shot("en-classes");
  await page.goto(`${BASE}/app/classes/${CLASS}`);
  await settle(page, ".staff-segments");
  step(
    "class page opens on sessions",
    (await page.locator(".staff-facts").count()) === 1 &&
      (await page.locator(".staff-segment", { hasText: "Upcoming" }).count()) === 1
  );
  await shot("en-class-sessions");

  // Plan sessions
  await page.getByRole("button", { name: "Plan sessions" }).click();
  await page.waitForSelector("#plan-from");
  step("planner starts from the usual days", (await page.locator(".staff-plan-row").count()) === 2);
  await page.fill("#plan-to", "2026-11-29");
  await page.fill("#plan-from", "2026-11-23");
  await page.getByRole("button", { name: "Find times" }).click();
  await page.waitForSelector(".staff-proposal", { timeout: 30000 }).catch(() => {});
  step(
    "planner proposes times from availability",
    (await page.locator(".staff-proposal li").count()) === 2,
    `${await page.locator(".staff-proposal li").count()} slots`
  );
  await shot("en-plan-proposal");
  await page.getByRole("button", { name: "Book these sessions" }).click();
  await page
    .waitForFunction(() => document.querySelectorAll(".staff-session-item").length >= 2, {
      timeout: 30000,
    })
    .catch(() => {});
  await settle(page);
  step("booked sessions appear in upcoming", (await page.locator(".staff-session-item").count()) >= 2);
  await shot("en-class-booked");

  // Change time of the first upcoming session
  const firstRow = page.locator(".staff-session-item", { hasText: "Change time" }).first();
  await firstRow.getByRole("button", { name: "Change time" }).click();
  await page.waitForSelector("#session-date");
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: /^11:00/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .waitForFunction(
      () => (document.querySelector(".staff-session-item")?.innerText ?? "").includes("11:00"),
      { timeout: 20000 }
    )
    .catch(() => {});
  await settle(page);
  step(
    "session moved to 11:00",
    (await page.locator(".staff-session-item").first().innerText()).includes("11:00"),
    (await page.locator(".staff-session-item").first().innerText()).replace(/\s+/g, " ").slice(0, 80)
  );
  // Change outside availability shows the reason in place
  await page.locator(".staff-session-item").first().getByRole("button", { name: "Change time" }).click();
  await page.waitForSelector("#session-date");
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: /^18:00/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .waitForSelector('.staff-banner:has-text("No time works")', { timeout: 20000 })
    .catch(() => {});
  step(
    "moving outside availability explains why",
    (await page.locator(".staff-banner", { hasText: "No time works" }).count()) === 1
  );
  await shot("en-reschedule-blocked");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  // Cancel the last upcoming session
  await page.locator(".staff-session-item").last().getByRole("button", { name: "Cancel session" }).click();
  await page.getByRole("button", { name: "Cancel session", exact: true }).last().click();
  await page
    .waitForFunction(
      () => (document.querySelector(".staff-segment:last-child")?.innerText ?? "") !== "",
      { timeout: 20000 }
    )
    .catch(() => {});
  await settle(page);
  step(
    "cancelled session moves to Cancelled",
    (await page.locator(".staff-segment", { hasText: "Cancelled" }).innerText()).match(/\d+/)?.[0] !== "0"
  );

  await page.getByRole("tab", { name: "Students" }).click();
  await settle(page, ".staff-section");
  step(
    "students tab shows roster and paid sales",
    (await page.locator(".staff-section-title", { hasText: "Add paid students" }).count()) === 1
  );
  await shot("en-class-students");
  await page.getByRole("tab", { name: "Attendance" }).click();
  await settle(page, ".staff-attendance-item, .staff-empty");
  step("attendance lists Moodle sessions", (await page.locator(".staff-attendance-item").count()) >= 1);
  await page.locator(".staff-attendance-item").first().getByRole("button", { name: "Take attendance" }).click();
  await page.waitForSelector(".ui-sheet", { timeout: 20000 }).catch(() => {});
  step("attendance sheet opens", (await page.locator(".ui-sheet").count()) === 1);
  await shot("en-attendance-sheet");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: "Grades" }).click();
  await settle(page, ".staff-empty, .staff-table");
  await shot("en-class-grades");

  await page.goto(`${BASE}/app/rooms`);
  await settle(page, ".staff-table");
  step("rooms list", (await page.locator(".staff-table tbody tr").count()) >= 1);
  await page.goto(`${BASE}/app/rooms/${ROOM}`);
  await settle(page, ".staff-hours-grid, .staff-section");
  await shot("en-room");

  // Phone and Arabic
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app/classes/${CLASS}`);
  await settle(page, ".staff-segments");
  await shot("en-phone-class");
  await page.evaluate(() => localStorage.setItem("nilelearn.locale", "ar"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/app/classes/${CLASS}`);
  await settle(page, ".staff-segments");
  await shot("ar-class");
  await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));

  // Teacher read-only
  const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const tp = await tctx.newPage();
  watch(tp, { ignoreResponses: /propose/ });
  await signIn(tp, "TEACHER");
  await tp.goto(`${BASE}/app/classes/${CLASS}`);
  await tp.waitForSelector(".staff-segments", { timeout: 30000 }).catch(() => {});
  await settle(tp);
  step(
    "teacher sees the class without planning",
    (await tp.locator("button", { hasText: "Plan sessions" }).count()) === 0 &&
      (await tp.locator(".staff-hint", { hasText: "branch team" }).count()) === 1
  );
  await tp.screenshot({ path: `${suite.out}/en-teacher-class.png` });
  await tctx.close();
  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
  await shot("error").catch(() => {});
} finally {
  await browser.close();
  const after = ((await admin.call("GET", `/api/ncc/delivery/classes/${CLASS}/sessions`)).data?.items ?? []).filter(
    s => !before.has(s.id) && s.status === "scheduled"
  );
  for (const s of after) await admin.call("POST", `/api/ncc/delivery/sessions/${s.id}/cancel`, {});
  await admin.call("PATCH", `/api/ncc/directory/users/${TEACHER}/hour-cells`, {
    ops: cells.map(c => ({ ...c, status: null })),
  });
  await admin.call("PATCH", `/api/ncc/delivery/rooms/${ROOM}/hour-cells`, {
    ops: cells.map(c => ({ ...c, status: null })),
  });
  if (courseWasDisabled)
    await admin.call("POST", `/api/ncc/delivery/courses/${cls.courseId}/disable`, {
      reasonId: await reasonOf("disable_course"),
    });
  await admin.logout();
  console.log(`cleanup: cancelled ${after.length} new sessions`);
}

finish();
