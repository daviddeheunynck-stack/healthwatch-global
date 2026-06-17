/**
 * Dry-run validation for the three HTML/RSS scrapers.
 * Run: npx tsx scripts/validate-scrapers.ts
 */

const HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":     "application/rss+xml,text/html,*/*",
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function checkECDC(): Promise<void> {
  console.log("── ECDC Epidemiological Update RSS ─────────────────────────────────");
  const xml   = await fetchText("https://www.ecdc.europa.eu/en/taxonomy/term/1310/feed");
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  if (items.length === 0) throw new Error("No items found in RSS feed");
  console.log(`  Items: ${items.length}`);
  items.slice(0, 3).forEach(m => {
    const title = m[1].match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    const date  = m[1].match(/<pubDate>([^<]+)/i)?.[1]?.trim();
    console.log(`  · ${title?.slice(0, 70)} (${date?.slice(0, 16)})`);
  });
}

async function checkPAHO(): Promise<void> {
  console.log("── PAHO Epidemiological Alerts ──────────────────────────────────────");
  const html  = await fetchText("https://www.paho.org/en/epidemiological-alerts-and-updates");
  const links = [...html.matchAll(/<a\s[^>]*href="(\/en\/[^"]*(?:epidemiological-alert|epidemiological-update|epi-alert|epi-update)[^"]*)"[^>]*>([^<]+)<\/a>/gi)];
  if (links.length === 0) throw new Error("No alert links found on PAHO page");
  console.log(`  Alert links: ${links.length}`);
  links.slice(0, 3).forEach(m => console.log(`  · ${m[2].trim().slice(0, 70)}`));
}

async function checkAfricaCDC(): Promise<void> {
  console.log("── Africa CDC /news-item/ ───────────────────────────────────────────");
  const html  = await fetchText("https://africacdc.org/news-item/");
  const links = [...new Set(
    [...html.matchAll(/href="(https?:\/\/africacdc\.org\/news-item\/[^"/][^"]+)"/gi)].map(m => m[1])
  )].filter(u => !u.includes("/feed") && !u.includes("/page/"));
  if (links.length === 0) throw new Error("No article links found on Africa CDC /news-item/");
  console.log(`  Article links: ${links.length}`);
  links.slice(0, 3).forEach(u => console.log(`  · ${u.split("/").slice(-2, -1)[0]?.slice(0, 70)}`));
}

async function run() {
  console.log("=== Scraper Validation ===\n");
  const results: [string, string][] = [];

  for (const [name, fn] of [
    ["ECDC RSS", checkECDC],
    ["PAHO", checkPAHO],
    ["Africa CDC", checkAfricaCDC],
  ] as [string, () => Promise<void>][]) {
    try {
      await fn();
      results.push([name, "✅ OK"]);
    } catch (e) {
      console.error(`\n  ❌ ${name} FAILED: ${e}`);
      results.push([name, "❌ FAILED"]);
    }
    console.log();
  }

  console.log("─────────────────────────────────────────────");
  results.forEach(([k, v]) => console.log(`${v}  ${k}`));
  console.log("─────────────────────────────────────────────\n");

  if (results.some(([, v]) => v.startsWith("❌"))) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
