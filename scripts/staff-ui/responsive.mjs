// Responsive gate for the staff app (read-only). Every page at phone, tablet,
// laptop, desktop and wall widths. Phone and tablet widths emulate a touch
// screen, so touch-only rules (44px targets) are measured where they apply.
//
//   node --env-file=.env.local scripts/staff-ui/responsive.mjs
//
// Fails a page when, at any width: the page scrolls sideways, content sits
// off screen, a table is wider than its box without scrolling inside it, a
// heading or button label is cut off, or (on touch) a control is smaller than
// 24px (WCAG 2.5.8). Optional: STAFF_UI_LANG=ar, STAFF_UI_WIDTHS=320,1440.
import { BASE, chromium, createSuite, creds } from "./lib.mjs";

const suite = createSuite("responsive");
const LANG = process.env.STAFF_UI_LANG ?? "en";
const TOUCH = [320, 390, 768, 1024];
const DESK = [1280, 1440, 1920, 2560, 3840];
const pick = process.env.STAFF_UI_WIDTHS?.split(",").map(Number);
const widths = list => (pick ? list.filter(w => pick.includes(w)) : list);
const height = w => (w <= 430 ? 844 : w <= 1024 ? 1180 : Math.round(w * 0.5625));

const PAGES = [
  "/app/dashboard", "/app/reports", "/app/forms", "/app/notifications", "/app/profile",
  "/app/students", "/app/leads", "/app/enrolments", "/app/placement-tests", "/app/trial-lessons",
  "/app/courses", "/app/classes", "/app/rooms", "/app/staff", "/app/branches", "/app/departments",
  "/app/lost-reasons", "/app/action-reasons", "/app/areas-of-study", "/app/custom-fields",
  "/app/moodle", "/app/system", "/app/audit",
];
const DETAIL_LISTS = ["/app/students", "/app/leads", "/app/classes", "/app/courses", "/app/staff", "/app/branches", "/app/rooms"];

function measure(touch) {
  const vw = window.innerWidth;
  const describe = el => {
    const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
    const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 32);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };
  const visible = el => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const insideScroller = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.classList.contains("staff-main") || p.classList.contains("staff-app")) continue;
      if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  const scope = document.querySelector(".staff-main") ?? document.body;
  const offscreen = [];
  for (const el of scope.querySelectorAll("*")) {
    if (!visible(el) || getComputedStyle(el).position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !insideScroller(el)) offscreen.push(describe(el));
  }
  const small = [];
  if (touch) {
    for (const el of scope.querySelectorAll("button, a[href], input:not([type=hidden]), select, [role=tab]")) {
      if (!visible(el) || el.closest("p, .staff-log-text")) continue;
      // Row links stretch over the whole row with ::after; the row is the target.
      if (el.classList.contains("staff-stretch")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) small.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  const tables = [];
  for (const t of scope.querySelectorAll("table")) {
    if (!visible(t)) continue;
    if (t.scrollWidth > t.parentElement.clientWidth + 1 && !["auto", "scroll"].includes(getComputedStyle(t.parentElement).overflowX)) tables.push(describe(t));
  }
  const clipped = [];
  for (const el of scope.querySelectorAll("h1, h2, h3, .staff-btn, .staff-segment, .staff-tab, label")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== "ellipsis" && [s.overflow, s.overflowX].includes("hidden")) clipped.push(describe(el));
  }
  return {
    sideways: Math.max(document.documentElement.scrollWidth - vw, scope.scrollWidth - scope.clientWidth),
    offscreen: [...new Set(offscreen)].slice(0, 4),
    small: [...new Set(small)].slice(0, 4),
    tables,
    clipped: clipped.slice(0, 4),
  };
}

async function signedIn(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  suite.watch(page);
  const account = creds("SUPER_ADMIN");
  await page.goto(`${BASE}/auth/administration-login`);
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes("login"), { timeout: 30000 });
  await page.evaluate(l => localStorage.setItem("nilelearn.locale", l), LANG);
  return { context, page };
}

const browser = await chromium.launch();
const desk = await signedIn({ viewport: { width: 1440, height: 900 } });
for (const list of DETAIL_LISTS) {
  await desk.page.goto(`${BASE}${list}`);
  await desk.page.waitForSelector(`.staff-content a[href^='${list}/']`, { timeout: 15000 }).catch(() => {});
  const href = await desk.page.locator(`.staff-content a[href^='${list}/']`).first().getAttribute("href").catch(() => null);
  if (href) PAGES.push(href.split("?")[0]);
}
const touch = await signedIn({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const problems = new Map();
for (const path of PAGES) {
  for (const [session, list, isTouch] of [[touch, widths(TOUCH), true], [desk, widths(DESK), false]]) {
    if (!list.length) continue;
    await session.page.setViewportSize({ width: list[0], height: height(list[0]) });
    await session.page.goto(`${BASE}${path}`);
    await session.page.waitForSelector(".staff-content > *", { timeout: 20000 }).catch(() => {});
    await session.page.waitForLoadState("networkidle").catch(() => {});
    for (const w of list) {
      await session.page.setViewportSize({ width: w, height: height(w) });
      await session.page.waitForTimeout(300);
      const m = await session.page.evaluate(measure, isTouch);
      const issues = [
        m.sideways > 1 && `scrolls sideways by ${m.sideways}px`,
        m.offscreen.length && `off screen: ${m.offscreen.join("; ")}`,
        m.small.length && `small touch targets: ${m.small.join("; ")}`,
        m.tables.length && `table wider than its box: ${m.tables.join("; ")}`,
        m.clipped.length && `cut-off text: ${m.clipped.join("; ")}`,
      ].filter(Boolean);
      for (const issue of issues) {
        const key = `${path}`;
        problems.set(key, [...(problems.get(key) ?? []), `${w}px ${issue}`]);
      }
    }
  }
  const found = problems.get(path) ?? [];
  suite.step(`${LANG} ${path}`, found.length === 0, found.slice(0, 3).join(" | "));
}
await browser.close();
suite.finish();
