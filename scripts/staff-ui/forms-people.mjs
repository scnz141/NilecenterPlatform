// Forms "People" assignments: staff-member pick, teacher respondent flow,
// revoke, and the HOD teachers-of-a-class pick with derived dept labels.
import {
  BASE,
  chromium,
  createSuite,
  pickWorkspace,
  settle,
  signInAndEnter,
  stamp,
} from "./lib.mjs";

const suite = createSuite("forms-people");
const { step, watch, finish } = suite;
const mark = stamp();
const b = await chromium.launch();
const open = async role => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  watch(p);
  await signInAndEnter(p, role);
  return p;
};

const TEACHER = "Nile QA Teacher";
const slugs = [];

async function newAssignedForm(p, title) {
  await p.goto(`${BASE}/app/forms`);
  await p
    .waitForSelector(".staff-gate-option, .staff-content", { timeout: 30000 })
    .catch(() => {});
  await pickWorkspace(p);
  await settle(p, ".staff-tabs");
  await p.getByRole("button", { name: "New form" }).click();
  await p.fill("#form-title-en", title);
  await p.fill("#form-title-ar", `نموذج ${mark}`);
  // The consent template has no entity-linked questions, so a teacher who
  // cannot read the branch directory can still answer it.
  await p.locator('.ui-select[aria-label="Category"]').click();
  await p.getByRole("option", { name: "Consent" }).click();
  await p
    .locator(".staff-choice", { hasText: "Learning consent acknowledgment" })
    .click();
  await p.getByRole("button", { name: "Create form" }).click();
  await p.waitForURL(
    u => /\/app\/forms\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/forms"),
    { timeout: 30000 }
  );
  await settle(p, ".staff-builder");
  await p.getByRole("tab", { name: "Share" }).click();
  await settle(p);
  await p.getByRole("button", { name: "Publish" }).click();
  await p.waitForSelector("#form-slug");
  const slug = `nile-qa-p-${mark}-${Math.random().toString(36).slice(2, 5)}`;
  await p.fill("#form-slug", slug);
  await p.locator(".staff-choice", { hasText: "Only people I assign" }).click();
  await p.getByRole("button", { name: "Publish", exact: true }).last().click();
  await p
    .waitForSelector(`.staff-share-row:has-text("/forms/${slug}")`, {
      timeout: 20000,
    })
    .catch(() => {});
  slugs.push(slug);
  return { slug, url: p.url().replace(/\?.*/, "") };
}

async function openAssign(p, slug) {
  const row = p.locator(".staff-share-row", { hasText: `/forms/${slug}` });
  await row.getByRole("button", { name: "Assign" }).click();
  await p.waitForSelector(".staff-segment", { timeout: 15000 });
}

async function fillAssignedForm(p) {
  await p.waitForSelector(".nile-form-renderer", { timeout: 30000 });
  await settle(p);
  for (let guard = 0; guard < 6; guard++) {
    for (const input of await p
      .locator(
        ".nile-form-renderer input[type=text], .nile-form-renderer input:not([type])"
      )
      .all())
      if (!(await input.inputValue()))
        await input.fill(`NILE-QA ${mark} Teacher`);
    for (const input of await p
      .locator(".nile-form-renderer input[type=email]")
      .all())
      await input.fill(`nile.qa.teacher.${mark}@example.com`);
    for (const input of await p
      .locator(".nile-form-renderer input[type=tel]")
      .all())
      await input.fill("+201000000888");
    for (const input of await p
      .locator(".nile-form-renderer input[type=number]")
      .all())
      await input.fill("4");
    for (const input of await p
      .locator(".nile-form-renderer input[type=date]")
      .all())
      await input.fill("2026-11-21");
    for (const input of await p
      .locator(".nile-form-renderer textarea")
      .all())
      await input.fill("NILE-QA note");
    for (const group of await p
      .locator(".nile-form-choice-list, .nile-form-segmented")
      .all()) {
      const first = group.locator("input").first();
      if (await first.count()) await first.check().catch(() => {});
    }
    for (const box of await p
      .locator(".nile-form-consent-row input[type=checkbox]")
      .all())
      await box.check().catch(() => {});
    for (const select of await p
      .locator(".nile-form-renderer select")
      .all()) {
      const opts = await select.locator("option").all();
      if (opts.length > 1) await select.selectOption({ index: 1 });
    }
    const next = p.getByRole("button", { name: /^(Next|Continue)/ });
    if (await next.count()) {
      await next.first().click();
      await p.waitForTimeout(500);
      continue;
    }
    break;
  }
  await p.getByRole("button", { name: /Submit|Send/ }).last().click();
}

