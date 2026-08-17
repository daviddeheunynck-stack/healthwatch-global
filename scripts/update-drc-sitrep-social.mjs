// Guarded direct write for the Ebola/DRC priority-10 row, callable from a
// marketing routine (x-hwg-monitoring / x-hwg-followup-check) after it reads
// an official cumulative "point de situation" from @Com_mediasRDC or
// @MinSanteRDC directly (no backend fetcher exists for X posts — the routine
// itself, already reading the primary source in context, plays the role a
// PDF-sitrep cron's regex parser plays elsewhere). Added 2026-08-03 so a
// confirmed newer national sitrep doesn't have to wait for an interactive QC
// session before it reaches the priority-10 row — see routine-improvement-log
// entry of that date, point 2.
//
// Usage: node scripts/update-drc-sitrep-social.mjs <cases> <deaths> <YYYY-MM-DD> <sourceUrl>
// Exits non-zero and prints the reason on any guard rejection — the caller
// must treat that as "not written, report for arbitration as before", never
// retry with the same numbers.

import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim();
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY  = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  console.error(`ABORT — .env.local.live did not resolve to the prod project ref (got ${SUPABASE_URL}). Refusing to write.`);
  process.exit(1);
}

const [casesArg, deathsArg, dateArg, sourceUrl] = process.argv.slice(2);
const cases  = parseInt(casesArg, 10);
const deaths = parseInt(deathsArg, 10);
const date   = dateArg;

if (!Number.isFinite(cases) || !Number.isFinite(deaths) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !sourceUrl) {
  console.error("Usage: node scripts/update-drc-sitrep-social.mjs <cases> <deaths> <YYYY-MM-DD> <sourceUrl>");
  process.exit(1);
}

// This script's whole reason to exist is a narrow, named exception to the normal source-trust
// rules (see lib/source-trust.ts): it accepts a social-media post as a source SPECIFICALLY
// because that post is a verbatim official "point de situation" from one of the two named DRC
// government accounts, read directly by the routine calling this script (no backend fetcher
// exists for X posts — see the header comment above). That exception must not be exploitable
// as "any URL a routine hands us" — found 2026-08-12: this row's source was a LinkedIn feed
// permalink, login-walled and unreadable for a client, carrying the sourceStatus() 'official'
// badge purely because it was https://. sourceStatus() no longer trusts scheme alone (see the
// same fix), but that only protects rows synced by a backend fetcher; this script writes
// directly and never goes through sourceStatus(), so it needs its own gate. The gate is
// deliberately narrower than "any X/Twitter post" — it must be the two accounts the exception
// actually names, not X in general.
const ALLOWED_SOURCE_HOSTS = new Set(["twitter.com", "x.com", "mobile.twitter.com"]);
const ALLOWED_SOURCE_ACCOUNTS = new Set(["com_mediasrdc", "minsanterdc"]);

function sourceGuardReason(url) {
  let u;
  try { u = new URL(url); } catch { return `guard:source-not-url — "${url}" is not a valid URL`; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!ALLOWED_SOURCE_HOSTS.has(host)) {
    return `guard:source-host — ${host} is not X/Twitter. This exception covers ONLY a point de situation read verbatim on @Com_mediasRDC or @MinSanteRDC — any other host (including a login-walled social permalink like LinkedIn) does not qualify, no matter how it was read.`;
  }
  const account = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!account || !ALLOWED_SOURCE_ACCOUNTS.has(account)) {
    return `guard:source-account — "${u.pathname}" is not a post by @Com_mediasRDC or @MinSanteRDC. The exception names these two accounts specifically, not X/Twitter in general.`;
  }
  if (!/\/status\/\d+(?:[/?].*)?$/i.test(u.pathname)) {
    return `guard:source-not-status — "${u.pathname}" is not a link to a specific post (missing /status/<id>). A profile or search URL is not a citable source.`;
  }
  return null;
}

const sourceReason = sourceGuardReason(sourceUrl);
if (sourceReason) {
  console.error(`BLOCKED — ${sourceReason} Not written. Report this for arbitration, do not retry with a different URL without confirming it is genuinely one of the two named accounts.`);
  process.exit(2);
}

async function fetchRow() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=ilike.*ebola*&country_en=ilike.*Congo*&select=id,cases,deaths,date,source_priority&order=source_priority.desc&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) throw new Error(`fetch row: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

// Same arithmetic as lib/outbreak-guards.ts (regressionGuard's four checks +
// the source-specific ones sync-ecdc-threats/sync-drc-sitrep add on top) —
// duplicated here in plain JS since this script runs outside the Next.js
// TS build. Kept deliberately at least as strict as the PDF-sitrep crons:
// this row is fed by free-text tweet parsing, not a table extraction, so it
// gets every guard in the file rather than the four-guard default.
function guardReason(incoming, existing) {
  const exCases  = existing.cases  ?? 0;
  const exDeaths = existing.deaths ?? 0;

  if (incoming.date && existing.date && incoming.date < existing.date)
    return `guard:older-report — ${incoming.date} vs existing ${existing.date}`;
  if (incoming.cases > 0 && exCases > 100 && incoming.cases < exCases * 0.3)
    return `guard:collapse — parsed ${incoming.cases} vs existing ${exCases} (<30%)`;
  if (incoming.cases === 0 && exCases > 0)
    return `guard:zero-case — parsed 0 vs existing ${exCases}`;
  if (incoming.deaths === 0 && exDeaths > 0)
    return `guard:zero-death — parsed 0 vs existing ${exDeaths} deaths`;
  if (exCases > 0 && incoming.cases > exCases * 3)
    return `guard:spike — parsed ${incoming.cases} vs existing ${exCases} (>3x)`;
  if (incoming.deaths > 0 && exDeaths > 0 && incoming.deaths < exDeaths)
    return `guard:deaths-decreased — parsed ${incoming.deaths} vs existing ${exDeaths} — refusing to overwrite`;
  if (incoming.cases > 0 && incoming.deaths > incoming.cases)
    return `guard:deaths>cases — ${incoming.deaths}d > ${incoming.cases}c`;
  return null;
}

const existing = await fetchRow();
if (!existing) {
  console.error("ABORT — Ebola/DRC row not found in outbreaks table.");
  process.exit(1);
}

const reason = guardReason({ cases, deaths, date }, existing);
if (reason) {
  console.error(`BLOCKED — ${reason}. Row left unchanged (${existing.cases}/${existing.deaths}, ${existing.date}). Report this for arbitration, do not retry with the same numbers.`);
  process.exit(2);
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${existing.id}&source_priority=lte.10`, {
  method: "PATCH",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    cases, deaths, date,
    source: sourceUrl,
    active: true,
    source_priority: 10,
    updated_at: new Date().toISOString(),
  }),
});

if (!res.ok) {
  console.error(`DB error: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const updated = await res.json();
if (!updated.length) {
  console.error("BLOCKED — update matched 0 rows (row now owned by a higher-priority source since fetchRow()). Not written.");
  process.exit(2);
}

console.log(`WRITTEN — Ebola/DRC now ${cases}/${deaths} (${date}), source_priority=10, source=${sourceUrl}. Previous: ${existing.cases}/${existing.deaths} (${existing.date}).`);
