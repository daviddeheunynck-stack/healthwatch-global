import { chromium } from "playwright";
import { join } from "path";
import { mkdir } from "fs/promises";

const BASE = "http://localhost:3000";
const OUT = join(process.cwd(), "ph-screenshots");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function snap(name, url, ctx, { scrollY = 0, waitMs = 2000 } = {}) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(waitMs);
  try {
    const btn = page.locator("button").filter({ hasText: /accept/i }).first();
    if (await btn.isVisible({ timeout: 600 })) { await btn.click(); await page.waitForTimeout(300); }
  } catch {}
  if (scrollY) { await page.evaluate((y) => window.scrollTo(0, y), scrollY); await page.waitForTimeout(300); }
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  await page.close();
  console.log(`✓ ${name}`);
}

// Desktop context
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: "dark" });

// Widget — dark theme, English
await snap("09-widget-dark", `${BASE}/widget?locale=en&limit=7`, desk);

// Signup page
await snap("10-signup-en", `${BASE}/en/signup`, desk);

// About page
await snap("11-about-en", `${BASE}/en/about`, desk);

// Docs page (API docs — Enterprise sell)
await snap("12-docs-en", `${BASE}/en/docs`, desk);

await browser.close();
console.log("Done.");
