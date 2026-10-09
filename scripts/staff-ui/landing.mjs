// Landing page interactions: the films load nothing from YouTube until played,
// open in a centred dialog, close by Escape, button and backdrop, and return
// focus; the questions open one at a time. Read-only, no sign-in.
import { BASE, chromium, createSuite } from "./lib.mjs";

const suite = createSuite("landing");
const step = suite.step;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
suite.watch(page);
const thirdParty = [];
page.on("request", request => {
  const host = new URL(request.url()).host;
  if (/youtube|ytimg|googlevideo/.test(host)) thirdParty.push(host);
});

await page.addInitScript(() => localStorage.setItem("nilelearn.locale", "en"));
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const films = page.locator(".lh-film");
step("two films with posters served from this site", (await films.count()) === 2 &&
  (await page.locator(".lh-film-art img").evaluateAll(imgs => imgs.every(img => img.currentSrc.startsWith(location.origin) && img.complete && img.naturalWidth > 0))));
await films.first().scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
step("nothing loads from YouTube before play", thirdParty.length === 0, thirdParty.join(","));

await films.first().click();
await page.waitForTimeout(500);
const dialog = page.locator(".lh-film-dialog[open]");
step("film opens in a dialog", (await dialog.count()) === 1);
step("player uses the privacy-enhanced domain", ((await dialog.locator("iframe").getAttribute("src")) ?? "").startsWith("https://www.youtube-nocookie.com/embed/"));
const box = await dialog.boundingBox();
step("dialog is centred", box !== null && Math.abs(box.x + box.width / 2 - 720) < 4, `x=${box?.x} w=${box?.width}`);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
step("Escape closes and removes the player", (await page.locator(".lh-film-dialog[open]").count()) === 0 && (await page.locator(".lh-film-dialog iframe").count()) === 0);
step("focus returns to the film", await page.evaluate(() => document.activeElement?.classList.contains("lh-film") ?? false));

await films.nth(1).click();
await page.waitForTimeout(400);
await page.mouse.click(20, 20);
await page.waitForTimeout(300);
step("backdrop click closes", (await page.locator(".lh-film-dialog[open]").count()) === 0);

const first = page.locator(".lh-faq-item").first();
await first.scrollIntoViewIfNeeded();
await first.locator("summary").click();
await page.waitForTimeout(400);
step("a question opens", await first.evaluate(el => el.open));
await page.locator(".lh-faq-item").nth(1).locator("summary").click();
await page.waitForTimeout(400);
step("opening another closes the first", !(await first.evaluate(el => el.open)));

await browser.close();
suite.finish();
