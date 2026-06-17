import { chromium } from "playwright";
import { join } from "path";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 420, height: 380 },
  deviceScaleFactor: 3,
  colorScheme: "dark",
});
const page = await ctx.newPage();
await page.goto("http://localhost:3000/widget?locale=en&limit=7", {
  waitUntil: "networkidle", timeout: 15000,
});
await page.waitForTimeout(1000);
// Screenshot just the widget element
const el = page.locator(".widget");
await el.screenshot({ path: join(process.cwd(), "ph-screenshots", "09-widget-embed.png") });
console.log("✓ 09-widget-embed.png");
await browser.close();
