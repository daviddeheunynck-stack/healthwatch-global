/**
 * Product Hunt gallery screenshots — 1280×800px @2x
 * Run:  node scripts/ph-screenshots.mjs
 * Requires dev server at localhost:3000
 */

import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE = "http://localhost:3000";
const OUT  = join(process.cwd(), "ph-screenshots");

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({
  viewport:  { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await ctx.newPage();

async function snap(name, url, { scrollY = 0, waitMs = 2500 } = {}) {
  console.log(`→ ${name}  ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(waitMs);

  // Dismiss cookie banner if present
  try {
    const btn = page.locator("button").filter({ hasText: /accept|accepter|aceptar|قبول|terima/i }).first();
    if (await btn.isVisible({ timeout: 800 })) { await btn.click(); await page.waitForTimeout(400); }
  } catch {}

  if (scrollY > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(400);
  }

  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`   ✓ ${path}`);
}

// 1 — Landing EN
await snap("01-dashboard-en", `${BASE}/en`);

// 2 — Landing FR  (proves multilingual)
await snap("02-dashboard-fr", `${BASE}/fr`);

// 3 — Alerts page (updated wording, no Starter)
await snap("03-alerts-en", `${BASE}/en/alerts`);

// 4 — Reports page (now says "Pro plan" only)
await snap("04-reports-en", `${BASE}/en/reports`);

// 5 — Pricing page, scrolled to show Pro card
await snap("05-pricing-en", `${BASE}/en/pricing`, { scrollY: 320 });

// 6 — Compare tool (killer feature, data-rich)
await snap("06-compare-en", `${BASE}/en/compare`);

await browser.close();
console.log("\n✅  Done — ph-screenshots/");
