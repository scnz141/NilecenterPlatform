// Public site in every language (no sign-in, read-only). For each page, width
// and language: the document language and direction are right, the main
// heading is translated (not the English one), and nothing sits off screen.
//   node scripts/staff-ui/public-languages.mjs
import { BASE, chromium, createSuite } from "./lib.mjs";

const suite = createSuite("public-languages");
const LANGS = ["en", "ar", "tr", "zh", "ru", "ur"];
const RTL = new Set(["ar", "ur"]);
const WIDTHS = [320, 390, 768, 1440];
const PATHS = ["/", "/courses", "/courses/arabic", "/book-free-trial", "/verify-certificate", "/faq", "/contact", "/about", "/privacy", "/terms", "/404"];

function inspect() {
  const vw = innerWidth;
  const off = [];
  for (const el of document.querySelectorAll(".lp *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || getComputedStyle(el).position === "fixed") continue;
    let clipped = false;
    for (let q = el.parentElement; q && !q.classList.contains("lp"); q = q.parentElement) {
      if (getComputedStyle(q).overflowX !== "visible") {
        clipped = true;
        break;
      }
    }
    if (!clipped && (r.right > vw + 1 || r.left < -1)) off.push(`${String(el.className || el.tagName).slice(0, 30)} "${(el.textContent || "").trim().slice(0, 30)}"`);
  }
  return {
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    h1: (document.querySelector("h1")?.textContent ?? "").trim(),
    off: off.slice(0, 3),
  };
}

const browser = await chromium.launch();
const englishH1 = new Map();
for (const lang of LANGS) {
  const problems = [];
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    suite.watch(page);
    await page.addInitScript(l => localStorage.setItem("nilelearn.locale", l), lang);
    for (const path of PATHS) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      const m = await page.evaluate(inspect);
      if (lang === "en" && width === 1440) englishH1.set(path, m.h1);
      if (m.lang !== lang) problems.push(`${path}@${width} lang=${m.lang}`);
      if (m.dir !== (RTL.has(lang) ? "rtl" : "ltr")) problems.push(`${path}@${width} dir=${m.dir}`);
      if (lang !== "en" && m.h1 && m.h1 === englishH1.get(path)) problems.push(`${path}@${width} heading still English: "${m.h1.slice(0, 40)}"`);
      if (m.off.length) problems.push(`${path}@${width} off screen: ${m.off.join("; ")}`);
    }
    await context.close();
  }
  suite.step(`${lang}: ${PATHS.length} pages x ${WIDTHS.length} widths`, problems.length === 0, problems.slice(0, 4).join(" | "));
}
await browser.close();
suite.finish();
