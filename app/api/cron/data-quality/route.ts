import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extractNumbers } from "@/lib/outbreak-parser";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { sendBrevoEmail } from "@/lib/brevo-send";
import { isCollapse, isSpike, deathsExceedCases, isZeroData } from "@/lib/outbreak-guards";
import { sourceStatusOf, sourceName, isForbiddenSourceHost } from "@/lib/source-trust";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const DON_RE = /^https:\/\/www\.who\.int\/emergencies\/disease-outbreak-news\/item\/\d{4}-DON\d+$/i;
const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept": "text/html,*/*",
};

// ── Fetch and extract numbers + resolution signals from a WHO DON page ────────

interface DONResult {
  cases:     number;
  deaths:    number;
  resolved:  boolean; // formal "end of outbreak declared" language
  contained: boolean; // strong containment signal (contacts cleared, no new cases)
}

// Phrases that unambiguously indicate WHO has formally declared the outbreak over.
const RESOLUTION_PHRASES = [
  "the outbreak has been declared over",
  "this outbreak has been declared over",
  "outbreak is over",
  "end of the outbreak has been declared",
  "who has declared the end of the outbreak",
];

// Phrases indicating strong containment (contacts cleared, no secondary cases)
// but not necessarily a formal "end of outbreak" declaration yet.
const CONTAINMENT_PHRASES = [
  "all contacts have completed their follow-up period, with no additional cases",
  "no additional human cases have been reported",
  "quarantine and follow-up periods have been completed for everyone",
];

async function verifyFromDON(url: string): Promise<DONResult | null> {
  if (!DON_RE.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const bodyMatch = html.match(
      /(?:sf-content-block|article-content|content-block-article|don-content)([\s\S]{0,8000})/i,
    );
    // Fail closed like the sync-* extractors: if the selector no longer matches,
    // feeding the full page (nav/header chrome) into extractNumbers would produce
    // wrong case/death counts instead of the null this function already returns
    // for "no usable data".
    if (!bodyMatch) return null;
    const rawText = bodyMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const lower    = rawText.toLowerCase();
    const nums     = extractNumbers(rawText);
    const resolved  = RESOLUTION_PHRASES.some(p => lower.includes(p));
    const contained = !resolved && CONTAINMENT_PHRASES.some(p => lower.includes(p));
    if (nums.cases === 0 && nums.deaths === 0 && !resolved && !contained) return null;
    return { cases: nums.cases, deaths: nums.deaths, resolved, contained };
  } catch {
    return null;
  }
}

// Rebuilds the English description from the corrected figures — same fix as
// buildEndemicDescription in sync-endemic-data: a cases/deaths update that leaves
// description untouched narrates stale numbers in prod indefinitely.
function buildDataQualityDescription(diseaseEn: string, countryEn: string, cases: number, deaths: number, date: string): string {
  const casesStr  = cases.toLocaleString("en");
  const deathsStr = deaths > 0 ? ` and ${deaths.toLocaleString("en")} death${deaths > 1 ? "s" : ""}` : "";
  return `${diseaseEn} in ${countryEn} — ${casesStr} cumulative case${cases > 1 ? "s" : ""}${deathsStr} reported as of ${date}.`;
}

// ── GPEI "Polio This Week" coverage probe ─────────────────────────────────────
// polioeradication.org is one of the two MANUAL_WEEKLY_SOURCES of section 4f: no
// cron writes polio rows, they are refreshed by hand. 4f can only notice that a
// row we ALREADY have has gone stale — it is structurally blind to a country the
// source reports and we hold no row for at all. That blind spot cost the entire
// African cVDPV picture: on 2026-08-22 a WHO Incident Manager sent David the GPEI
// update and asked whether we had read it. The base had three polio rows
// (Afghanistan, Pakistan, Palestine) and not one African one, while GPEI's own
// public page — already quoted verbatim in the Afghanistan row's `source` column
// — listed DR Congo, Nigeria, Niger, the Central African Republic and Sudan that
// same week. 13 rows were created by hand that evening
// (scripts/add-cvdpv-africa-gpei-2026-08-22.mjs); this probe is what would have
// surfaced the gap without a stranger telling us.
const GPEI_THIS_WEEK_URL = "https://polioeradication.org/about-polio/polio-this-week/";

// Countries the summary names the WHO way and the base names its own way. Only
// entries verified against real rows belong here — an unlisted mismatch shows up
// as a false "no row" review line, which is a question in an email, never a
// write. That failure direction is deliberate: silence is what this whole
// section exists to fix.
const GPEI_COUNTRY_ALIASES: Record<string, string> = {
  "democratic republic of the congo": "dr congo",
  "united republic of tanzania": "tanzania",
  "occupied palestinian territory": "palestine",
  "state of palestine": "palestine",
};

function normalizeCountryKey(name: string): string {
  const k = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return GPEI_COUNTRY_ALIASES[k] ?? k;
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

interface GPEIWeek { asOf: string | null; countries: Array<{ name: string; note: string }> }

// Text-level parse rather than a CSS selector: the page's markup is WordPress
// boilerplate that changes with every theme bump, but the two anchors used here
// ("Summary of new polioviruses this week" and "Country updates as of <date>")
// are the editorial structure of the bulletin itself and have been stable for
// years. Returns null rather than a partial result if either anchor is gone —
// same fail-closed rule as verifyFromDON above.
function parseGPEIThisWeek(rawHtml: string): GPEIWeek | null {
  const lines = rawHtml
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|li|div|h[1-6]|tr)\s*>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t\u00a0]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const startIdx = lines.findIndex((l) => /new polioviruses this week/i.test(l));
  if (startIdx < 0) return null;
  const asOfIdx = lines.findIndex((l, i) => i > startIdx && /country updates as of/i.test(l));
  if (asOfIdx < 0) return null;

  let asOf: string | null = null;
  const asOfMatch = lines[asOfIdx].match(/as of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (asOfMatch) {
    const month = MONTHS.indexOf(asOfMatch[2].toLowerCase());
    if (month >= 0) {
      asOf = `${asOfMatch[3]}-${String(month + 1).padStart(2, "0")}-${asOfMatch[1].padStart(2, "0")}`;
    }
  }

  // "Nigeria: one cVDPV2 case, one cVDPV3 case and one cVDPV2-positive
  // environmental sample" — one bullet per country, between the two anchors.
  const countries: Array<{ name: string; note: string }> = [];
  for (let i = startIdx + 1; i < asOfIdx; i++) {
    const m = lines[i].match(/^([A-Z][A-Za-z'.\- ]{2,60}?)\s*:\s*(.+)$/);
    if (m) countries.push({ name: m[1].trim(), note: m[2].trim() });
  }
  return { asOf, countries };
}

async function fetchGPEIThisWeek(): Promise<GPEIWeek | null> {
  try {
    const res = await fetch(GPEI_THIS_WEEK_URL, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return parseGPEIThisWeek(await res.text());
  } catch {
    return null;
  }
}

// Delegates to the shared helper (lib/brevo-send.ts), which throws both on a
// missing API key and on any non-2xx Brevo response. The local copy this
// replaces opened with `if (!BREVO_API_KEY || !to) return;` — a silent return
// that issued no request, so the non-2xx throw added on 2026-08-11 never saw
// that path (found 2026-08-25 in sync-pacific-surveillance, same pattern here).
async function sendEmail(to: string, subject: string, html: string) {
  if (!to) throw new Error("ADMIN_EMAILS not set — no recipient for the alert");
  await sendBrevoEmail({ to, subject, html, apiKey: BREVO_API_KEY });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[data-quality] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  try {
    return await runDataQuality(req, supabase);
  } catch (err) {
    console.error("[data-quality] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "data-quality" } });
    await logCronRun(supabase, "data-quality", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

interface OutbreakRowForFix {
  id: string;
  disease: string;
  disease_en: string | null;
  country: string;
  country_en: string | null;
  date: string;
  description: string | null;
}

// Applies a cases/deaths correction with description recompute (+ translation
// invalidation) in the same write, and reports whether the write actually landed —
// a source_priority guard blocking the write, or a genuine DB error, must never be
// silently counted as an applied fix in the admin report.
async function applyCaseUpdate(
  supabase: SupabaseClient,
  row: OutbreakRowForFix,
  newCases: number,
  newDeaths: number
): Promise<{ ok: boolean; error?: string }> {
  const description = buildDataQualityDescription(
    row.disease_en ?? row.disease, row.country_en ?? row.country, newCases, newDeaths, row.date
  );
  const payload: Record<string, unknown> = { cases: newCases, deaths: newDeaths, description };
  if (row.description !== description) {
    payload.description_fr = null;
    payload.description_es = null;
    payload.description_ar = null;
    payload.description_id = null;
  }
  // The .lte() belongs here and not only in the caller: the loop's
  // `source_priority >= 10` check reads a snapshot loaded minutes earlier, then
  // awaits a per-row verifyFromDON() network fetch before reaching this write —
  // exactly the window the deactivation below (see "Same contract as
  // applyCaseUpdate above") already guards against at the DB level. Without it
  // this function was the one auto-fix path that could still overwrite a row
  // locked between the snapshot read and the write.
  const { data, error } = await supabase
    .from("outbreaks")
    .update(payload)
    .eq("id", row.id)
    .lte("source_priority", 9)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "update bloqué (ligne verrouillée, 0 ligne affectée)" };
  return { ok: true };
}

async function runDataQuality(_req: NextRequest, supabase: SupabaseClient) {
  const today    = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // ── 1. Load active rows ───────────────────────────────────────────────────
  const { data: rows, error: rowsErr } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, country, country_en, cases, deaths, date, source, is_seed, is_pheic, source_priority, description, admin1, is_backfill, source_confirmed_at")
    .eq("active", true);

  if (rowsErr) {
    await logCronRun(supabase, "data-quality", "error", 0, rowsErr.message);
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  // ── 2. Load yesterday's snapshots ─────────────────────────────────────────
  const { data: snaps } = await supabase
    .from("outbreak_snapshots")
    .select("outbreak_id, cases, deaths")
    .eq("snapped_at", yesterday);

  const snapMap = new Map<string, { cases: number; deaths: number }>();
  for (const s of snaps ?? []) snapMap.set(s.outbreak_id, { cases: s.cases, deaths: s.deaths });

  // ── 3. Detect anomalies ───────────────────────────────────────────────────
  type Anomaly = {
    row: typeof rows[number];
    type: "deaths_gt_cases" | "zero_data" | "large_drop" | "spike";
    detail: string;
    snap: { cases: number; deaths: number } | undefined;
  };

  const anomalies: Anomaly[] = [];

  for (const row of rows ?? []) {
    const snap = snapMap.get(row.id);

    // Same guard-family arithmetic as the sync crons (dateFloorGuard etc.),
    // shared via lib/outbreak-guards.ts (2026-08-02) as raw threshold-
    // parameterized predicates rather than the write-time guard functions
    // themselves — this cron compares a row against YESTERDAY's snapshot at
    // its own, deliberately different thresholds (see that file's top
    // comment), not an incoming report against the current row.
    if (deathsExceedCases(row.deaths, row.cases)) {
      anomalies.push({ row, type: "deaths_gt_cases", detail: `${row.deaths} décès > ${row.cases} cas`, snap });
      continue;
    }
    if (isZeroData(row.cases, row.deaths) && !row.is_seed) {
      anomalies.push({ row, type: "zero_data", detail: "0 cas et 0 décès (ligne pipeline)", snap });
      continue;
    }
    if (snap && snap.cases > 100) {
      const drop = (snap.cases - row.cases) / snap.cases;
      if (isCollapse(row.cases, snap.cases, { minPreviousCases: 100, ratio: 0.4 })) {
        anomalies.push({ row, type: "large_drop", detail: `${snap.cases} → ${row.cases} cas (−${Math.round(drop * 100)}%)`, snap });
        continue;
      }
      const spike = (row.cases - snap.cases) / snap.cases;
      if (isSpike(row.cases, snap.cases, { ratio: 10, minCurrentCases: 5000 })) {
        anomalies.push({ row, type: "spike", detail: `${snap.cases} → ${row.cases} cas (+${Math.round(spike * 100)}%)`, snap });
      }
    }
  }

  // ── 4. Verify + auto-fix ──────────────────────────────────────────────────
  type Fix = { label: string; before: string; after: string };
  type NeedsReview = { label: string; detail: string };

  const fixes: Fix[] = [];
  const needsReview: NeedsReview[] = [];

  // Section 3's drop/spike detection only runs for rows that HAVE a snapshot to
  // compare against (`if (snap && ...)`), so a missing snapshot doesn't fail the
  // check — it silently removes the row from it. If the whole snapshot write
  // breaks, this cron keeps reporting "0 anomalies" while detecting nothing at
  // all. That is not hypothetical: a null death count blocked the entire batch
  // upsert from 2026-06-30 to 2026-07-16 and nobody noticed for 16 days
  // (see the comment in sync-outbreaks/route.ts, now also reported to Sentry).
  // Report the blindness itself rather than passing quietly. A few rows
  // legitimately have no snapshot the day they are created, hence a coverage
  // floor rather than "any row missing". Replayed against that real incident:
  // it fires every day of it (29/06 at 9%, 30/06 at 39%, then a flat 0% from
  // 02/07 through 15/07, recovering 16/07) and stays silent on every healthy
  // day since, including today's 5 newly-created West Nile rows.
  const SNAPSHOT_COVERAGE_FLOOR = 0.5;
  const activeCount = (rows ?? []).length;
  if (activeCount > 0) {
    const coverage = snapMap.size / activeCount;
    if (coverage < SNAPSHOT_COVERAGE_FLOOR) {
      needsReview.push({
        label: "[SNAPSHOTS] Détection chute/pic aveugle",
        detail: `Seulement ${snapMap.size} instantané(s) pour ${activeCount} lignes actives (${Math.round(coverage * 100)}%, plancher ${SNAPSHOT_COVERAGE_FLOOR * 100}%) au ${yesterday} — la détection de chutes et de pics n'a comparé presque aucune ligne. Vérifier l'upsert outbreak_snapshots dans sync-outbreaks (un seul compteur null peut bloquer tout le lot).`,
      });
    }
  }

  for (const a of anomalies) {
    const { row, type, snap } = a;
    const label = `${row.disease} / ${row.country}`;

    // A row locked at source_priority=10 has an explicit human decision behind
    // it (verified against a primary source, often specifically BECAUSE its
    // automated source is unreliable) — this cron's auto-fixes must never
    // silently override that. Found 2026-07-17: this cron had zero awareness
    // of the locking convention used throughout 2026-07-15/16/17 (DR Congo/
    // Ebola, Uganda, Tanzania, Somalia rows), so a "spike"/"large_drop" false
    // positive against yesterday's snapshot could have blindly reverted a
    // deliberate correction the same day it was made.
    if ((row.source_priority ?? 0) >= 10) {
      needsReview.push({ label, detail: `${a.detail} — ligne verrouillée (source_priority=10), non auto-corrigée, vérifier manuellement` });
      continue;
    }

    const don = await verifyFromDON(row.source);

    if (type === "deaths_gt_cases") {
      if (don && don.cases > 0 && don.deaths <= don.cases) {
        const r = await applyCaseUpdate(supabase, row, don.cases, don.deaths);
        if (r.ok) fixes.push({ label, before: `${row.cases}c/${row.deaths}d`, after: `${don.cases}c/${don.deaths}d` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else if (!don) {
        // No DON to verify — conservative fix: cap deaths at cases value
        const r = await applyCaseUpdate(supabase, row, row.cases, row.cases);
        if (r.ok) fixes.push({ label, before: `${row.cases}c/${row.deaths}d`, after: `${row.cases}c/${row.cases}d (décès plafonnés, DON inaccessible)` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — DON ambigu (${don.cases}c/${don.deaths}d)` });
      }
    } else if (type === "zero_data") {
      if (don && don.cases > 0) {
        const r = await applyCaseUpdate(supabase, row, don.cases, don.deaths);
        if (r.ok) fixes.push({ label, before: "0c/0d", after: `${don.cases}c/${don.deaths}d` });
        else needsReview.push({ label, detail: `0/0 — échec DB (${r.error})` });
      } else {
        needsReview.push({ label, detail: `0/0 — DON ${don ? "ne confirme pas de chiffres" : "inaccessible"}` });
      }
    } else if (type === "large_drop") {
      if (don && snap && don.cases >= snap.cases * 0.7) {
        // DON confirms the old level — today's sync parsed wrong
        const r = await applyCaseUpdate(supabase, row, don.cases, don.deaths);
        if (r.ok) fixes.push({ label, before: `${row.cases}c (chute)`, after: `${don.cases}c (DON confirme)` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else if (don && don.cases <= row.cases * 1.2) {
        // DON confirms the new lower value — legitimate decline
        needsReview.push({ label, detail: `${a.detail} — DON confirme le nouveau chiffre, baisse réelle ?` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — DON inaccessible` });
      }
    } else if (type === "spike") {
      if (don && snap && don.cases <= snap.cases * 2) {
        // DON doesn't support the spike — parsing error, revert to snapshot
        const r = await applyCaseUpdate(supabase, row, snap.cases, snap.deaths);
        if (r.ok) fixes.push({ label, before: `${row.cases}c (spike)`, after: `${snap.cases}c (restauré depuis snapshot)` });
        else needsReview.push({ label, detail: `${a.detail} — échec DB (${r.error})` });
      } else {
        needsReview.push({ label, detail: `${a.detail} — ${don ? "DON ambigu" : "DON inaccessible"}` });
      }
    }

    await new Promise((r) => setTimeout(r, 150)); // polite delay
  }

  // ── 4b. Staleness check ───────────────────────────────────────────────────
  // Flag active entries whose `date` is older than threshold:
  //   - PHEIC events: 7 days (weekly sitreps, any gap is critical)
  //   - All others:   21 days (standard cron cadence)
  // Excludes: is_seed rows (manual), dashboard/tracker sources (non-article cadence)

  // Verified stale: `source_confirmed_at` (outbreaks column, migration
  // 20260822120000) confirms a human already opened the row's primary source
  // and found no newer edition than `date` — without this, the same
  // already-answered "is there a newer edition?" question gets re-asked
  // every day forever, since a source that has genuinely stopped publishing
  // has no reason for `date` to ever change. Shared by 4b (below, both the
  // plain and dashboard/tracker branches) and 4f (seed freshness, further
  // down) — the three places that ask this exact question.
  //
  // Until 2026-08-22 this was a hardcoded disease_en|country_en|date Set
  // (VERIFIED_STALE) living only in this file — invisible to the
  // client-facing staleness badge and to sourceScore, which is why
  // isSourceConfirmed()/lib/outbreaks.ts now reads the same column to render
  // a "reconfirmed" state instead of a stale warning. The 9 rows the Set
  // held are backfilled by migration 20260822130000, with the original
  // per-row verification notes preserved there.
  //
  // Self-invalidating by construction: valid only while
  // `source_confirmed_at >= date`. If the row's `date` ever advances (a real
  // new report lands), the comparison stops holding and the row falls
  // straight back into normal flagging on its new, unverified state — no one
  // has to remember to clear the column. Verify against the primary source
  // directly before writing it; never set speculatively.
  //
  // …but that self-invalidation runs the wrong way as a safety property, and
  // since 2026-08-31 the stamp also expires on its own clock. `date` advances
  // only while the ingestion cron works; when one breaks, `date` freezes and
  // the last stamp written before the failure silences this check forever.
  // Measured that day: 71 of 127 active rows were exempt on a stamp, 60 of
  // them would otherwise have been flagged, and nothing could ever age one
  // out. `maxAgeDays` is passed by each caller rather than fixed here, so a
  // confirmation is worth exactly as long as the staleness threshold it is
  // standing in for — 7 days on a PHEIC row, 21 on a standard one, 180 on a
  // dashboard/tracker source, 30/180 on seeds in 4f. Re-run against the live
  // table before shipping: 0 rows changed side today, because the sync crons
  // re-stamp on every "unchanged" run and a live confirmation is 0–2 days old
  // (median 1). A stamp that reaches its section's threshold means no cron has
  // successfully re-read that row's source for that long, which is the point.
  //
  // Client-side sibling: isSourceConfirmed()/CONFIRMATION_MAX_AGE_DAYS (60,
  // = STALE_DAYS) in lib/outbreaks.ts + lib/source-confirmed.ts. Same rule,
  // looser clock, because this report exists to ask sooner than a visitor.
  function isVerifiedStale(
    row: { date: string | null; source_confirmed_at: string | null },
    maxAgeDays: number,
  ): boolean {
    if (!row.source_confirmed_at || !row.date) return false;
    const stamped = new Date(row.source_confirmed_at).getTime();
    if (stamped < new Date(row.date).getTime()) return false;
    return Date.now() - stamped <= maxAgeDays * 86_400_000;
  }

  const STALE_DAYS_PHEIC = 7;
  const STALE_DAYS       = 21;
  const pheicThreshold = new Date(Date.now() - STALE_DAYS_PHEIC * 86_400_000).toISOString().split("T")[0];
  const staleThreshold = new Date(Date.now() - STALE_DAYS       * 86_400_000).toISOString().split("T")[0];
  const DASHBOARD_SOURCES = [
    "shinyapps.io",
    "ecdc.europa.eu/en/mpox/surveillance",
    "publications/m/item",                  // WHO monthly situation reports (Mpox, dengue, etc.) — monthly cadence, 28d staleness expected. Domain-only, no "who.int/" prefix: regional sub-portals (e.g. who.int/westernpacific/publications/m/item/...) use the same series under a different path and were falling through to the standard 21-day threshold — confirmed 2026-08-08, 4 dengue rows (Cambodia/Vietnam/French Polynesia/New Caledonia) all cite the identical westernpacific dengue-situation-update page.
    "ecdc.europa.eu/en/news-events",        // ECDC epidemiological updates — quarterly cadence, 90d+ staleness expected
    "aphis.usda.gov/hpai-h5n1",             // USDA APHIS per-state HPAI livestock — date = last confirmed detection in that state, not a sync timestamp; many states legitimately go months/years without a new one
    "who.int/emergencies/surveillance/cholera-cases-and-deaths", // WHO cholera dashboard — explicitly annual reporting by member states, not operational (see reference_who_cholera_operational_source)
    "cdn.who.int/media/docs/default-source/_sage-2026",          // WHO SAGE-hosted versioned risk assessments (e.g. diphtheria African region v.1/v.2) — new version, not periodic refresh; confirmed 2026-07-30 no v.3 exists beyond the currently-cited v.2
    "paho.org/en/documents/epidemiological-alert",               // PAHO epidemiological alerts — event-driven, not on a fixed schedule; confirmed 2026-07-30 no newer alert supersedes the 11 June 2026 diphtheria one
    "afro.who.int/countries",                                    // WHO AFRO country-specific news posts — one-off articles, not a periodic series
    "multi-country_outbreak-of-cholera_epidemiological_update",  // WHO's numbered cholera epi-update series stopped at #38 (30 June 2026); no #39 exists and the announced WER migration hadn't appeared as of 2026-07-30 (see reference_who_cholera_epi_update_moves_to_wer_2026_07_30)
    "ecdc.europa.eu/en/all-topics-z/cholera/surveillance-and-disease-data", // ECDC cholera-monthly page — confirmed 2026-07-30 live page matches DB exactly, monthly cadence
    "health-topics---meningitis/meningitis_bulletin",            // WHO AFRO meningitis bulletin — surveillance season ended at week 26/2026, no bulletin published again until the next season (see meningitis_season_end_week26_2026)
    "ecdc.europa.eu/en/middle-east-respiratory-syndrome-coronavirus-mers-cov-situation-update", // ECDC MERS-CoV dashboard — updated in place, not republished; confirmed 2026-07-30 live page identical to DB (case detection at its lowest since 2014)
    "dge.gob.pe/sala-situacional-dengue",                         // Peru MoH (CDC Peru) dengue dashboard — redirects to a pure JS/Shiny map (app7.dge.gob.pe/maps/sala_metaxenica/) with no dated articles to scrape; confirmed 2026-08-08 our stored week-26 figure (34,820 cases/36 deaths) matches the last publicly-cited MINSA bulletin, no newer week found in press — updates in place on its own weekly cadence, not stale.
    "disease-outbreak-news/item/2026-DON610",                     // WHO yellow fever Global surveillance summary — confirmed 2026-08-08 no successor DON exists (prior yellow-fever DON is 2025-DON570, Americas-only, ~1yr gap); this aggregate series is irregular, not fixed-cadence. Specific URL only, NOT a blanket disease-outbreak-news exemption — most DON-sourced rows (e.g. active Ebola/DRC) really do get renumbered every few weeks and must keep the strict 21-day check.
    "weekly-epidemiological-record",                              // WHO WER — general bulletin (many diseases, not cholera-specific), cited per-issue (e.g. wer101-31) with no ingestion cron in this repo that advances the citation as newer issues publish, unlike sync-who-regional's live fetchers. Confirmed 2026-08-12: issue 31 (27 Jul-2 Aug 2026) is still the latest published issue; Somalia/Tanzania cholera rows citing it (233/0, 113/2 cases/deaths) match it exactly, both explicitly "no cases in the last 28 days". A row's `date` here reflects the last real case activity in the cited table, not the issue's publish date — re-verify against whatever the current latest wer101-NN issue is before assuming a gap, don't just trust the day-count.
  ];
  // A dashboard/tracker source is skipped by the tight 7/21-day rule above because
  // it doesn't publish per-article dates — but an unconditional skip left rows
  // with NO staleness net at all. Found 2026-07-28: Dengue/Haiti (source
  // shinyapps.io/dengue_global) sat at "active" showing 2022 case figures for
  // 1,493 days — verified live against WHO's own xmart dataset, which has zero
  // real (non-null CASES) rows for Haiti in 2023, 2024, 2025, or 2026, so the
  // fetcher's documented fallback-to-last-real-year behavior was working exactly
  // as designed and still produced a 4-year-stale "active" row with nothing to
  // catch it. 180 days is generous enough to absorb the quarterly/monthly
  // cadences noted above without false-positiving on routine gaps, while still
  // catching genuine multi-year drift like this one. Signal only, same as the
  // rest of this check — never auto-deactivated.
  const STALE_DAYS_DASHBOARD = 180;
  const dashboardStaleThreshold = new Date(Date.now() - STALE_DAYS_DASHBOARD * 86_400_000).toISOString().split("T")[0];

  for (const row of rows ?? []) {
    if (row.is_seed || !row.date || anomalies.some((a) => a.row.id === row.id)) continue;
    // The confirmation is bounded by the same threshold this row would be
    // judged on, so the exemption cannot outlive the question it answers.
    const isDashboardSource = DASHBOARD_SOURCES.some((d) => (row.source ?? "").includes(d));
    const confirmationMaxAge = isDashboardSource
      ? STALE_DAYS_DASHBOARD
      : row.is_pheic ? STALE_DAYS_PHEIC : STALE_DAYS;
    if (isVerifiedStale(row, confirmationMaxAge)) continue;
    const daysSince = Math.round((Date.now() - new Date(row.date).getTime()) / 86_400_000);
    if (isDashboardSource) {
      // `is_backfill` rows are exempt from the ceiling: their source is itself a
      // historical/cumulative archive, so an old `date` is the reported fact, not
      // drift. On the USDA APHIS crosstab the date is "last confirmed detection
      // in that state" — Oregon's 2024-10-30 is simply when Oregon last had one,
      // and no fresher figure exists to find. Without this, the ceiling asked an
      // unanswerable question about the same 10 per-state rows every single day
      // (measured 2026-07-29: 10 of the 11 rows it flagged), drowning the one it
      // was actually built for. Verified the split is clean: all 10 USDA rows are
      // is_backfill=true, while Dengue/Cuba — and Dengue/Haiti, the 1,493-day row
      // that motivated this check — are is_backfill=false and still caught.
      if (row.date <= dashboardStaleThreshold && !row.is_backfill) {
        needsReview.push({
          label: `${row.disease} / ${row.country}`,
          detail: `Source dashboard/tracker sans donnée plus récente depuis ${daysSince}j (${row.date}, seuil ${STALE_DAYS_DASHBOARD}j) — vérifier si une source plus fraîche existe ou si la ligne doit être désactivée : ${row.source ?? "N/A"}`,
        });
      }
      continue;
    }
    const threshold = row.is_pheic ? pheicThreshold : staleThreshold;
    if (row.date <= threshold) {
      needsReview.push({
        label: `${row.disease} / ${row.country}`,
        detail: `Stale — dernière donnée il y a ${daysSince}j (${row.date}) — vérifier source : ${row.source ?? "N/A"}`,
      });
    }
  }

  // ── 4c. Duplication check ─────────────────────────────────────────────────
  // Flag active outbreaks where ≥3 DISTINCT countries share the exact same
  // case count from the same source domain — almost always signals a parser
  // distributing a regional total to individual country rows instead of one
  // aggregate row. Must dedupe by country (Set, not array): sub-national
  // breakdowns (USDA APHIS per US state, WHO DON per DRC health zone) push
  // the same country string many times on purpose, which used to trip this
  // check by row count alone even though it's the same single country.
  //
  // DUP_MIN_CASES excludes small counts: found 2026-08-26 on Polio (Mali=1,
  // Angola=1, Niger=1, polioeradication.org) — three genuinely distinct cVDPV
  // events (different serotypes, different onset dates, closed 2026-08-22/23
  // via the GPEI slide deck, see project_polio_duplicate_rows_audit) that
  // only collided because "1" is an extremely common, low-cardinality count
  // for an index case — nothing like the regional-total-misparsed-per-country
  // bug this check exists to catch, which produces large, distinctive counts.
  // A misdistributed total is astronomically unlikely to land on a count this
  // small across 3+ countries; independent low-incidence events (a fresh
  // outbreak's first case, in particular) collide on it constantly.
  const DUP_MIN_CASES = 10;
  const dupGroups = new Map<string, Set<string>>();
  for (const row of rows ?? []) {
    if (!row.cases || row.cases < DUP_MIN_CASES || row.is_seed) continue;
    let domain = "unknown";
    try { domain = new URL(row.source ?? "").hostname; } catch { /* ignore */ }
    const key = `${(row.disease ?? "").toLowerCase()}|${domain}|${row.cases}`;
    const group = dupGroups.get(key) ?? new Set<string>();
    group.add(row.country ?? "?");
    dupGroups.set(key, group);
  }
  for (const [key, countrySet] of dupGroups.entries()) {
    const countries = [...countrySet];
    if (countries.length >= 3) {
      const [disease, domain] = key.split("|");
      needsReview.push({
        label: `Duplication suspecte — ${disease} (${domain})`,
        detail: `${countries.length} pays avec le même nombre de cas : ${countries.slice(0, 6).join(", ")}${countries.length > 6 ? "…" : ""}`,
      });
    }
  }

  // ── 4d. CFR plausibility check ───────────────────────────────────────────────
  // Diseases with a known high minimum CFR cannot legitimately show 0 deaths
  // once case counts are substantial. Catches artifacts like "Ebola Germany 1155/0".
  const HIGH_CFR_FLOOR: Record<string, number> = {
    "ebola":   40,  // observed range 25–90 %
    "marburg": 40,  // observed range 24–90 %
    "nipah":   40,  // observed range 40–75 %
  };
  for (const row of rows ?? []) {
    if (row.is_seed) continue;
    const name = (row.disease_en ?? row.disease ?? "").toLowerCase();
    for (const [key, floor] of Object.entries(HIGH_CFR_FLOOR)) {
      if (!name.includes(key)) continue;
      if (row.cases > 50 && row.deaths === 0) {
        needsReview.push({
          label: `${row.disease} / ${row.country}`,
          detail: `CFR impossible : ${row.cases.toLocaleString("fr-FR")} cas / 0 décès pour une maladie à CFR ≥${floor}% — probable artefact parsing (total d'un autre pays ?)`,
        });
      }
    }
  }

  // ── 4e. WHO DON resolution / containment detection ──────────────────────────
  // For active WHO DON rows not already flagged as anomalies:
  //   - Formal end-of-outbreak declaration → auto-deactivate
  //   - Strong containment signal          → flag for manual review
  const anomalyIds = new Set(anomalies.map((a) => a.row.id));
  for (const row of rows ?? []) {
    if (row.is_seed) continue;
    if (!DON_RE.test(row.source ?? "")) continue;
    if (anomalyIds.has(row.id)) continue;
    const label = `${row.disease} / ${row.country}`;
    if ((row.source_priority ?? 0) >= 10) continue; // locked row — never auto-deactivate, see 4. above
    const don = await verifyFromDON(row.source);
    if (don?.resolved) {
      // Same contract as applyCaseUpdate above: guard at the DB level too (the
      // source_priority check at the top of this loop reads a snapshot loaded
      // minutes earlier, before the per-row DON fetches — another cron can lock
      // the row in between), and verify the write actually landed before
      // reporting it as an applied fix. Without the .select("id") check a
      // blocked or failed deactivation was reported to David as "épidémie
      // désactivée" while the row stayed active in prod.
      const { data: deact, error: deactErr } = await supabase
        .from("outbreaks")
        .update({ active: false })
        .eq("id", row.id)
        .lte("source_priority", 9)
        .select("id");
      if (deactErr) {
        needsReview.push({ label, detail: `Fin d'épidémie déclarée (WHO DON) mais échec DB de la désactivation (${deactErr.message}) — vérifier manuellement : ${row.source}` });
      } else if (!deact || deact.length === 0) {
        needsReview.push({ label, detail: `Fin d'épidémie déclarée (WHO DON) mais désactivation bloquée (ligne verrouillée, 0 ligne affectée) — vérifier manuellement : ${row.source}` });
      } else {
        fixes.push({ label, before: "active", after: "inactive — fin d'épidémie déclarée (WHO DON)" });
      }
    } else if (don?.contained) {
      needsReview.push({
        label,
        detail: `Signal de containment détecté dans le DON — vérifier si l'épidémie est terminée : ${row.source}`,
      });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  // ── 4f. Seed data freshness check ────────────────────────────────────────────
  // Seeds managed by sync-who-regional / sync-endemic-data must stay current.
  // Two tiers:
  //   - High-frequency (InfoDengue, PAHO, manual weekly): flag if > 30 days
  //   - Everything else (DON/RRA-linked event clusters):  flag if > 180 days
  // This catches bugs like the InfoDengue newest-first ordering bug (dengue Brazil
  // stuck at Jan 4) before they silently persist for months.
  //
  // The default tier was 730 days until 2026-07-29, which made this check fail
  // OPEN: any seed source not explicitly listed as high-frequency could rot for
  // two years unnoticed. It bit twice in one day — the WPV1 Afghanistan row sat
  // 4 cases behind GPEI (fixed in b995b27 by moving those sources to the 30-day
  // tier), and Chikungunya/Singapore sat 235 days on a 2025 case count, missed
  // by two separate cluster cleanups, because nothing watches is_seed rows: 4b's
  // staleness check skips them outright, so this section is their only net.
  // 180 rather than something tighter is measured, not guessed: at 120 days it
  // would flag 11 rows today, 10 of them the same DON596 cereulide event already
  // tracked by morning-don-check's cluster count — the exact duplicate-noise
  // pattern removed from the dashboard ceiling earlier today. At 180 it flags 0
  // today while still catching a Singapore-shaped row, and reuses the same
  // number as that ceiling instead of adding another arbitrary constant.
  const SEED_FRESH_DAYS_HIGH    = 30;
  const SEED_FRESH_DAYS_DEFAULT = 180;
  // Weekly-cadence sources with NO ingestion cron — refreshed by hand. They were
  // falling through to the 730-day reference tier, so the WPV1 Afghanistan row sat
  // 4 cases behind GPEI (11 vs 15) with nothing flagging it (found 2026-07-29).
  // Any source listed here is expected to be re-checked manually within 30 days.
  const MANUAL_WEEKLY_SOURCES = ["polioeradication.org", "endpolio.com.pk"];
  const HIGH_FREQ_SOURCES = ["info.dengue", "paho.org", "reliefweb.int", ...MANUAL_WEEKLY_SOURCES];
  // GHO annual indicators store the epidemiological year as date (e.g. 2024-01-01).
  // WHO GHO publishes data 1–2 years late, so the date is always "old" by design.
  // Staleness on GHO sources cannot be detected via the date field — skip them.
  const GHO_ANNUAL_SOURCES = ["who.int/data/gho", "who.int/data/global-health-estimates"];
  const seedFreshHigh    = new Date(Date.now() - SEED_FRESH_DAYS_HIGH    * 86_400_000).toISOString().split("T")[0];
  const seedFreshDefault = new Date(Date.now() - SEED_FRESH_DAYS_DEFAULT * 86_400_000).toISOString().split("T")[0];

  for (const row of rows ?? []) {
    if (!row.is_seed || !row.date) continue;
    const src = (row.source ?? "").toLowerCase();
    if (GHO_ANNUAL_SOURCES.some(s => src.includes(s))) continue;
    const isHighFreq = HIGH_FREQ_SOURCES.some(s => src.includes(s));
    // Same bounding as 4b: a confirmation is honoured for the cadence its own
    // tier expects, no longer. Order matters — the GHO skip stays ahead of it,
    // since those rows are out of scope entirely, confirmed or not.
    if (isVerifiedStale(row, isHighFreq ? SEED_FRESH_DAYS_HIGH : SEED_FRESH_DAYS_DEFAULT)) continue;
    const threshold  = isHighFreq ? seedFreshHigh : seedFreshDefault;
    if (row.date <= threshold) {
      const daysSince = Math.round((Date.now() - new Date(row.date).getTime()) / 86_400_000);
      const cadence   = isHighFreq ? `attendu toutes les ${SEED_FRESH_DAYS_HIGH}j` : `seuil ${SEED_FRESH_DAYS_DEFAULT}j`;
      const isManual  = MANUAL_WEEKLY_SOURCES.some(s => src.includes(s));
      // Only the high-frequency tier is actually cron-fed, so pointing at
      // sync-who-regional for a DON/RRA cluster row sends the reader chasing a
      // cron that never touches it. For those, the real question is whether the
      // event is over (the row should be deactivated, like the 15 Chikungunya
      // countries closed on 17/07 and 28/07) or whether a newer bulletin exists.
      const action    = isManual
        ? `Ligne manuelle, aucun cron ne l'alimente : rafraîchir à la main depuis la source.`
        : isHighFreq
        ? `Vérifier que le cron sync-who-regional tourne correctement.`
        : `Cluster DON/RRA sans cron : vérifier si l'événement est terminé (désactiver) ou s'il existe un bulletin plus récent. Comparer aussi aux autres lignes du même cluster.`;
      needsReview.push({
        label: `[SEED] ${row.disease} / ${row.country}`,
        detail: `Donnée périmée — ${daysSince}j sans mise à jour (date: ${row.date}, ${cadence}). ${action}`,
      });
    }
  }

  // ── 4g. deaths=0 implausibilité pour maladies à mortalité connue ─────────────
  // Couvre TOUTES les lignes (seed + non-seed). La section 4d ne couvre que les
  // lignes non-seed pour ebola/marburg/nipah. Ce check élargit la couverture aux
  // données seed et aux maladies à mortalité modérée mais systématique.
  // deaths===0 = "zéro déclaré" (suspect) ; deaths===null = "non rapporté" (OK).
  const LETHALITY_RULES: Array<{
    pattern: RegExp;
    minCases: number;
    minCFRPct: number;
    note: string;
  }> = [
    { pattern: /ebola|marburg/i,             minCases: 5,    minCFRPct: 30,   note: "CFR 25-90%" },
    { pattern: /nipah/i,                     minCases: 5,    minCFRPct: 40,   note: "CFR 40-75%" },
    { pattern: /mers/i,                      minCases: 10,   minCFRPct: 20,   note: "CFR ~35%" },
    { pattern: /measles|rougeole|rubeola/i,  minCases: 1000, minCFRPct: 0.05, note: "CFR 0.05-1% selon région" },
    { pattern: /leishmaniasis/i,             minCases: 100,  minCFRPct: 1,    note: "LV : CFR ~2.8% traité, >95% sans" },
    { pattern: /cholera/i,                   minCases: 100,  minCFRPct: 0.5,  note: "CFR attendu 0.5-3% sans traitement rapide" },
    { pattern: /yellow fever|fièvre jaune/i, minCases: 10,   minCFRPct: 5,    note: "fièvre jaune sévère : CFR 20-50%" },
    { pattern: /diphtheria|diphtérie/i,      minCases: 50,   minCFRPct: 2,    note: "CFR 5-10% non vacciné" },
  ];

  // Verified exceptions: deaths=0 confirmed accurate against the primary source
  // (an explicit reported zero, not a parsing gap that should be NULL instead) —
  // without this, the check re-flags the same already-answered question every
  // single day forever, since the underlying count has no reason to change.
  // Re-verify against the source before ever removing an entry from this list.
  const VERIFIED_ZERO_DEATHS = new Set([
    // CDC explicitly states "0 confirmed deaths from measles in 2026" (measles_hosp.json) —
    // verified live 2026-07-10, see project_measles_us_description_drift_fixed memory.
    "measles|united states",
    // Cross-checked 2026-07-14 against the live WHO ArcGIS cholera feed
    // (cholera_adm0_week_view) that actually feeds this row — 151 cases / 0 deaths
    // over the only 2 reporting weeks Somalia has in 2026 (through 2026-01-12).
    // The field is a structured API value, not a text-parsing gap: WHO itself
    // reports zero, so NULL would be less accurate than 0 here.
    "cholera|somalia",
    // Cross-checked 2026-08-25 the same way as Somalia above, against the same
    // live WHO ArcGIS cholera feed (cholera_adm0_week_view) that feeds this
    // row — all 27 weekly features for Pakistan in 2026 (2026-01-05 through
    // 2026-07-06) explicitly report deaths=0, not a single null among them.
    // A 2026-08-24 fix (scripts/fix-cholera-pakistan-deaths-null-2026-08-24.mjs)
    // had set this row to NULL on the theory that the source was silent on
    // deaths rather than reporting a real zero — sync-who-regional's next run
    // correctly overwrote that back to 0 the next day, which is what surfaced
    // the wrong assumption: the raw feature data was never actually checked
    // before that fix, only inferred from the cross-country CFR comparison
    // below. Structured API value, not a parsing gap — same reasoning as
    // Somalia, so NULL would be less accurate than 0 here too.
    "cholera|pakistan",
    // PAHO Situation Report #6 (2 July 2026), Table 3 — "Canada 1,079 0 — Endemic",
    // a positively-filled deaths column (not a dash/omission), itself sourced from
    // PHAC's own EW24 weekly report (cited as reference #19 in the sitrep). Cross-
    // checked against an independent source (Yale VMOC, 17 May 2026): this outbreak's
    // only 2 deaths occurred in 2025, outside the 2026 reporting window this row
    // covers. Verified 2026-07-15/17, see project_qc_2026_07_15_stale_items_verified
    // memory — the CFR-floor heuristic below is a false positive on this specific row.
    "measles|canada",
    // PAHO Situation Report #8, Measles in the Americas Region (31 July 2026), the
    // row's own source: "Peru: 1,139 cases, 0 deaths" — a positively-filled deaths
    // column like the Canada row above, not a parsing gap. Verified 2026-08-08.
    "measles|peru",
  ]);

  for (const row of rows ?? []) {
    if (row.is_seed) continue; // GHO annual data rarely tracks deaths — null preferred over 0, but skip to avoid noise
    if (row.deaths !== 0) continue;
    const name = (row.disease_en ?? row.disease ?? "").toLowerCase();
    const countryKey = (row.country_en ?? row.country ?? "").toLowerCase();
    if (VERIFIED_ZERO_DEATHS.has(`${name}|${countryKey}`)) continue;
    for (const rule of LETHALITY_RULES) {
      if (!rule.pattern.test(name)) continue;
      if ((row.cases ?? 0) < rule.minCases) continue;
      const expectedMin = Math.max(1, Math.round((row.cases ?? 0) * rule.minCFRPct / 100));
      const seedTag = row.is_seed ? " [SEED]" : "";
      const countryLabel = row.country_en ?? row.country ?? "?";
      needsReview.push({
        label: `[DEATHS=0?] ${row.disease_en ?? row.disease} / ${countryLabel}${seedTag}`,
        detail: `deaths=0 avec ${(row.cases ?? 0).toLocaleString("fr-FR")} cas — suspect (${rule.note}, min ~${expectedMin} décès attendus). Vérifier si la source ne rapporte pas les décès (→ mettre NULL au lieu de 0).`,
      });
      break;
    }
  }

  // ── 4h. Endemic GHO reference rows must never be active ──────────────────────
  // Annual WHO GHO indicator rows (malaria / measles-incidence / yellow-fever /
  // leishmaniasis / diphtheria) are reference statistics with placeholder AAAA-01-01
  // dates — NOT time-limited outbreak events. Since 2026-07-06 sync-who-regional
  // ingests them active=false (see project_is_seed_design_conflict). If any resurface
  // as ACTIVE is_seed rows, an ingestion path has regressed and is silently
  // repopulating the map with annual statistics dressed as current outbreaks — the
  // exact loop that required manual cleanup on 2026-07-05 (28 rows) and 07-06 (30).
  // The seed-freshness check (4f) deliberately skips GHO sources, so nothing else
  // catches this. Allowlisted exception: wild-poliovirus PAK/AFG — a genuine ongoing
  // PHEIC kept active on purpose.
  const GHO_INDICATOR_MARKER = "indicator-details";
  const WPV_POLIO_MARKER     = "poliomyelitis-by-wild-poliovirus";
  const strayEndemic = (rows ?? []).filter((row) =>
    row.is_seed &&
    (row.source ?? "").includes(GHO_INDICATOR_MARKER) &&
    !(row.source ?? "").includes(WPV_POLIO_MARKER),
  );
  if (strayEndemic.length > 0) {
    const sample = strayEndemic
      .slice(0, 8)
      .map((r) => `${r.disease_en ?? r.disease}/${r.country_en ?? r.country}`)
      .join(", ");
    needsReview.push({
      label: `[SEED ACTIF] ${strayEndemic.length} statistique(s) GHO annuelle(s) active(s)`,
      detail: `Devraient être inactives (référence endémique, pas un foyer en cours) : ${sample}${strayEndemic.length > 8 ? "…" : ""}. Régression d'ingestion — vérifier sync-who-regional (doit ingérer active=false) et les scripts de seed. Désactiver via id=eq.<uuid>.`,
    });
  }

  // ── 4i. Admin1 groundedness vs. description ──────────────────────────────────
  // Catches admin1 values that don't actually appear anywhere in the row's own
  // description — the exact signature of a confirmed hallucination bug (2026-07-27,
  // see project_truncated_descriptions_audit_2026_07_27): an Avian Influenza/US row
  // stored admin1="Utah" while its description was entirely about Washington State,
  // and "Utah" appeared nowhere in either the description or the source DON. Multi-
  // part admin1 values ("South Kivu, North Kivu") are checked part by part, flagging
  // only if NONE of the parts appear. Does not catch the "real place, wrong
  // paragraph" failure mode (e.g. a bulletin's historical-background sentence naming
  // a different province than the current case) — only a total mismatch.
  for (const row of rows ?? []) {
    const admin1 = (row.admin1 ?? "").trim();
    if (admin1.length < 3 || row.is_seed) continue;
    const desc = (row.description ?? "").toLowerCase();
    if (!desc) continue;
    const parts = admin1.split(/,|&|\s+and\s+/i).map((p: string) => p.trim().toLowerCase()).filter(Boolean);
    if (!parts.some((p: string) => desc.includes(p))) {
      needsReview.push({
        label: `[ADMIN1?] ${row.disease_en ?? row.disease} / ${row.country_en ?? row.country}`,
        detail: `admin1="${row.admin1}" n'apparaît nulle part dans la description — vérifier une éventuelle erreur d'extraction géographique (cf. bug Utah/Washington du 27/07).`,
      });
    }
  }

  // ── 4j. GPEI coverage — countries the source reports, the base doesn't hold ───
  // See the parseGPEIThisWeek block above for why this exists. Two distinct
  // questions, both unanswerable from the rows alone:
  //   (1) does every country in this week's summary have an ACTIVE polio row?
  //   (2) is our newest polio row anywhere near the bulletin's own cut-off date?
  // (2) is not a duplicate of 4f's 30-day manual-source tier: GPEI republishes
  // weekly, so a hand-refresh that quietly stops is visible here after ~10 days
  // instead of 30, and it is measured against what the source actually says it
  // covers rather than against wall-clock time.
  const gpei = await fetchGPEIThisWeek();
  if (!gpei) {
    // Deliberately silent: an unreachable page or a retitled section is not a
    // data anomaly, and a daily "GPEI illisible" line would train the reader to
    // skim this email. The consequence is that a permanently broken parse stays
    // invisible here — the cron log below carries it instead.
    console.log("[data-quality] 4j — page GPEI illisible ou inchangée dans sa structure, contrôle de couverture polio sauté.");
  } else if (gpei.countries.length > 0) {
    const { data: polioRows, error: polioErr } = await supabase
      .from("outbreaks")
      .select("country, country_en, active, date")
      .or("disease_en.ilike.*polio*,disease.ilike.*polio*");
    if (polioErr) {
      needsReview.push({
        label: "[GPEI] Contrôle de couverture polio impossible",
        detail: `Lecture des lignes polio en échec (${polioErr.message}) — la page GPEI a bien été lue (${gpei.countries.length} pays cette semaine), la comparaison n'a pas pu se faire.`,
      });
    } else {
      const activeKeys = new Set<string>();
      const anyKeys    = new Set<string>();
      let newestPolioDate: string | null = null;
      for (const r of polioRows ?? []) {
        const key = normalizeCountryKey(r.country_en ?? r.country ?? "");
        if (!key) continue;
        anyKeys.add(key);
        if (r.active) {
          activeKeys.add(key);
          if (r.date && (!newestPolioDate || r.date > newestPolioDate)) newestPolioDate = r.date;
        }
      }

      for (const c of gpei.countries) {
        const key = normalizeCountryKey(c.name);
        if (activeKeys.has(key)) continue;
        const dormant = anyKeys.has(key);
        needsReview.push({
          label: `[GPEI] Polio / ${c.name}`,
          detail: dormant
            ? `Le GPEI rapporte « ${esc(c.note)} » cette semaine, mais la ligne polio de ce pays est INACTIVE en base — la réactiver et la remettre à jour depuis ${GPEI_THIS_WEEK_URL}.`
            : `Le GPEI rapporte « ${esc(c.note)} » cette semaine et AUCUNE ligne polio n'existe pour ce pays — trou de couverture, pas une donnée périmée. Source : ${GPEI_THIS_WEEK_URL}${gpei.asOf ? ` (arrêtée au ${gpei.asOf})` : ""}.`,
        });
      }

      const GPEI_MAX_LAG_DAYS = 10;
      if (gpei.asOf && newestPolioDate) {
        const lagDays = Math.round((new Date(gpei.asOf).getTime() - new Date(newestPolioDate).getTime()) / 86_400_000);
        if (lagDays > GPEI_MAX_LAG_DAYS) {
          needsReview.push({
            label: "[GPEI] Lignes polio en retard sur le bulletin",
            detail: `Le GPEI publie des données arrêtées au ${gpei.asOf} ; la ligne polio la plus récente en base est datée du ${newestPolioDate} (${lagDays}j d'écart, seuil ${GPEI_MAX_LAG_DAYS}j). Aucun cron n'alimente ces lignes : rafraîchir à la main depuis ${GPEI_THIS_WEEK_URL}.`,
          });
        }
      }
    }
  }

  // ── 4k. Multi-day regression watermark on locked / PHEIC rows ─────────────
  // Section 3 only ever compares against YESTERDAY's snapshot (`.eq("snapped_at",
  // yesterday)` above), and sync-outbreaks rewrites the current day's snapshot
  // every hour (`upsert` on `outbreak_id,snapped_at`), so a day's snapshot ends
  // up holding that day's LAST value. A bad write at 08:13 is therefore baked
  // into today's snapshot by the 09:00 sync: today's data-quality run still sees
  // it (it compares against yesterday), and every run after that compares the
  // wrong figure against itself. The detection window is exactly one run.
  //
  // Real case, 2026-08-22: the flagship Ebola/DR Congo row (source_priority=10,
  // is_pheic, on the public map) went from 5,021 to 534 cases and 2,378 to 93
  // deaths through a write outside the tracked cron system. The root cause was
  // never found, so nothing rules out a repeat — and the same incident exposes
  // two further blind spots:
  //   - deaths have NO regression detection at any horizon (section 3 tests
  //     deathsExceedCases, isZeroData, then drop/spike on `cases` only; 4d
  //     covers three diseases and only the exact `deaths === 0` case), so the
  //     −96% death collapse was only ever visible by riding along with cases;
  //   - a slow bleed (−30%/day for four days, −76% overall) never trips the
  //     40%-against-yesterday threshold on any single day.
  //
  // Answer: a high-water mark. For the small set of rows whose every figure has
  // a human decision behind it, compare against the MAXIMUM of the last
  // WATERMARK_DAYS days rather than against yesterday alone. Reports only,
  // never auto-fixes — same rule and same reason as the source_priority >= 10
  // branch in section 4 above. Scope is deliberately narrow: the false-positive
  // rate on all ~114 active rows can't be measured from here, and a locked row
  // that loses 60% of its cases is worth being told about twice.
  const WATERMARK_DAYS = 14;
  const watched = (rows ?? []).filter(
    (r) => !r.is_seed && ((r.source_priority ?? 0) >= 10 || r.is_pheic) && !anomalyIds.has(r.id),
  );
  if (watched.length > 0) {
    const since = new Date(Date.now() - WATERMARK_DAYS * 86_400_000).toISOString().split("T")[0];
    const { data: hist, error: histErr } = await supabase
      .from("outbreak_snapshots")
      .select("outbreak_id, cases, deaths, snapped_at")
      .in("outbreak_id", watched.map((r) => r.id))
      .gte("snapped_at", since)
      .lt("snapped_at", today);

    if (histErr) {
      // Fail loud, not closed: this check exists precisely because the row it
      // watches can be wrong without anything else noticing.
      needsReview.push({
        label: "[WATERMARK] Contrôle de régression indisponible",
        detail: `Lecture de outbreak_snapshots impossible (${histErr.message}) — la régression multi-jours des ${watched.length} ligne(s) verrouillée(s)/PHEIC n'a été vérifiée sur aucun horizon aujourd'hui.`,
      });
    } else {
      const highs = new Map<string, { cases: number; casesAt: string; deaths: number; deathsAt: string }>();
      for (const s of hist ?? []) {
        const hi = highs.get(s.outbreak_id);
        if (!hi) {
          highs.set(s.outbreak_id, { cases: s.cases, casesAt: s.snapped_at, deaths: s.deaths, deathsAt: s.snapped_at });
          continue;
        }
        if (s.cases  > hi.cases)  { hi.cases  = s.cases;  hi.casesAt  = s.snapped_at; }
        if (s.deaths > hi.deaths) { hi.deaths = s.deaths; hi.deathsAt = s.snapped_at; }
      }

      if (highs.size === 0) {
        // Distinct from section 3's coverage floor, which only looks at
        // yesterday: here the whole WATERMARK_DAYS window is empty for every
        // watched row, so this check silently compares against nothing.
        needsReview.push({
          label: "[WATERMARK] Aucun historique sur les lignes verrouillées",
          detail: `Aucun instantané entre le ${since} et hier pour les ${watched.length} ligne(s) verrouillée(s)/PHEIC — la détection de régression multi-jours ne compare à rien. Vérifier l'upsert outbreak_snapshots dans sync-outbreaks.`,
        });
      }

      for (const row of watched) {
        const hi = highs.get(row.id);
        if (!hi) continue;
        const label = `${row.disease} / ${row.country}`;
        const lock = (row.source_priority ?? 0) >= 10 ? "verrouillée" : "PHEIC";

        // Same thresholds as section 3's day-1 drop check, so nothing new to
        // tune: only the comparison basis changes (14-day high, not yesterday).
        if (isCollapse(row.cases ?? 0, hi.cases, { minPreviousCases: 100, ratio: 0.4 })) {
          const pct = Math.round((hi.cases - (row.cases ?? 0)) / hi.cases * 100);
          needsReview.push({
            label,
            detail: `Régression sur ${WATERMARK_DAYS}j : ${hi.cases.toLocaleString("fr-FR")} cas au ${hi.casesAt} → ${(row.cases ?? 0).toLocaleString("fr-FR")} aujourd'hui (−${pct}%). Ligne ${lock} : la chute n'a pas été signalée le jour même, ou l'a été et n'a pas été corrigée. Vérifier contre la source primaire (${row.source ?? "source absente"}) avant toute écriture — aucune correction automatique n'est appliquée sur ces lignes.`,
          });
        }

        // Deaths are cumulative on these rows too, and until now nothing
        // watched them: a write that keeps `cases` and slashes `deaths` passes
        // every existing check (the CFR floor in 4d only fires on exactly 0).
        if (isCollapse(row.deaths ?? 0, hi.deaths, { minPreviousCases: 20, ratio: 0.4 })) {
          const pct = Math.round((hi.deaths - (row.deaths ?? 0)) / hi.deaths * 100);
          needsReview.push({
            label,
            detail: `Régression des décès sur ${WATERMARK_DAYS}j : ${hi.deaths.toLocaleString("fr-FR")} décès au ${hi.deathsAt} → ${(row.deaths ?? 0).toLocaleString("fr-FR")} aujourd'hui (−${pct}%), à ${(row.cases ?? 0).toLocaleString("fr-FR")} cas. Ligne ${lock} : vérifier contre la source primaire (${row.source ?? "source absente"}).`,
          });
        }
      }
    }
  }

  // ── 4l. Rows that just left the map ───────────────────────────────────────
  // Everything above this line reads `rows`, i.e. `.eq("active", true)`. The moment
  // a row is deactivated it drops out of all eleven sections at once — staleness,
  // regression, CFR, duplication, the 14-day watermark — and becomes indistinguishable
  // from a country with no outbreak at all. Section 4j is the sole exception, and
  // only for polio, only because it compares against an external source.
  //
  // Real case, 2026-08-24: Cholera/Angola and Cholera/Yemen had been switched off
  // while stuck at 31/05 figures, and WHO kept publishing for both (5,361 cases /
  // 117 deaths to 13/07, 5,196 / 7 to 29/06). Ongoing outbreaks displayed as closed
  // for six weeks, found by hand while auditing something else.
  //
  // Detection goes through outbreak_snapshots rather than `active` + `updated_at`:
  // sync-outbreaks only ever snapshots ACTIVE rows, so a row that is inactive today
  // yet still carries a snapshot from the last RECENT_EXIT_DAYS days necessarily
  // left the map within that window — whatever path took it out (the stale sweep in
  // sync-outbreaks, a source cron's own deactivation, section 4e above, the admin
  // button, or a hand-run script). Reports only: nothing is ever reactivated here.
  //
  // Known and accepted: a row is listed on two consecutive mornings. The hourly sync
  // already wrote today's snapshot before the sweep switched it off, so it stays
  // inside the window one extra day. A daily report gets skipped often enough that
  // the duplicate is worth more than a net that closes a day too early.
  const RECENT_EXIT_DAYS = 2;
  const EXIT_LIST_CAP    = 15;
  const exitSince = new Date(Date.now() - RECENT_EXIT_DAYS * 86_400_000).toISOString().split("T")[0];
  const { data: recentSnaps, error: recentSnapsErr } = await supabase
    .from("outbreak_snapshots")
    .select("outbreak_id, snapped_at")
    .gte("snapped_at", exitSince);

  if (recentSnapsErr) {
    needsReview.push({
      label: "[SORTIE DE CARTE] Contrôle indisponible",
      detail: `Lecture de outbreak_snapshots impossible (${recentSnapsErr.message}) — aucune vérification des lignes récemment désactivées ce matin.`,
    });
  } else {
    const activeIds  = new Set((rows ?? []).map((r) => r.id));
    const lastSeen   = new Map<string, string>();
    for (const s of recentSnaps ?? []) {
      const prev = lastSeen.get(s.outbreak_id);
      if (!prev || s.snapped_at > prev) lastSeen.set(s.outbreak_id, s.snapped_at);
    }
    const exitedIds = [...lastSeen.keys()].filter((id) => !activeIds.has(id));

    if (exitedIds.length > 0) {
      const { data: exitedRows, error: exitedErr } = await supabase
        .from("outbreaks")
        .select("id, disease, disease_en, country, country_en, cases, deaths, date, source, source_priority, is_seed")
        .in("id", exitedIds);

      if (exitedErr) {
        needsReview.push({
          label: "[SORTIE DE CARTE] Lignes désactivées non identifiables",
          detail: `${exitedIds.length} ligne(s) instantanéisée(s) depuis le ${exitSince} ne sont plus actives, mais leur lecture a échoué (${exitedErr.message}) — impossible de dire lesquelles.`,
        });
      } else {
        // GHO annual reference rows are ingested inactive and never snapshotted, so
        // they shouldn't show up here at all — skipped rather than trusted not to,
        // by the same marker section 4h uses. Deliberately NOT a blanket `!is_seed`
        // filter: the polio PHEIC seeds are active, snapshotted and on the public
        // map, so one of them going dark is exactly what this section is for.
        const exited = (exitedRows ?? []).filter(
          (r) => !(r.is_seed && (r.source ?? "").includes(GHO_INDICATOR_MARKER)),
        );
        const shown  = exited.slice(0, EXIT_LIST_CAP);
        for (const row of shown) {
          const label = `${row.disease} / ${row.country}`;
          needsReview.push({
            label: `[SORTIE DE CARTE] ${label}`,
            detail: `Ligne désactivée depuis le ${lastSeen.get(row.id)} (dernier instantané) — elle n'apparaît plus sur la carte publique et sort de tous les autres contrôles de ce rapport. Dernier état connu : ${(row.cases ?? 0).toLocaleString("fr-FR")} cas / ${(row.deaths ?? 0).toLocaleString("fr-FR")} décès au ${row.date}. Vérifier que la source a réellement cessé de publier (${row.source ?? "source absente"}) et non qu'elle continue pendant que cette ligne reste désactivée — déjà arrivé (Choléra/Angola et Choléra/Yémen coupées le 24/08 alors que l'OMS publiait toujours). Aucune réactivation automatique.`,
          });
        }
        if (exited.length > shown.length) {
          needsReview.push({
            label: `[SORTIE DE CARTE] ${exited.length - shown.length} ligne(s) de plus, non listées`,
            detail: `${exited.length} ligne(s) au total ont quitté la carte depuis le ${exitSince} ; seules les ${EXIT_LIST_CAP} premières sont détaillées ci-dessus. Un lot de cette taille est en soi à vérifier (balayage de fraîcheur trop large, ou source qui a cessé de publier en bloc) : lister le reste via active=eq.false&order=updated_at.desc.`,
          });
        }
        // An id that was snapshotted and no longer exists at all was deleted outright
        // — also a silent map exit, and one no `active=false` query would ever find.
        const found = new Set((exitedRows ?? []).map((r) => r.id));
        const gone  = exitedIds.filter((id) => !found.has(id));
        if (gone.length > 0) {
          needsReview.push({
            label: `[SORTIE DE CARTE] ${gone.length} ligne(s) supprimée(s)`,
            detail: `Instantané(s) postérieur(s) au ${exitSince} pour ${gone.length} ligne(s) qui n'existent plus du tout dans outbreaks : ${gone.slice(0, 5).join(", ")}${gone.length > 5 ? "…" : ""}. Une suppression pure et simple, pas une désactivation — vérifier qu'elle était voulue.`,
          });
        }
      }
    }
  }

  // ── 4m. Provenance of what the public site displays ───────────────────────
  // lib/source-trust.ts decides, for every row on the site, whether the figure is
  // badged "official source verified" with a live link or "illustrative" with none.
  // Until today nothing checked its verdict on a schedule: scripts/check-source-trust.mjs
  // is run by hand, and only "before shipping an edit to the allowlists" — so between
  // two such edits the classifier drifts against a table that changes every day, and
  // nobody sees it. It had drifted: on 2026-08-26 three DISPLAYED rows carried the
  // 'unverified' badge, among them Cholera/Cameroon (1 342 cases) sourced to ccousp.cm,
  // the country's own public-health emergency operations centre — a genuine national
  // authority shown to clients as unsourced, since the detail page hides the link for
  // that tier (app/[locale]/outbreak/[id]/page.tsx).
  //
  // Two findings, deliberately kept apart: a forbidden publisher is a legal matter and
  // always red, an 'unverified' tier is a credibility matter and often just means the
  // host is new and nobody has classified it yet.
  //
  // Reads its own row set rather than `rows`: every section above is active-only, and
  // the whole point here is that a row keeps its badge and its source link for 60 days
  // AFTER being deactivated (getOutbreaksCached in lib/outbreaks.ts). Switching a row
  // off is not the same as taking it down — see the ReliefWeb rows of 2026-08-26, all
  // switched off in the morning and three of them still on the site that evening.
  const PROVENANCE_LIST_CAP = 10;
  const displayedSince = new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0];
  const { data: displayedRows, error: displayedErr } = await supabase
    .from("outbreaks")
    .select("id, disease, country, cases, deaths, date, source, active, source_priority")
    .or(`active.eq.true,and(source_priority.gte.3,updated_at.gte.${displayedSince},date.gte.${displayedSince})`);

  if (displayedErr) {
    needsReview.push({
      label: "[PROVENANCE] Contrôle indisponible",
      detail: `Lecture du jeu de lignes affichées impossible (${displayedErr.message}) — aucune vérification de la provenance des sources ce matin.`,
    });
  } else {
    const forbidden  = (displayedRows ?? []).filter((r) => isForbiddenSourceHost(r.source));
    const unverified = (displayedRows ?? []).filter(
      (r) => !isForbiddenSourceHost(r.source) && sourceStatusOf(r.source) === "unverified",
    );

    for (const row of forbidden.slice(0, PROVENANCE_LIST_CAP)) {
      needsReview.push({
        label: `[SOURCE INTERDITE] ${row.disease} / ${row.country}`,
        detail: `Cette ligne est affichée sur le site public (active=${row.active}, priorité ${row.source_priority ?? 0}) en citant un éditeur que HWG n'a pas le droit de citer : ${row.source}. ${(row.cases ?? 0).toLocaleString("fr-FR")} cas / ${(row.deaths ?? 0).toLocaleString("fr-FR")} décès au ${row.date}. Désactiver la ligne ne suffit pas : au-dessus de source_priority 3 elle reste affichée 60 jours après coup, et l'écriture de désactivation rafraîchit elle-même la moitié de cette fenêtre. La re-sourcer vers un éditeur autorisé, ou la sortir de la fenêtre d'affichage. Voir FORBIDDEN_SOURCE_DOMAINS dans lib/source-trust.ts.`,
      });
    }
    if (forbidden.length > PROVENANCE_LIST_CAP) {
      needsReview.push({
        label: `[SOURCE INTERDITE] ${forbidden.length - PROVENANCE_LIST_CAP} ligne(s) de plus, non listées`,
        detail: `${forbidden.length} lignes affichées au total citent un éditeur interdit ; seules les ${PROVENANCE_LIST_CAP} premières sont détaillées. Lister le reste avec node scripts/check-source-trust.mjs.`,
      });
    }

    if (unverified.length > 0) {
      const shown = unverified.slice(0, PROVENANCE_LIST_CAP);
      needsReview.push({
        label: `[PROVENANCE] ${unverified.length} ligne(s) affichée(s) sans source vérifiable`,
        detail:
          `Ces lignes sont visibles sur le site public avec la pastille « illustratif » et SANS lien vers leur source (le lien est masqué pour ce niveau) : ` +
          shown
            .map(
              (r) =>
                `${r.disease} / ${r.country} (${(r.cases ?? 0).toLocaleString("fr-FR")} cas, ${sourceName(r.source)}) — ${r.source ?? "source absente"}`,
            )
            .join(" | ") +
          (unverified.length > shown.length ? ` | +${unverified.length - shown.length} autre(s)` : "") +
          `. Deux causes possibles, à distinguer ligne par ligne : soit la source est réellement faible (réseau social, blog, texte sans URL) et la ligne est à re-sourcer, soit c'est une autorité légitime que personne n'a encore inscrite dans les listes d'éditeurs de lib/source-trust.ts — auquel cas un chiffre vrai s'affiche comme non sourcé. Trancher avec node scripts/check-source-trust.mjs avant toute modification des listes.`,
      });
    }
  }

  // ── 5. Notable movements (top 5 largest absolute change, no anomaly) ──────
  type Movement = { label: string; before: number; after: number; delta: number };
  const movements: Movement[] = [];

  for (const row of rows ?? []) {
    if (anomalyIds.has(row.id)) continue;
    const snap = snapMap.get(row.id);
    if (!snap || snap.cases === 0) continue;
    const delta = row.cases - snap.cases;
    if (Math.abs(delta) > 0) {
      movements.push({ label: `${row.disease} / ${row.country}`, before: snap.cases, after: row.cases, delta });
    }
  }
  movements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topMovements = movements.slice(0, 5);

  // ── 6. Build and send email ───────────────────────────────────────────────
  const allClear = fixes.length === 0 && needsReview.length === 0;
  const subject = allClear
    ? `✅ HealthWatch — contrôle qualité RAS (${today})`
    : fixes.length > 0 && needsReview.length === 0
    ? `✅ HealthWatch — ${fixes.length} correction(s) appliquée(s) (${today})`
    : `⚠️ HealthWatch — ${needsReview.length} anomalie(s) à vérifier (${today})`;

  const fixesHtml = fixes.length > 0
    ? `<h3 style="color:#16a34a">✅ Corrections appliquées (${fixes.length})</h3><ul>` +
      fixes.map((f) => `<li><strong>${esc(f.label)}</strong> : ${f.before} → ${f.after}</li>`).join("") +
      `</ul>`
    : `<p style="color:#16a34a">✅ Aucune correction nécessaire.</p>`;

  const reviewHtml = needsReview.length > 0
    ? `<h3 style="color:#d97706">⚠️ À vérifier manuellement (${needsReview.length})</h3><ul>` +
      needsReview.map((r) => `<li><strong>${esc(r.label)}</strong> : ${r.detail}</li>`).join("") +
      `</ul>`
    : "";

  const movementsHtml = topMovements.length > 0
    ? `<h3 style="color:#2563eb">📈 Mouvements du jour (top ${topMovements.length})</h3><ul>` +
      topMovements.map((m) => {
        const pct = Math.round(((m.after - m.before) / m.before) * 100);
        const sign = pct >= 0 ? "+" : "";
        return `<li>${esc(m.label)} : ${m.before.toLocaleString("fr-FR")} → ${m.after.toLocaleString("fr-FR")} cas (${sign}${pct}%)</li>`;
      }).join("") +
      `</ul>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <h2 style="border-bottom:2px solid #e5e7eb;padding-bottom:8px">
        📊 Contrôle qualité HealthWatch Global — ${today}
      </h2>
      <p style="color:#6b7280">
        Lignes actives : <strong>${rows?.length ?? 0}</strong> &nbsp;|&nbsp;
        Anomalies détectées : <strong>${anomalies.length}</strong> &nbsp;|&nbsp;
        Corrections : <strong>${fixes.length}</strong>
      </p>
      ${fixesHtml}
      ${reviewHtml}
      ${movementsHtml}
      ${allClear ? '<p style="color:#6b7280;font-style:italic">Toutes les données sont cohérentes — aucune action requise.</p>' : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">
        Généré automatiquement par le cron /api/cron/data-quality · ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
      </p>
    </div>`;

  if (adminEmail && isRealProduction) await sendEmail(adminEmail, subject, html);

  const result = {
    success: true,
    date: today,
    activeRows: rows?.length ?? 0,
    anomaliesDetected: anomalies.length,
    fixes: fixes.length,
    needsReview: needsReview.length,
    topMovements: topMovements.length,
    emailSent: !!adminEmail,
  };

  await logCronRun(supabase, "data-quality", "ok", fixes.length);
  console.log("[data-quality]", result);
  return NextResponse.json(result);
}
