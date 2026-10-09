import {
  Api,
  BASE,
  chromium,
  creds,
  createSuite,
  pickWorkspace,
  settle,
} from "./lib.mjs";

const suite = createSuite("fix-verify");
const { step, shot, finish } = suite;
const browser = await chromium.launch();

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", msg => {
    if (msg.type() === "error") suite.consoleErrors.push(msg.text());
  });
  return { ctx, page };
}

/* 1. Deep link: logged-out visit to /app/forms?tab=fill bounces to sign-in
      with ?next=, and a successful sign-in lands back on the same URL. */
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/app/forms?tab=fill`);
  await page.waitForURL(u => u.pathname.includes("administration-login"), { timeout: 20000 });
  step(
    "logged-out /app/forms?tab=fill redirects to administration-login with next",
    new URL(page.url()).searchParams.get("next") === "/app/forms?tab=fill"
  );
  const account = creds("SUPER_ADMIN");
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page
    .waitForURL(u => u.pathname === "/app/forms", { timeout: 30000 })
    .catch(() => {});
  step(
    "after sign-in the user lands back on /app/forms?tab=fill",
    page.url().includes("/app/forms") && page.url().includes("tab=fill")
  );
  await shot(page, "deep-link-landed");
  await ctx.close();
}

/* 2. Role-view gate: HOD views as Registrar -> workspace gate -> pick branch
      -> session-scopes applies -> staff app renders (previously deadlocked). */
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/auth/administration-login`);
  const account = creds("HOD");
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => u.pathname.startsWith("/app"), { timeout: 30000 });
  await settle(page, ".staff-content", { quiet: 800 });
  // Profile menu -> View as role -> Registrar
  await page.locator(".staff-user-trigger").click();
  await page.locator(".ui-menu-item", { hasText: "View as role" }).hover();
  const registrarItem = page
    .locator(".ui-menu-item", { hasText: /^Registrar$/ })
    .last();
  await registrarItem.waitFor({ state: "visible", timeout: 15000 });
  await registrarItem.click();
  await page.waitForSelector(".staff-gate-option", { timeout: 20000 });
  step("role-view registrar shows the workspace gate", true);
  const gateOption = page.locator(".staff-gate-option").first();
  const branchName = (await gateOption.textContent())?.trim();
  await gateOption.click();
  await page.waitForSelector(".staff-content", { timeout: 30000 });
  const chip = await page.locator(".staff-roleview-chip").isVisible().catch(() => false);
  step(
    `picked "${branchName}" -> entered the app as Registrar (roleview chip visible: ${chip})`,
    chip
  );
  const failMsg = await page.locator(".staff-field-error").isVisible().catch(() => false);
  step("no inline error remains on the gate", !failMsg);
  await shot(page, "roleview-gate-fixed");
  // restore own role
  await page.locator(".staff-roleview-exit").click().catch(() => {});
  await ctx.close();
}

/* 3. Enrolments row actions: the actions button opens the menu instead of
      the stretch overlay swallowing the click. Creates its own
      pending_payment enrolment first — terminal rows render no actions. */
{
  const regApi = new Api();
  await regApi.login("REGISTRAR");
  const ws = await regApi.call("GET", "/api/auth/workspaces");
  const branchId = ws.data.items[0].id;
  await regApi.call("POST", "/api/auth/switch-workspace", { branchId });
  const students = await regApi.call("GET", "/api/ncc/admissions/students?pageSize=20");
  const courses = await regApi.call("GET", "/api/ncc/delivery/courses?pageSize=5");
  const course = courses.data?.items?.[0];
  let createdStudent = null;
  let enrolmentId = null;
  const tryEnrol = async studentId => {
    const e = await regApi.call("POST", "/api/ncc/admissions/enrolments", {
      studentId, courseId: course?.id, kind: "individual",
      branchId, toBePaid: 100, paid: 0,
    });
    return e.data?.enrolment?.id ?? null;
  };
  const existing = (students.data?.items ?? []).find(s => s.status === "active");
  if (existing && course) enrolmentId = await tryEnrol(existing.id);
  if (!enrolmentId && course) {
    // Existing students already hold an enrolment for this course (409), or
    // none are active — create a disposable student instead.
    const mk = await regApi.call("POST", "/api/ncc/admissions/students", {
      firstName: "NILE-QA", lastName: "FixVerify", nationality: "EGY",
      address: "NILE QA synthetic address", gender: "male",
      dateOfBirth: "2000-01-01", phone: "+201000088888",
      email: `nile.qa.fixverify.${Date.now()}@example.com`, branchId,
      nationalId: `3${String(Date.now()).slice(-9)}${Math.floor(1000 + Math.random() * 8999)}`,
      registration: { toBePaid: 0, paid: 0 },
    });
    createdStudent = mk.data?.student?.id ?? null;
    if (createdStudent) enrolmentId = await tryEnrol(createdStudent);
  }
  await regApi.logout();

  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/auth/administration-login`);
  const account = creds("REGISTRAR");
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes("login"), { timeout: 30000 });
  await pickWorkspace(page);
  await page.goto(`${BASE}/app/enrolments?status=all`);
  await settle(page, "table", { quiet: 1500 });
  const actionBtn = page.locator("table .staff-cell-top .staff-icon-btn").first();
  const hasRows = await actionBtn.isVisible().catch(() => false);
  if (!hasRows) {
    step("enrolments table has rows with action buttons", false);
  } else {
    await actionBtn.click();
    const menu = page.locator("[role='menu']").first();
    const opened = await menu.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
    step("clicking the row action opens the menu (overlay not swallowing)", opened);
    await shot(page, "enrolments-actions");
    await page.keyboard.press("Escape");
  }
  await ctx.close();

  // Cleanup: cancel the enrolment and disable a student created for it.
  if (enrolmentId || createdStudent) {
    const cleanup = new Api();
    await cleanup.login("REGISTRAR");
    await cleanup.call("POST", "/api/auth/switch-workspace", { branchId });
    const reasons = await cleanup.call(
      "GET", "/api/ncc/settings/action-reasons?activeOnly=true"
    );
    const items = reasons.data?.items ?? [];
    const cancelReason = items.find(r => r.kind === "cancel_enrolment");
    const disableReason = items.find(r => r.kind === "disable_student");
    if (enrolmentId && cancelReason) {
      await cleanup.call(
        "POST",
        `/api/ncc/admissions/enrolments/${enrolmentId}/cancel`,
        { reasonId: cancelReason.id }
      );
    }
    if (createdStudent && disableReason) {
      await cleanup.call(
        "POST",
        `/api/ncc/admissions/students/${createdStudent}/disable`,
        { reasonId: disableReason.id }
      );
    }
    await cleanup.logout();
  }
}

await browser.close();
finish();
