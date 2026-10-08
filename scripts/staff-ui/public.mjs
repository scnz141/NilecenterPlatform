// Public marketing pages: h1, horizontal overflow, control count, screenshots.
// Usage: node scripts/staff-ui/public.mjs [lang] [width] [height]
import { BASE, chromium, createSuite } from "./lib.mjs";
import path from "node:path";

const [lang = "en", w = "1440", h = "900"] = process.argv.slice(2);
const suite = createSuite(`public-${lang}-${w}`);
const { step, finish } = suite;
const routes = [
  "/",
  "/courses",
  "/courses/quran",
  "/verify-certificate",
  "/faq",
  "/contact",
  "/about",
  "/privacy",
  "/terms",
  "/forms/free-trial-enquiry",
  "/nope-404",
];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
await ctx.addInitScript(l => localStorage.setItem("nilelearn.locale", l), lang);
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", e => errors.push(String(e)));
try {
  for (const route of routes) {
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    const info = await p.evaluate(() => ({
      h1: document.querySelector("h1")?.textContent?.trim().slice(0, 50),
      overflow: document.documentElement.scrollWidth - innerWidth,
      controls: document.querySelectorAll("a,button,input,select,textarea").length,
    }));
    const name = route === "/" ? "home" : route.replace(/\//g, "_").slice(1);
    await p.screenshot({ path: path.join(suite.out, `pub-${lang}-${w}-${name}.png`) });
    step(`route ${route}`, info.overflow <= 0, `${info.h1 ?? "no h1"} | controls ${info.controls} | overflow ${info.overflow}`);
  }
  step("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) {
  step("script", false, String(e.message).split("\n")[0]);
} finally {
  await b.close();
}

finish();
