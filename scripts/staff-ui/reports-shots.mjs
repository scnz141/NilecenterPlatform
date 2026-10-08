// Screenshot pass for /app/reports: every report x 1440/2560/390 x en+ar.
import { BASE, chromium, createSuite, settle, signIn } from "./lib.mjs";

const suite = createSuite("reports-shots");
const { finish } = suite;

const REPORTS = ["admissions", "bookings", "enrolments", "classes"];
const SIZES = [
  { w: 1440, h: 900 },
  { w: 2560, h: 1200 },
  { w: 390, h: 844 },
];

const b = await chromium.launch();
for (const lang of ["en", "ar"]) {
  for (const { w, h } of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/auth/administration-login`);
    await p.evaluate(l => localStorage.setItem("nilelearn.locale", l), lang);
    await signIn(p, "SUPER_ADMIN");
    for (const report of REPORTS) {
      await p.goto(`${BASE}/app/reports?report=${report}${report === "classes" ? "" : "&period=30d"}`);
      await settle(p, ".staff-tile-value, .staff-empty");
      await p.waitForTimeout(400);
      await p.screenshot({
        path: `${suite.out}/rep-${report}-${lang}-${w}.png`,
        fullPage: false,
      });
      console.log(`shot rep-${report}-${lang}-${w}.png`);
    }
    await p.close();
    await ctx.close();
  }
}
// Extra checkpoint: 1024px catches the 2-column breakpoint edge in English.
{
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/auth/administration-login`);
  await p.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));
  await signIn(p, "SUPER_ADMIN");
  for (const report of ["admissions", "enrolments"]) {
    await p.goto(`${BASE}/app/reports?report=${report}&period=30d`);
    await settle(p, ".staff-tile-value, .staff-empty");
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${suite.out}/rep-${report}-en-1024.png` });
    console.log(`shot rep-${report}-en-1024.png`);
  }
  await p.close();
  await ctx.close();
}
await b.close();
finish();
