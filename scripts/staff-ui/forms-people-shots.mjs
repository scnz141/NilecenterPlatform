// Screenshot pass for the Forms share tab People picker and assignment list:
// staff-member path, teachers-of-a-class path, and the labelled assignment
// chips — English and Arabic at 1440 and 390.
import { Api, BASE, chromium, createSuite, settle, signIn } from "./lib.mjs";

const suite = createSuite("forms-people-shots");
const { finish } = suite;
const mark = `shots-${Math.random().toString(36).slice(2, 7)}`;
const TEACHER_ID = "0e6b22ad-3a53-462e-a907-42e24d4df2f1";
const SIZES = [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
];

const api = new Api();
await api.login("SUPER_ADMIN");
const b = await chromium.launch();
const mutating = (method, url, body) =>
  fetch(BASE + url, {
    method,
    headers: {
      Cookie: [...api.jar].map(([k, v]) => `${k}=${v}`).join("; "),
      "Content-Type": "application/json",
      "X-Nile-Learn-Request": "browser",
      Origin: BASE,
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

// Build a form + assigned publication + one person assignment once, then just
// re-frame it per locale/size.
const created = await mutating("POST", "/api/forms/definitions", {
  key: `nile_people_shots_${mark}`,
  titleEn: `NILE-QA ${mark} Consent`,
  titleAr: `موافقة ${mark}`,
  titleTr: `NILE-QA ${mark} Consent`,
  category: "consent",
  templateKey: "consent",
});
const defId = created.data?.definition?.id;
const def = await api.call("GET", `/api/forms/definitions/${defId}`);
const draft = (def.data?.versions ?? []).find(v => v.status === "draft");
const slug = `nile-qa-shots-${mark}`;
await mutating("POST", `/api/forms/definitions/${defId}/versions/${draft.id}/publish`, {
  slug,
  audience: "assigned",
  allowMultiple: false,
  allowDrafts: true,
});
const defAfter = await api.call("GET", `/api/forms/definitions/${defId}`);
const pub = (defAfter.data?.publications ?? []).find(p => p.slug === slug);
const assigned = await mutating("POST", `/api/forms/publications/${pub.id}/assignments`, {
  target: { type: "user", userId: TEACHER_ID },
});
console.log("setup:", created.status, "pub", pub?.id, "assign", assigned.status, JSON.stringify(assigned.data?.targetLabel));
const formUrl = `${BASE}/app/forms/${defId}?tab=share`;

try {
  for (const lang of ["en", "ar"]) {
    for (const { w, h } of SIZES) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/auth/administration-login`);
      await p.evaluate(l => localStorage.setItem("nilelearn.locale", l), lang);
      await signIn(p, "SUPER_ADMIN");
      await p.goto(formUrl);
      await settle(p, ".staff-share-row");
      // Assignment list with server-generated names.
      await p.waitForSelector(".staff-tag", { timeout: 15000 }).catch(() => {});
      await p.screenshot({ path: `${suite.out}/people-list-${lang}-${w}.png` });

      // People -> Staff member path.
      await p
        .locator(".staff-share-row", { hasText: `/forms/${slug}` })
        .getByRole("button", { name: lang === "ar" ? "إسناد" : "Assign" })
        .click();
      await p.waitForSelector(".staff-segment", { timeout: 15000 });
      await p.locator(".staff-segment", { hasText: lang === "ar" ? "أشخاص" : "People" }).click();
      await p.fill('input[type="search"]', "QA");
      await p
        .waitForSelector('.staff-people-row', { timeout: 15000 })
        .catch(() => {});
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${suite.out}/people-staff-${lang}-${w}.png` });

      // People -> Teachers of a class path.
      await p
        .locator(".staff-segment", {
          hasText: lang === "ar" ? "معلمو صف" : "Teachers of a class",
        })
        .click();
      await p.locator(".ui-sheet .ui-select").first().click();
      await p.waitForSelector(".ui-option", { timeout: 10000 }).catch(() => {});
      await p.getByRole("option", { name: /NILE-QA/ }).first().click().catch(() => {});
      await p.waitForSelector(".staff-people-row", { timeout: 10000 }).catch(() => {});
      await p.locator(".staff-people-row").first().click().catch(() => {});
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${suite.out}/people-class-${lang}-${w}.png` });
      console.log(`shots ${lang} ${w}`);
      await p.close();
      await ctx.close();
    }
  }
} finally {
  for (const a of (defAfter.data?.assignments ?? [])) {
    if (!a.revokedAt) {
      const rv = await mutating("POST", `/api/forms/assignments/${a.id}/revoke`, {});
      console.log("revoked", a.id, rv.status);
    }
  }
  const rt = await mutating("POST", `/api/forms/publications/${pub.id}/retire`, {});
  console.log("retired", slug, rt.status);
  await api.logout();
  await b.close();
}
finish();
