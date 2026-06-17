import { chromium } from "playwright";
import { join } from "path";
import { mkdir } from "fs/promises";

const BASE = "http://localhost:3000";
const OUT = join(process.cwd(), "ph-screenshots", "audit");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" });
const page = await ctx.newPage();

await page.goto(`${BASE}/en`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);
try {
  const btn = page.locator("button").filter({ hasText: /accept/i }).first();
  if (await btn.isVisible({ timeout: 800 })) { await btn.click(); await page.waitForTimeout(400); }
} catch {}

// Scroll to various positions and screenshot
const sections = [
  { name: "hero",        y: 0 },
  { name: "stats",       y: 450 },
  { name: "live-table",  y: 950 },
  { name: "features",    y: 1600 },
  { name: "testimonials",y: 2700 },
  { name: "pricing-cta", y: 3200 },
  { name: "newsletter",  y: 3800 },
  { name: "final-cta",   y: 4200 },
];

for (const { name, y } of sections) {
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`✓ ${name} (y=${y})`);
}

await browser.close();
console.log("Done.");
