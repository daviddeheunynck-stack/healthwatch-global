/**
 * Dry-run of the new multi-country DON fan-out (parseWHODONItems).
 * Fetches real, current WHO DON items and shows what rows would be produced —
 * no DB writes. Run: npx tsx scripts/dryrun-who-multicountry-fanout.ts
 */

import { fetchWHODONList, parseWHODONItems } from "@/lib/who-api";

async function run() {
  console.log("=== Fetching live WHO OData top-40 ===");
  const items = await fetchWHODONList(40);
  console.log(`Fetched ${items.length} items\n`);

  const byDon = (id: string) => items.find((i) => (i.DonId || i.ItemDefaultUrl || "").includes(id));

  const targets = [
    ["2025-DON579", "Cholera multi-country (Chad/Congo/DRC/South Sudan/Sudan expected)"],
    ["2026-DON612", "Ebola DRC & Uganda title (DRC via fallback + Uganda via section expected)"],
    ["2026-DON611", "Hantavirus multi-country"],
    ["2026-DON610", "Yellow fever aggregate"],
  ] as const;

  for (const [id, label] of targets) {
    const item = byDon(id);
    console.log(`── ${id} — ${label} ──`);
    if (!item) { console.log("  NOT in current top-40 feed window\n"); continue; }
    console.log(`  Title: "${item.Title}"`);
    const rows = await parseWHODONItems(item);
    console.log(`  -> ${rows.length} row(s):`);
    for (const r of rows) {
      console.log(`     ${r.country_en.padEnd(20)} cases=${String(r.cases).padEnd(8)} deaths=${String(r.deaths).padEnd(6)} active=${r.active} risk=${r.risk_level}`);
    }
    console.log();
  }

  // Regression sample: confirm ordinary single-country DONs still produce
  // exactly 1 row each, unchanged in shape.
  console.log("── Regression sample: 6 arbitrary other DONs (expect exactly 1 row each) ──");
  const sample = items.filter((i) => !targets.some(([id]) => (i.DonId || i.ItemDefaultUrl || "").includes(id))).slice(0, 6);
  for (const item of sample) {
    const rows = await parseWHODONItems(item);
    const flag = rows.length === 1 ? "OK " : `** ${rows.length} rows — CHECK **`;
    console.log(`  [${flag}] "${item.Title}" -> ${rows.map(r => `${r.country_en} (${r.cases}/${r.deaths})`).join(", ") || "(skipped)"}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
