// Replays every row of the outbreaks table through the real classifier in
// lib/source-trust.ts and reports what the public site would badge.
//
// Read-only. Run it before shipping any edit to the publisher allowlists: the point is
// that a tightening never silently demotes a displayed row from "official source" to
// "unverified" without someone deciding to re-source that row first.
//
// Usage:
//   node scripts/check-source-trust.mjs                 # prod (.env.local.live)
//   node scripts/check-source-trust.mjs .env.local      # dev project
//
// Needs Node ≥ 22.18 (imports the .ts module directly via native type stripping).

import { readFileSync } from "fs";
import { sourceStatusOf, sourceName, isForbiddenSourceHost } from "../lib/source-trust.ts";

const envFile = process.argv[2] ?? ".env.local.live";
const env = readFileSync(envFile, "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^["']|["']$/g, "");
}
const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`ABORT — ${envFile} has no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.`);
  process.exit(1);
}
console.log(`Project: ${SUPABASE_URL} (from ${envFile})\n`);

// ── 1. Fixed cases: the rules the allowlists are supposed to encode ──────────
const CASES = [
  ["https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON614", "don"],
  ["https://www.who.int/emergencies/disease-outbreak-news/item/dengue-cotedivoire-2024", "unverified"], // fake seed
  ["https://www.afro.who.int/countries/democratic-republic-congo/publication/sitrep-13", "official"],
  ["https://cdn.who.int/media/docs/default-source/documents/sitrep.pdf", "official"],
  ["https://worldhealthorg.shinyapps.io/dengue_global/", "official"],
  ["https://someone-else.shinyapps.io/fake_dashboard/", "unverified"], // shared host, not WHO's
  ["https://www.cidrap.umn.edu/ebola/article", "official"],
  ["https://www.nationthailand.com/news/general/40012345", "press"],
  ["https://www.pna.gov.ph/articles/1234567", "press"],             // state wire service, not doh.gov.ph
  ["https://doh.gov.ph/press-release/dengue-update", "official"],
  ["http://french.china.org.cn/foreign/txt/2026-08/06/content_1.htm", "press"], // http exempt, press tier
  ["http://english.news.cn/20260806/abc/c.html", "unverified"],      // http, not scheme-exempt
  ["https://www.linkedin.com/feed/update/urn:li:activity:7358000000000000000/", "unverified"], // 2026-08-12 incident
  ["https://x.com/MinSanteRDC/status/1234567890", "unverified"],
  ["https://notwho.int/fake", "unverified"],                         // no dot-boundary match
  ["https://who.int.attacker.example/fake", "unverified"],           // suffix must be the tail
  ["https://outbreaknewstoday.substack.com/p/ebola", "unverified"],
  // Legally forbidden publisher — must never reach 'official'/'press' however the URL looks.
  ["https://reliefweb.int/report/fiji/dengue-pacific-multicountry-situation-14-august-2026", "unverified"],
  ["https://www.reliefweb.int/report/vanuatu/anything", "unverified"],
  ["OMS", "unverified"],
  ["", "unverified"],
  [null, "unverified"],
];
let failed = 0;
for (const [src, want] of CASES) {
  const got = sourceStatusOf(src);
  if (got !== want) {
    failed++;
    console.log(`FAIL  ${JSON.stringify(src)}\n      want ${want}, got ${got}`);
  }
}
console.log(failed === 0 ? `Fixed cases: ${CASES.length}/${CASES.length} pass\n` : `\n${failed} FIXED CASE(S) FAILED\n`);

// ── 2. The old rule, for the before/after diff ───────────────────────────────
const OLD_HTTP_OK = new Set(["french.china.org.cn"]);
function oldStatus(src0) {
  const src = src0 || "";
  if (/^https:\/\/www\.who\.int\/emergencies\/disease-outbreak-news\/item\/\d{4}-DON\d+$/i.test(src)) return "don";
  if (/\/disease-outbreak-news\/item\/(?!\d{4}-DON)/i.test(src)) return "unverified";
  if (src.startsWith("https://")) return "official";
  if (src.startsWith("http://")) {
    try { if (OLD_HTTP_OK.has(new URL(src).hostname.toLowerCase())) return "official"; } catch { /* not a URL */ }
  }
  return "unverified";
}

// ── 3. Replay the live table ─────────────────────────────────────────────────
async function q(params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0];
const select = "id,disease,disease_en,country,country_en,cases,deaths,date,source,active,source_priority,updated_at";
const all = await q(`select=${select}&limit=5000`);

