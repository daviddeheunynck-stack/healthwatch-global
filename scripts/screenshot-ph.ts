/**
 * Playwright script — captures 4 Product Hunt screenshot assets.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/screenshot-ph.ts
 *   or: npx tsx scripts/screenshot-ph.ts
 *
 * Output: public/screenshots/ph/
 *   01-dashboard-full.png         1280×900  full dashboard hero
 *   02-outbreaks-table.png        1280×700  outbreak table + trend badges
 *   03-demo-banner.png            1280×160  demo banner close-up
 *   04-cfr-close-up.png           900×600   CFR/trend badge zoom
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = "https://healthwatch-global.com";
const DEMO_URL = `${BASE_URL}/en?demo=1`;
const OUT_DIR = path.join(process.cwd(), "public", "screenshots", "ph");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });

  const page = await context.newPage();

  // --- 1. Full dashboard hero ---
  console.log("📸 1/4  Full dashboard…");
  await page.goto(DEMO_URL, { waitUntil: "networkidle" });
  // Wait for outbreak table to appear
  await page.waitForSelector("table, [data-testid='outbreaks']", { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT_DIR, "01-dashboard-full.png"), fullPage: false });
  console.log("    ✅ 01-dashboard-full.png");

  // --- 2. Outbreak table (scroll down slightly) ---
  console.log("📸 2/4  Outbreak table…");
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.screenshot({ path: path.join(OUT_DIR, "02-outbreaks-table.png") });
  console.log("    ✅ 02-outbreaks-table.png");

  // --- 3. Demo banner close-up ---
  console.log("📸 3/4  Demo banner…");
  await page.evaluate(() => window.scrollTo(0, 0));
  // Resize viewport to banner height only
  await page.setViewportSize({ width: 1280, height: 160 });
  await page.screenshot({ path: path.join(OUT_DIR, "03-demo-banner.png") });
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log("    ✅ 03-demo-banner.png");

  // --- 4. CFR / trend badge zoom — resize for square-ish crop ---
  console.log("📸 4/4  CFR close-up…");
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto(DEMO_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollBy(0, 280));
  await page.screenshot({ path: path.join(OUT_DIR, "04-cfr-close-up.png") });
  console.log("    ✅ 04-cfr-close-up.png");

  await browser.close();

  console.log(`\n✅ All screenshots saved to ${OUT_DIR}`);
  console.log("   Upload to Product Hunt (1280×800 recommended):");
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"));
  files.forEach((f) => console.log(`   → ${f}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
