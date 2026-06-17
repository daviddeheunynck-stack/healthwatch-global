import { chromium } from "playwright";
import { join } from "path";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5, colorScheme: "dark" });
const page = await ctx.newPage();
await page.goto(`${BASE}/en`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// Dismiss cookie banner
try {
  const btn = page.locator("button").filter({ hasText: /accept/i }).first();
  if (await btn.isVisible({ timeout: 800 })) { await btn.click(); await page.waitForTimeout(400); }
} catch {}

await page.screenshot({ path: join(process.cwd(), "ph-screenshots", "00-landing-fullpage-en.png"), fullPage: true });
console.log("✓ full-page landing screenshot");
await browser.close();