// Mirrors getOutbreaksCached()'s row set in lib/outbreaks.ts: active rows plus the
// 60-day display grace period for recently-closed ones. These are the rows a client
// actually sees badged, so a tier change here is a blocker; archive-only rows are
// reachable by direct URL and only worth reporting.
const isDisplayed = (o) =>
  o.active === true ||
  ((o.source_priority ?? 0) >= 3 && (o.updated_at ?? "") >= sixtyDaysAgo && (o.date ?? "") >= sixtyDaysAgo);

const tally = {};
const changed = [];
for (const o of all) {
  const next = sourceStatusOf(o.source);
  const prev = oldStatus(o.source);
  const bucket = isDisplayed(o) ? "displayed" : "archive";
  tally[bucket] ??= {};
  tally[bucket][next] = (tally[bucket][next] ?? 0) + 1;
  if (next !== prev) changed.push({ o, prev, next, displayed: bucket === "displayed" });
}

console.log(`Rows in table: ${all.length}  (displayed: ${all.filter(isDisplayed).length}, archive: ${all.filter((o) => !isDisplayed(o)).length})`);
for (const bucket of ["displayed", "archive"]) {
  const t = tally[bucket] ?? {};
  console.log(`  ${bucket.padEnd(9)} → ` + ["don", "official", "press", "unverified"].map((k) => `${k}: ${t[k] ?? 0}`).join("  "));
}

const RANK = { unverified: 0, press: 1, official: 2, don: 3 };
console.log(`\nTier changes vs the old "https ⇒ official" rule: ${changed.length}`);
for (const c of changed.sort((a, b) => Number(b.displayed) - Number(a.displayed))) {
  const dir = RANK[c.next] < RANK[c.prev] ? "DEMOTED " : "promoted";
  console.log(
    `  [${c.displayed ? "DISPLAYED" : "archive  "}] ${dir} ${c.prev} → ${c.next}  ` +
    `${c.o.disease_en || c.o.disease} / ${c.o.country_en || c.o.country} (${c.o.cases}c/${c.o.deaths}d)\n` +
    `      label "${sourceName(c.o.source)}"  ${c.o.source}\n      id ${c.o.id}`
  );
}

// A displayed row falling to 'unverified' is a blocker: it loses its badge, its source
// link and its place in the "official" filter, which is a visible regression for a paying
// client. Falling to 'press' is the reclassification this tier exists for — the row keeps
// a working link and a named outlet — so it is reported for re-sourcing, not blocked.
// A demotion forced by FORBIDDEN_SOURCE_DOMAINS is not a blocker to fix before shipping —
// it IS the fix, and it must not hold the tool hostage forever (the rows behind it can only
// leave the list by being re-sourced or retired, which is a separate, human decision). Split
// out under its own heading so it stays loud without ever blocking an unrelated allowlist edit.
const forbidden = all.filter((o) => isForbiddenSourceHost(o.source));
const forbiddenDisplayed = forbidden.filter(isDisplayed);
const blockers = changed.filter(
  (c) => c.displayed && c.next === "unverified" && c.prev !== "unverified" && !isForbiddenSourceHost(c.o.source),
);
const reclassified = changed.filter((c) => c.displayed && c.next === "press" && RANK[c.prev] > RANK.press);
console.log(
  blockers.length === 0
    ? "\nNo displayed row falls to 'unverified'. Safe to ship."
    : `\n${blockers.length} DISPLAYED ROW(S) WOULD FALL TO 'unverified' — re-source them first (see above).`
);
if (forbidden.length > 0) {
  console.log(
    `\n${forbidden.length} row(s) cite a LEGALLY FORBIDDEN publisher (${forbiddenDisplayed.length} still displayed):`,
  );
  for (const o of forbidden.sort((a, b) => Number(isDisplayed(b)) - Number(isDisplayed(a)))) {
    console.log(
      `  [${isDisplayed(o) ? "DISPLAYED" : "archive  "}] ${o.disease_en || o.disease} / ${o.country_en || o.country} ` +
      `(${o.cases}c/${o.deaths}d, active=${o.active}, prio=${o.source_priority})\n      ${o.source}\n      id ${o.id}`,
    );
  }
  console.log(
    "  These are citations HWG has no right to publish — deactivating them is NOT enough: a row with\n" +
    "  source_priority>=3 stays on the public site for 60 days after being switched off. Re-source each\n" +
    "  row to a permitted publisher, or take it out of the display window.",
  );
}
if (reclassified.length > 0) {
  console.log(`${reclassified.length} displayed row(s) move to the 'press' tier — still linked and named, worth re-sourcing upstream when a bulletin exists.`);
}
process.exitCode = failed > 0 || blockers.length > 0 ? 1 : 0;