try {
  // ---- Super Admin: staff-member path -----------------------------------
  const sa = await open("SUPER_ADMIN");
  const first = await newAssignedForm(sa, `NILE-QA ${mark} Staff check`);
  step(
    "assigned publication listed",
    (await sa.locator(".staff-share-row", { hasText: `/forms/${first.slug}` }).count()) === 1
  );

  await openAssign(sa, first.slug);
  await sa.locator(".staff-segment", { hasText: "People" }).click();
  await sa.fill("#assign-staff-search", "QA");
  await sa
    .waitForSelector(`.staff-people-row:has-text("${TEACHER}")`, {
      timeout: 20000,
    })
    .catch(() => {});
  await sa.locator(".staff-people-row", { hasText: TEACHER }).first().click();
  step(
    "staff member row checked with a live count",
    (await sa.locator('.staff-people-row[data-active="true"]').count()) === 1 &&
      (await sa.locator(".staff-people-count", { hasText: "1 selected" }).count()) === 1 &&
      (await sa.locator(".ui-sheet button[type=submit]", { hasText: "Assign to 1 person" }).count()) === 1
  );
  await sa.screenshot({ path: `${suite.out}/people-staff.png`, fullPage: true });
  await sa.locator(".ui-sheet button[type=submit]").click();
  await sa
    .waitForSelector(`.staff-tag:has-text("${TEACHER} · Teacher")`, {
      timeout: 20000,
    })
    .catch(() => {});
  step(
    "assignment listed with server label",
    (await sa.locator(".staff-tag", { hasText: `${TEACHER} · Teacher` }).count()) === 1
  );
  await sa.screenshot({ path: `${suite.out}/assignments.png` });

  // ---- Teacher: To fill, answer, submit ----------------------------------
  const t = await open("TEACHER");
  await t.goto(`${BASE}/app/forms`);
  await settle(t, ".staff-section, .staff-empty");
  const fillRow = t.locator("li", { hasText: `NILE-QA ${mark} Staff check` });
  step(
    "teacher sees the assigned form under To fill",
    (await fillRow.getByRole("link", { name: "Fill" }).count()) === 1
  );
  await fillRow.getByRole("link", { name: "Fill" }).click();
  await t.waitForURL(u => /\/app\/forms\/fill\//.test(u.pathname), { timeout: 20000 });
  await fillAssignedForm(t);
  await t
    .waitForURL(u => u.pathname === "/app/forms", { timeout: 20000 })
    .catch(() => {});
  step(
    "teacher submit navigated back to the forms hub",
    t.url().startsWith(`${BASE}/app/forms`) && !t.url().includes("/fill/"),
    t.url()
  );
  await settle(t, ".staff-section, .staff-empty");
  const afterFill = t.locator("li", { hasText: `NILE-QA ${mark} Staff check` });
  step(
    "response recorded (Sent, Fill no longer offered)",
    (await afterFill.locator(".staff-badge", { hasText: "Sent" }).count()) === 1 &&
      (await afterFill.getByRole("link", { name: "Fill" }).count()) === 0
  );
  await t.screenshot({ path: `${suite.out}/teacher-after.png` });

  // ---- Super Admin: response visible, revoke -----------------------------
  await sa.goto(`${first.url}?tab=responses`);
  await settle(sa, ".staff-table, .staff-empty");
  step(
    "response visible to the manager",
    (await sa.locator(".staff-table tbody tr").count()) === 1
  );
  await sa.goto(first.url);
  await sa.getByRole("tab", { name: "Share" }).click();
  await settle(sa);
  await sa
    .locator(".staff-tag", { hasText: `${TEACHER} · Teacher` })
    .locator(".staff-tag-remove")
    .click();
  await sa
    .waitForSelector(`.staff-share-row:has-text("/forms/${first.slug}") .staff-tag`, {
      state: "detached",
      timeout: 15000,
    })
    .catch(() => {});
  step(
    "revoked assignment leaves the list",
    (await sa.locator(".staff-tag", { hasText: TEACHER }).count()) === 0
  );

  await t.goto(`${BASE}/app/forms`);
  await settle(t, ".staff-section, .staff-empty");
  step(
    "teacher no longer sees the form",
    (await t.locator("li", { hasText: `NILE-QA ${mark} Staff check` }).count()) === 0
  );
  await t.screenshot({ path: `${suite.out}/teacher-revoked.png` });

  // ---- HOD: teachers-of-a-class path -------------------------------------
  const hod = await open("HOD");
  const second = await newAssignedForm(hod, `NILE-QA ${mark} HOD check`);
  await openAssign(hod, second.slug);
  await hod.locator(".staff-segment", { hasText: "People" }).click();
  step(
    "HOD gets the class path directly (no staff directory)",
    (await hod.locator(".staff-segment", { hasText: "Staff member" }).count()) === 0 &&
      (await hod.locator('.ui-select[aria-label="Class"]').count()) === 1
  );
  await hod.locator('.ui-select[aria-label="Class"]').click();
  await hod.getByRole("option", { name: /NILE-QA/ }).first().click();
  await hod
    .waitForSelector(`.staff-people-row:has-text("${TEACHER}")`, { timeout: 15000 })
    .catch(() => {});
  step(
    "class teachers render as check rows",
    (await hod.locator(".staff-people-row").count()) >= 1
  );
  await hod.locator(".staff-people-row", { hasText: TEACHER }).click();
  await hod.screenshot({ path: `${suite.out}/people-class.png`, fullPage: true });
  await hod.locator(".ui-sheet button[type=submit]").click();
  await hod
    .waitForSelector(`.staff-tag:has-text("${TEACHER} · Teacher")`, {
      timeout: 20000,
    })
    .catch(() => {});
  step(
    "HOD assignment listed with the teacher's name",
    (await hod.locator(".staff-tag", { hasText: `${TEACHER} · Teacher` }).count()) === 1
  );

  // Department options must be names derived from classes, never raw ids.
  await openAssign(hod, second.slug);
  await hod.locator(".staff-segment", { hasText: "Department" }).click();
  await hod.locator('.ui-select[aria-label="Assign to"]').click().catch(async () => {
    await hod.locator(".ui-sheet .ui-select").first().click();
  });
  await hod.waitForSelector(".ui-option", { timeout: 10000 }).catch(() => {});
  const deptOptions = await hod.locator(".ui-option").allTextContents();
  step(
    "department options show names, not ids",
    deptOptions.length > 0 &&
      deptOptions.every(text => !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(text)),
    deptOptions.join(" | ")
  );
  await hod.keyboard.press("Escape");
  await hod.keyboard.press("Escape");

  // ---- Retire both publications ------------------------------------------
  for (const [p, item] of [[sa, first], [hod, second]]) {
    await p.goto(item.url);
    await p.getByRole("tab", { name: "Share" }).click();
    await settle(p);
    await p
      .locator(".staff-share-row", { hasText: `/forms/${item.slug}` })
      .getByRole("button", { name: "Retire link" })
      .click();
    await p.getByRole("button", { name: "Retire link", exact: true }).last().click();
    await settle(p);
    step(
      `publication retired (${item.slug})`,
      (await p
        .locator(".staff-share-row", { hasText: `/forms/${item.slug}` })
        .locator(".staff-badge", { hasText: "Retired" })
        .count()) === 1
    );
  }

  step(
    "no console errors",
    suite.consoleErrors.length === 0,
    suite.consoleErrors.slice(0, 3).join(" | ")
  );
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
  for (const ctx of b.contexts())
    for (const pg of ctx.pages())
      await pg
        .screenshot({
          path: `${suite.out}/error-${Math.random().toString(36).slice(2, 6)}.png`,
        })
        .catch(() => {});
} finally {
  console.log(`slugs ${slugs.join(",")}`);
  await b.close();
}

finish();
