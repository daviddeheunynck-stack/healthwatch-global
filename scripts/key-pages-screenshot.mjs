import { chromium } from "playwright";
import { join } from "path";
import { mkdir } from "fs/promises";

const BASE = "http://localhost:3000";
const OUT = join(process.cwd(), "ph-screenshots");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, colorScheme: "dark" });

async function snap(name, url) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  await p.waitForTimeout(1500);
  try {
    const btn = p.locator("button").filter({ hasText: /accept/i }).first();
    if (await btn.isVisible({ timeout: 500 })) { await btn.click(); await p.waitForTimeout(300); }
  } catch {}
  await p.screenshot({ path: join(OUT, `${name}.png`) });
  await p.close();
  console.log(`✓ ${name}`);
}

await snap("14-success-en",  `${BASE}/en/success`);
await snap("15-contact-en",  `${BASE}/en/contact`);

await browser.close();
console.log("Done.");
