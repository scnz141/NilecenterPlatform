// Browser walk-through of Nile Forms: builder, publish, public submit, response->lead.
import {
  BASE,
  chromium,
  createSuite,
  pickWorkspace,
  settle,
  signInAndEnter,
  stamp,
} from "./lib.mjs";

const suite = createSuite("forms");
const { step, watch, finish } = suite;
const mark = stamp();
const b = await chromium.launch();
const login = async (role, ctxOpts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...ctxOpts });
  const p = await ctx.newPage();
  watch(p);
  return p;
};
let slug = "";
try {
  const p = await login("REGISTRAR");
  await signInAndEnter(p, "REGISTRAR");
  await p.goto(`${BASE}/app/forms`);
  await p.waitForSelector(".staff-gate-option, .staff-content", { timeout: 30000 }).catch(() => {});
  await pickWorkspace(p);
  await settle(p, ".staff-tabs");
  step(
    "forms hub shows My forms, Responses, To fill",
    (await p.locator(".staff-tab").count()) === 3
  );
  await p.screenshot({ path: `${suite.out}/hub.png` });

  await p.getByRole("button", { name: "New form" }).click();
  await p.fill("#form-title-en", `NILE-QA ${mark} Enquiry`);
  await p.fill("#form-title-ar", `استفسار ${mark}`);
  await p.locator(".staff-choice", { hasText: "Free trial enquiry" }).click();
  await p.getByRole("button", { name: "Create form" }).click();
  await p.waitForURL(u => /\/app\/forms\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/forms"), {
    timeout: 30000,
  });
  await settle(p, ".staff-builder");
  const questions = await p.locator(".staff-q-card").count();
  step("new form opens in the builder with the template's questions", questions >= 3, `${questions} questions`);
  await p.screenshot({ path: `${suite.out}/builder.png` });

  // Add a choice question
  await p.getByRole("button", { name: "Add a question" }).first().click();
  await p.getByRole("menuitem", { name: "One choice" }).click();
  await p.waitForTimeout(300);
  await p.getByLabel("Question (English)").last().fill("Preferred time");
  await p.getByLabel("Question (Arabic)").last().fill("الوقت المفضل");
  await p.getByLabel("Choice (English) 1").fill("Mornings");
  await p.getByLabel("Choice (English) 2").fill("Evenings");
  step(
    "old record-link question is flagged",
    (await p.locator(".staff-banner", { hasText: "old record links" }).count()) === 1
  );
  await p.locator(".staff-q-card", { hasText: "Preferred branch" }).click();
  await p.getByRole("button", { name: "Use our branch list" }).click();
  await p.waitForSelector('.staff-banner:has-text("old record links")', { state: "detached", timeout: 10000 }).catch(() => {});
  step(
    "branch question now uses EMS branches",
    (await p.locator(".staff-banner", { hasText: "old record links" }).count()) === 0
  );
  step(
    "unsaved changes are flagged",
    (await p.locator(".staff-builder-bar", { hasText: "Unsaved changes" }).count()) === 1
  );
  await p.getByRole("button", { name: "Save draft" }).click();
  await p
    .waitForSelector('.staff-builder-bar:has-text("Unsaved changes")', { state: "detached", timeout: 15000 })
    .catch(() => {});
  step(
    "draft saves",
    (await p.locator(".staff-builder-bar", { hasText: "Unsaved changes" }).count()) === 0
  );
  step(
    "preview shows the new question",
    (await p.locator(".staff-builder-preview", { hasText: "Preferred time" }).count()) === 1
  );
  await p.screenshot({ path: `${suite.out}/builder-edited.png` });

  // Publish
  await p.getByRole("tab", { name: "Share" }).click();
  await settle(p);
  await p.getByRole("button", { name: "Publish" }).click();
  await p.waitForSelector("#form-slug");
  slug = `nile-qa-${mark}`;
  await p.fill("#form-slug", slug);
  await p.locator(".staff-choice", { hasText: "Anyone with the link" }).click();
  await p.getByRole("button", { name: "Publish", exact: true }).last().click();
  await p
    .waitForSelector(`.staff-share-row:has-text("/forms/${slug}")`, { timeout: 20000 })
    .catch(() => {});
  await settle(p);
  step("published link listed", (await p.locator(".staff-share-row", { hasText: `/forms/${slug}` }).count()) === 1);
  await p.screenshot({ path: `${suite.out}/share.png` });
  const formUrl = p.url().replace(/\?.*/, "");

  // Public respondent
  const pub = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  watch(pub);
  await pub.goto(`${BASE}/forms/${slug}`);
  await pub.waitForSelector(".nile-form-renderer", { timeout: 30000 });
  await settle(pub);
  for (let guard = 0; guard < 6; guard++) {
    for (const input of await pub
      .locator(".nile-form-renderer input[type=text], .nile-form-renderer input:not([type])")
      .all())
      if (!(await input.inputValue())) await input.fill(`NILE-QA ${mark} Parent`);
    for (const input of await pub.locator(".nile-form-renderer input[type=email]").all())
      await input.fill(`nile.qa.form.${mark}@example.com`);
    for (const input of await pub.locator(".nile-form-renderer input[type=tel]").all())
      await input.fill("+201000000777");
    for (const input of await pub.locator(".nile-form-renderer input[type=number]").all())
      await input.fill("10");
    for (const input of await pub.locator(".nile-form-renderer input[type=date]").all())
      await input.fill("2026-11-20");
    for (const input of await pub.locator(".nile-form-renderer textarea").all())
      await input.fill("NILE-QA note");
    for (const group of await pub.locator(".nile-form-choice-list, .nile-form-segmented").all()) {
      const first = group.locator("input").first();
      if (await first.count()) await first.check().catch(() => {});
    }
    for (const box of await pub.locator(".nile-form-consent-row input[type=checkbox]").all())
      await box.check().catch(() => {});
    for (const select of await pub.locator(".nile-form-renderer select").all()) {
      const opts = await select.locator("option").all();
      if (opts.length > 1) await select.selectOption({ index: 1 });
    }
    const next = pub.getByRole("button", { name: /^(Next|Continue)/ });
    if (await next.count()) {
      await next.first().click();
      await pub.waitForTimeout(500);
      continue;
    }
    break;
  }
  await pub.screenshot({ path: `${suite.out}/public-filled.png`, fullPage: true });
  await pub.getByRole("button", { name: /Submit|Send/ }).last().click();
  // The success state replaces the renderer; wait up to 20 s for it.
  await pub.waitForSelector(".nile-form-success", { timeout: 20000 }).catch(() => {});
  step(
    "public visitor submits the form",
    (await pub.locator(".nile-form-success").count()) === 1
  );
  await pub.screenshot({ path: `${suite.out}/public-sent.png`, fullPage: true });

  // Responses and lead
  await p.goto(`${formUrl}?tab=responses`);
  await settle(p, ".staff-table, .staff-empty");
  step("response appears on the form", (await p.locator(".staff-table tbody tr").count()) === 1);
  await p.locator(".staff-table tbody tr a").first().click();
  await settle(p, ".staff-answers");
  step(
    "response shows answers in words",
    (await p.locator(".staff-answer", { hasText: "Preferred time" }).count()) === 1
  );
  await p.screenshot({ path: `${suite.out}/response.png` });
  await p.getByRole("button", { name: "Create lead" }).click();
  await p.waitForSelector("#lead-email", { timeout: 15000 }).catch(() => {});
  const prefilled = await p.locator("#lead-email").inputValue().catch(() => "");
  step("lead form is prefilled from the answers", prefilled.includes(`nile.qa.form.${mark}`), prefilled);
  await p.screenshot({ path: `${suite.out}/lead-prefill.png` });
  await p.locator(".ui-sheet button[type=submit]").click();
  await p
    .waitForSelector('.staff-banner:has-text("Lead created")', { timeout: 30000 })
    .catch(() => {});
  await settle(p);
  step(
    "lead created and linked on the response",
    (await p.locator(".staff-banner", { hasText: "Lead created" }).count()) === 1
  );
  await p.screenshot({ path: `${suite.out}/response-lead.png` });

  // Teacher and Super Admin
  const t = await login("TEACHER");
  await signInAndEnter(t, "TEACHER");
  await t.goto(`${BASE}/app/forms`);
  await settle(t, ".staff-section, .staff-empty");
  step(
    "teacher sees only To fill",
    (await t.locator(".staff-tab").count()) === 0 &&
      (await t.locator("h1", { hasText: "Forms" }).count()) === 1
  );
  await t.screenshot({ path: `${suite.out}/teacher.png` });
  const sa = await login("SUPER_ADMIN");
  await signInAndEnter(sa, "SUPER_ADMIN");
  await sa.goto(`${BASE}/app/forms/import`);
  await settle(sa, ".staff-section");
  step(
    "Super Admin opens Jotform import",
    (await sa.locator("h1", { hasText: "Import from Jotform" }).count()) === 1
  );
  await sa.screenshot({ path: `${suite.out}/import.png` });
  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 3).join(" | "));
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
  for (const ctx of b.contexts())
    for (const pg of ctx.pages())
      await pg.screenshot({ path: `${suite.out}/error-${Math.random().toString(36).slice(2, 6)}.png` }).catch(() => {});
} finally {
  console.log(`slug ${slug}`);
  await b.close();
}

finish();
