// Branch Admin live check for the Forms "People" assign path: sign in as
// EMS_QA_BRANCH_ADMIN, pick the nile-qa workspace, open Assign -> People ->
// Staff member — the staff directory must load (200) and assigning the QA
// teacher must return 201.
import { Api, BASE, chromium, createSuite, settle, signIn, stamp } from "./lib.mjs";

const suite = createSuite("forms-people-ba-shot");
const { step, watch, finish } = suite;
const mark = stamp();
const TEACHER = "Nile QA Teacher";

const api = new Api();
await api.login("BRANCH_ADMIN");
const workspaces = (await api.call("GET", "/api/auth/workspaces")).data?.items ?? [];
const workspace = workspaces.find(item => /nile-qa/i.test(item.name)) ?? workspaces[0];
if (workspace) await api.call("POST", "/api/auth/switch-workspace", { branchId: workspace.id });

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

const created = await mutating("POST", "/api/forms/definitions", {
  key: `nile_ba_people_${mark}`,
  titleEn: `NILE-QA BA people ${mark}`,
  titleAr: `نموذج ${mark}`,
  titleTr: `NILE-QA BA people ${mark}`,
  category: "consent",
  templateKey: "consent",
  branchId: workspace?.id,
});
const defId = created.data?.definition?.id;
const def = await api.call("GET", `/api/forms/definitions/${defId}`);
const draft = (def.data?.versions ?? []).find(v => v.status === "draft");
const slug = `nile-qa-ba-${mark}`;
await mutating("POST", `/api/forms/definitions/${defId}/versions/${draft.id}/publish`, {
  slug,
  audience: "assigned",
  allowMultiple: false,
  allowDrafts: true,
});
const defAfter = await api.call("GET", `/api/forms/definitions/${defId}`);
const pub = (defAfter.data?.publications ?? []).find(p => p.slug === slug);
console.log(`setup def ${defId} pub ${pub?.id} workspace ${workspace?.name}`);

const b = await chromium.launch();
let directoryStatus = 0;
let assignStatus = 0;
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  watch(p);
  p.on("response", response => {
    const url = response.url();
    if (url.includes("/api/ncc/directory/users")) directoryStatus = response.status();
    if (/\/api\/forms\/publications\/[^/]+\/assignments/.test(url) && response.request().method() === "POST")
      assignStatus = response.status();
  });
  await signIn(p, "BRANCH_ADMIN");
  // Pick the QA branch workspace when the gate offers it.
  const gate = p.locator(".staff-gate-option", { hasText: /nile-qa/i }).first();
  if (await gate.isVisible().catch(() => false)) await gate.click();
  else await p.locator(".staff-gate-option").first().click().catch(() => {});
  await p.waitForSelector(".staff-content", { timeout: 30000 }).catch(() => {});

  await p.goto(`${BASE}/app/forms/${defId}?tab=share`);
  await settle(p, ".staff-share-row");
  await p
    .locator(".staff-share-row", { hasText: `/forms/${slug}` })
    .getByRole("button", { name: "Assign" })
    .click();
  await p.waitForSelector(".staff-segment", { timeout: 15000 });
  await p.locator(".staff-segment", { hasText: "People" }).click();
  await p.waitForSelector("#assign-staff-search", { timeout: 15000 }).catch(() => {});
  await p.fill("#assign-staff-search", "QA");
  await p
    .waitForSelector(`.staff-people-row:has-text("${TEACHER}")`, { timeout: 20000 })
    .catch(() => {});
  step(
    "staff directory loads for branch_admin (200)",
    directoryStatus === 200 &&
      (await p.locator(".staff-people-row").count()) >= 1,
    `directory ${directoryStatus}, rows ${await p.locator(".staff-people-row").count()}`
  );
  await p.locator(".staff-people-row", { hasText: TEACHER }).first().click();
  await p.screenshot({ path: `${suite.out}/ba-people-pick.png` });
  await p.locator(".ui-sheet button[type=submit]").click();
  await p
    .waitForSelector(`.staff-tag:has-text("${TEACHER}")`, { timeout: 20000 })
    .catch(() => {});
  step(
    "assigning a person returns 201",
    assignStatus === 201,
    `assign ${assignStatus}`
  );
  await p.screenshot({ path: `${suite.out}/ba-assigned.png` });
} finally {
  for (const a of defAfter.data?.assignments ?? []) {
    if (!a.revokedAt) await mutating("POST", `/api/forms/assignments/${a.id}/revoke`, {});
  }
  const fresh = await api.call("GET", `/api/forms/definitions/${defId}`);
  for (const a of fresh.data?.assignments ?? []) {
    if (!a.revokedAt) await mutating("POST", `/api/forms/assignments/${a.id}/revoke`, {});
  }
  if (pub) await mutating("POST", `/api/forms/publications/${pub.id}/retire`, {});
  await api.logout();
  await b.close();
}

finish();
