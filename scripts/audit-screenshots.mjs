import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE = "http://localhost:3000";
const OUT = join(process.cwd(), "ph-screenshots");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// Mobile view — EN landing
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  colorScheme: "dark",
});
const mpage = await mobile.newPage();
await mpage.goto(`${BASE}/en`, { waitUntil: "networkidle", timeout: 30000 });
await mpage.waitForTimeout(2000);
await mpage.screenshot({ path: join(OUT, "07-mobile-en.png") });
console.log("✓ 07-mobile-en.png");

// Desktop — landing page features section (scroll to ~700px)
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: "dark" });
const dpage = await desktop.newPage();
await dpage.goto(`${BASE}/en`, { waitUntil: "networkidle", timeout: 30000 });
await dpage.waitForTimeout(2000);
await dpage.evaluate(() => window.scrollTo(0, 700));
await dpage.waitForTimeout(400);
await dpage.screenshot({ path: join(OUT, "08-features-en.png") });
console.log("✓ 08-features-en.png");

await browser.close();
console.log("Done.");
