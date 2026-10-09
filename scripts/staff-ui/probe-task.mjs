// Ad-hoc verification probes: rail tooltip layering/focus, hour-cells grid
// paint persistence + mobile single-day, forms page scroll audit shots.
import { Api, BASE, chromium, createSuite, pickWorkspace, settle, signIn, stamp } from "./lib.mjs";

const suite = createSuite("probe-task");
const { step, watch, finish } = suite;
const mark = stamp();
const mode = process.argv[2] ?? "all";

const api = new Api();
await api.login("SUPER_ADMIN");
await api.pickWorkspace();
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

const b = await chromium.launch();
async function open(lang, w, h, role = "SUPER_ADMIN") {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  watch(p);
  await p.goto(`${BASE}/auth/administration-login`);
  await p.evaluate(
    ([l]) => {
      localStorage.setItem("nilelearn.locale", l);
      localStorage.setItem("nilelearn.staff.sidebar", "collapsed");
    },
    [lang]
  );
  await signIn(p, role);
  await pickWorkspace(p);
  return p;
}

/* ---------- 1. Rail tooltip --------------------------------------------- */
async function tooltipProbe(lang) {
  const p = await open(lang, 1440, 900);
  await p.goto(`${BASE}/app/forms`);
  await settle(p, ".staff-nav-link");
  const formsLink = p.locator('.staff-nav-link[href="/app/forms"]');
  await formsLink.hover();
  await p.waitForSelector(".staff-rail-tip", { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(200); // let the enter animation finish
  const info = await p.evaluate(() => {
    const tip = document.querySelector(".staff-rail-tip");
    if (!tip) return null;
    const rect = tip.getBoundingClientRect();
    const style = getComputedStyle(tip);
    // pointer-events:none skips hit-testing; flip it on to ask who is topmost.
    tip.style.pointerEvents = "auto";
    const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    tip.style.pointerEvents = "";
    return {
      parent: tip.parentElement === document.body ? "body" : tip.parentElement?.className,
      topmost: topEl === tip || tip.contains(topEl),
      below: topEl?.className ?? String(topEl),
      opacity: style.opacity,
      zIndex: style.zIndex,
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      vw: innerWidth,
    };
  });
  const expectLeft = lang === "ar" ? info && info.right > info.vw - 110 : info && info.left > 60 && info.left < 110;
  step(
    `rail tip visible, portaled, topmost (${lang})`,
    Boolean(info && info.parent === "body" && info.topmost && info.opacity === "1" && expectLeft),
    JSON.stringify(info)
  );
  await p.screenshot({ path: `${suite.out}/tip-hover-${lang}-1440.png` });
  // Keyboard focus shows it too.
  await p.evaluate(() => document.activeElement?.blur());
  await p.locator(".staff-rail-tip").waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
  await formsLink.focus();
  await p.waitForSelector(".staff-rail-tip", { timeout: 3000 }).catch(() => {});
  step(
    `rail tip shows on keyboard focus (${lang})`,
    (await p.locator(".staff-rail-tip").count()) === 1
  );
  await p.screenshot({ path: `${suite.out}/tip-focus-${lang}-1440.png` });
  // Navigation replaces the tip with the newly-hovered item's label at most —
  // once the pointer leaves the rail it must be gone.
  await p.locator('.staff-nav-link[href="/app/staff"]').first().click().catch(async () => {
    await p.locator(".staff-nav-link").nth(2).click();
  });
  await p.waitForTimeout(400);
  await p.mouse.move(700, 450);
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => {
    const tip = document.querySelector(".staff-rail-tip");
    const active = document.activeElement;
    return {
      url: location.pathname,
      tip: tip?.textContent ?? null,
      activeTag: active?.tagName,
      activeHref: active?.getAttribute?.("href"),
      fv: active?.matches?.(":focus-visible"),
      hovered: (() => {
        const link = document.elementFromPoint(60, 300)?.closest?.(".staff-nav-link");
        return link?.getAttribute("href") ?? null;
      })(),
    };
  });
  step(
    `rail tip hides on navigation (${lang})`,
    (await p.locator(".staff-rail-tip").count()) === 0,
    JSON.stringify(after)
  );
  await p.close();
}

/* ---------- 2. Hour cells grid ------------------------------------------ */
async function hoursProbe() {
  const rooms = await api.call("GET", "/api/ncc/delivery/rooms");
  const items = rooms.data?.items ?? [];
  let room = items.find(r => /nile-qa/i.test(r.name) && r.status === "active") ?? items.find(r => r.status === "active");
  let created = false;
  if (!room) {
    const made = await mutating("POST", "/api/ncc/delivery/rooms", { name: `NILE-QA Room ${mark}` });
    room = made.data?.room;
    created = true;
  }
  console.log(`room ${room?.id} ${room?.name} created=${created} status=${room?.status}`);
  if (!room) {
    step("room available for grid probe", false, "no room");
    return;
  }
  const roomUrl = `${BASE}/app/rooms/${room.id}`;

  // EN 1440: paint a block, save, reload, confirm persistence, then restore.
  const p = await open("en", 1440, 900);
  await p.goto(roomUrl);
  await settle(p, ".staff-hours-grid");
  await p.screenshot({ path: `${suite.out}/hours-en-1440.png` });
  const beforeKeys = await p
    .locator('.staff-hour-cell[data-status="available"], .staff-hour-cell[data-status="unavailable"]')
    .evaluateAll(nodes => nodes.map(n => n.getAttribute("aria-label")));
  const before = beforeKeys.length;
  // Drag-paint across two cells in a future day column (last column).
  const cells = p.locator('.staff-hour-cell[data-status="empty"]:not([disabled])');
  const count = await cells.count();
  if (count >= 4) {
    const firstCell = cells.nth(count - 3);
    const secondCell = cells.nth(count - 2);
    await firstCell.scrollIntoViewIfNeeded();
    const box1 = await firstCell.boundingBox();
    const box2 = await secondCell.boundingBox();
    await p.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
    await p.mouse.down();
    await p.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 5 });
    await p.mouse.up();
  }
  await p.waitForTimeout(400);
  const mid = await p.locator('.staff-hour-cell[data-status="available"]').count();
  step(
    "drag-paint marks cells and pins the save toast",
    mid > before && (await p.locator(".staff-bulk-bar-inner").count()) === 1,
    `available ${before} -> ${mid}`
  );
  await p.screenshot({ path: `${suite.out}/hours-painted-en-1440.png` });
  await p.locator(".staff-bulk-bar-inner button", { hasText: "Save" }).click();
  await p.waitForSelector(".staff-bulk-bar", { state: "detached", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.reload();
  await settle(p, ".staff-hours-grid");
  const persisted = await p.locator('.staff-hour-cell[data-status="available"]').count();
  step("painted hours persist after save + reload", persisted >= mid, `persisted ${persisted} vs ${mid}`);
  await p.screenshot({ path: `${suite.out}/hours-saved-en-1440.png` });
  // Restore EMS: clear every painted cell that was not in the baseline.
  if (persisted > before) {
    await p.locator(".staff-segment", { hasText: "Clear" }).click();
    const baseline = new Set(beforeKeys);
    const extras = p.locator('.staff-hour-cell[data-status="available"]:not([disabled])');
    const labels = await extras.evaluateAll(nodes =>
      nodes.map(n => n.getAttribute("aria-label")).filter(Boolean)
    );
    for (const label of labels) {
      if (baseline.has(label)) continue;
      await p.locator(`.staff-hour-cell[aria-label="${label}"]`).click().catch(() => {});
    }
    if (await p.locator(".staff-bulk-bar-inner").count()) {
      await p.locator(".staff-bulk-bar-inner button", { hasText: "Save" }).click();
      await p.waitForSelector(".staff-bulk-bar", { state: "detached", timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(500);
    }
    console.log(`restored ${labels.length - [...baseline].filter(l => labels.includes(l)).length} cells`);
  }
  await p.close();

  // 390: single-day switcher + one date column.
  const m = await open("en", 390, 844);
  await m.goto(roomUrl);
  await settle(m, ".staff-hours-grid");
  const cols = await m.locator(".staff-hours-grid thead th").count();
  step(
    "390 shows the day switcher and one day column",
    (await m.locator(".staff-hours-days").count()) === 1 && cols === 2,
    `cols ${cols}`
  );
  await m.screenshot({ path: `${suite.out}/hours-en-390.png`, fullPage: true });
  // switch day
  await m.locator(".staff-hours-days .staff-segment").nth(3).click();
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${suite.out}/hours-day3-en-390.png`, fullPage: true });
  await m.close();

  // AR 1440 + 390.
  const a = await open("ar", 1440, 900);
  await a.goto(roomUrl);
  await settle(a, ".staff-hours-grid");
  await a.screenshot({ path: `${suite.out}/hours-ar-1440.png` });
  await a.close();
  const am = await open("ar", 390, 844);
  await am.goto(roomUrl);
  await settle(am, ".staff-hours-grid");
  await am.screenshot({ path: `${suite.out}/hours-ar-390.png`, fullPage: true });
  await am.close();

  if (created) {
    const off = await mutating("POST", `/api/ncc/delivery/rooms/${room.id}/disable`, {});
    console.log(`cleanup disable ${off.status}`);
  }
}

/* ---------- 3. Forms audit shots ---------------------------------------- */
async function auditProbe() {
  for (const lang of ["en", "ar"]) {
    for (const { w, h, tag } of [
      { w: 1440, h: 900, tag: "1440" },
      { w: 1024, h: 768, tag: "1024" },
      { w: 390, h: 844, tag: "390" },
    ]) {
      const p = await open(lang, w, h);
      await p.goto(`${BASE}/app/forms`);
      await settle(p, ".staff-content");
      await p.screenshot({ path: `${suite.out}/audit-forms-${lang}-${tag}.png`, fullPage: true });
      const overflow = await p.evaluate(() => {
        const main = document.querySelector(".staff-main");
        return {
          scrollW: main?.scrollWidth,
          clientW: main?.clientWidth,
          bodyScrollW: document.documentElement.scrollWidth,
          bodyClientW: document.documentElement.clientWidth,
        };
      });
      step(
        `forms hub no horizontal overflow (${lang} ${tag})`,
        overflow.scrollW <= overflow.clientW + 1 && overflow.bodyScrollW <= overflow.bodyClientW + 1,
        JSON.stringify(overflow)
      );
      await p.close();
    }
  }
}

try {
  if (mode === "all" || mode === "tip") {
    await tooltipProbe("en");
    await tooltipProbe("ar");
    const p = await open("en", 390, 844);
    await p.goto(`${BASE}/app/forms`);
    await settle(p, ".staff-content");
    await p.screenshot({ path: `${suite.out}/tip-context-en-390.png` });
    await p.close();
  }
  if (mode === "all" || mode === "hours") await hoursProbe();
  if (mode === "all" || mode === "audit") await auditProbe();
} catch (e) {
  step("probe", false, String(e?.message ?? e).split("\n")[0]);
} finally {
  await api.logout();
  await b.close();
}

finish();
