// Weekly poll of WHO WPRO's biweekly "Dengue Situation Update" bulletin, for
// the three places whose cumulative case counts are only extractable from
// this report's free-text narrative (no other cron covers them, or covers
// them from a laggier source):
//
//   - New Caledonia and French Polynesia: found 2026-08-03 to be entirely
//     missing from `outbreaks` (see project_oceania_coverage_gap_dengue_pacific
//     memory) and manually inserted from edition #749. The manual insert's own
//     comment claimed "the series has no stable listing page" — that turned
//     out to be wrong (the index page below lists every edition, newest
//     first) and the two rows went stale immediately, still on #749's figures
//     while #750 was already published. This cron replaces that one-off
//     insert with a recurring fetch off the real index.
//   - Cambodia: already covered by sync-who-regional's fetchDengueGlobalSurveillance,
//     which sums WHO's global xmart dataset (worldhealthorg.shinyapps.io/dengue_global).
//     That dataset lags the national surveillance system by several weeks —
//     confirmed 2026-08-03 by querying it directly: latest ISO week in the API
//     was 2026-06-22 (18,400 cases), while this same day's Situation Update
//     #750 cites Cambodia's own National Dengue Surveillance System at 28,074
//     cases / 38 deaths as of 12 July. This cron's figure is written at a
//     higher source_priority (6 vs sync-who-regional's hardcoded 5) so it
//     wins going forward — see the priority-guard comment on the Cambodia
//     write below.
//
// WHO WPRO is WHO's own Regional Office for the Western Pacific, so this
// cron can write onto rows locked at source_priority=10 (ceiling raised
// 2026-08-19 alongside sync-who-afro/emro — see
// project_source_priority_is_ownership_not_freeze_2026_08_19). Additional
// lockedRowRegressionGuard refuses any decrease on a locked row.
//
// Every other country in this bulletin (Cambodia aside) is either narrated
// only as an unlabelled chart (most PICs) or already covered by a more
// authoritative per-country source elsewhere (India/Brazil/etc via other
// fetchers, PAHO members via sync-paho-alerts) — deliberately not extending
// this to the whole bulletin.
//
// Discovery (verified 2026-08-03, same who.int family and PDF-link quirk
// already documented in sync-pacific-surveillance, which this file mirrors):
//   1. GET the listing page (redirects to .../wpro-emergencies/surveillance/dengue,
//      lists editions newest-first):
//      https://www.who.int/westernpacific/emergencies/surveillance/dengue
//   2. Regex out the first (= latest) "dengue-situation-update---N--DATE" item
//      page URL.
//   3. GET that item page; its PDF link renders as an UNQUOTED href attribute,
//      same as the PSSS bulletin item pages — a quoted-href regex misses it.
//   4. Download the PDF and extract plain text (pdf-parse's default text
//      join — no position reconstruction needed here, this is prose, not a
//      table like PSSS). Whitespace inside the PDF is irregular (multiple
//      spaces / line breaks even mid-sentence, e.g. "In  weeks 27 and 28"),
//      so the whole text is first collapsed to single-spaced before any
//      regex runs.
//
// Per-country extraction was written against, and verified word-for-word on,
// edition #750 (23 July 2026), then re-verified against #749 (9 July 2026) to
// catch phrasing that #750 alone didn't exercise — French Polynesia's
// "cumulative total" sentence survives even when the rest of its paragraph
// says "There was no update ... in this reporting period" and gives no date
// range at all, which #749 does and #750 doesn't. See extractCumulativeTotal
// and its comment below for how the date fallback handles that.
//
// Schedule: 20 8 * * 1 (Monday, 5 minutes after sync-pacific-surveillance) —
// the bulletin itself publishes roughly every two weeks, so most Monday runs
// will simply find the same edition already applied (dateFloorGuard +
// no-op-if-date-unchanged make that a cheap, harmless skip) — same "poll
// weekly, no-op most weeks" tradeoff already accepted for sync-pacific-surveillance.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import {
  dateFloorGuard, spikeGuard, collapseGuard, zeroCaseGuard, zeroDeathGuard, lockedRowRegressionGuard,
  type GuardedIncoming, type GuardedLockedRow,
} from "@/lib/outbreak-guards";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const LISTING_URL = "https://www.who.int/westernpacific/emergencies/surveillance/dengue";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// This cron's writes use source_priority=6 — one above sync-who-regional's
// hardcoded 5 — specifically so its Cambodia write (below) blocks that
// cron's laggier global-dashboard figure from overwriting this one. Applied
// uniformly to all three targets rather than just Cambodia, for consistency:
// none of the other targets have a competing writer today, so the value is
// inert for them, but stays correct if one is ever added.
const SOURCE_PRIORITY = 6;

interface Target {
  disease_en:  string;
  country_en:  string;
  extract: (text: string) => { isoDate: string | null; cases: number; deaths: number | null } | null;
}

function parseGroupedNumber(s: string): number {
  return parseInt(s.replace(/[^\d]/g, ""), 10);
}

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

// "19 July 2026" -> "2026-07-19"
function parseBulletinDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

// The report's own masthead date ("Dengue Situation Update 750 23 July
// 2026") — used as a fallback for countries whose paragraph, in a given
// edition, states a cumulative total without a specific date range attached
// (seen for real on French Polynesia's "no update this reporting period"
// phrasing in edition #749, see below).
function bulletinDate(text: string): string | null {
  const m = text.match(/Dengue Situation Update \d+\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
  return m ? parseBulletinDate(m[1]) : null;
}

// Slices the text between two headings (exclusive of `start`, up to but
// excluding `end`). Both New Caledonia and French Polynesia's paragraphs sit
// directly under fixed neighbouring headings in every edition checked
// (#749, #750), so a plain indexOf-based slice is enough — no need for the
// PSSS bulletin's position-aware table reconstruction, this is prose.
function section(text: string, start: string, end: string | null): string | null {
  const s = text.indexOf(start);
  if (s === -1) return null;
  const from = s + start.length;
  const e = end ? text.indexOf(end, from) : -1;
  return text.slice(from, e === -1 ? text.length : e);
}

// New Caledonia and French Polynesia share one phrasing family for their
// running total ("... bringing the cumulative total [in 2026] to N [confirmed]
// cases [in 2026]" — the "in 2026" clause lands before "to" in some editions
// and after "cases" in others, verified on both #749 and #750) but differ on
// whether a specific date range is stated in the same paragraph: New
// Caledonia always has one ("In weeks 27 and 28 (6 to 19 July 2026), ..."),
// French Polynesia only has one when there was a fresh weekly update —
// edition #749 instead opens with "There was no update ... in this reporting
// period" and never states a date range at all, even though it still gives an
// updated cumulative total two sentences later. Falls back to the bulletin's
// own masthead date in that case, verified against #749 above.
function extractCumulativeTotal(text: string, startMarker: string, endMarker: string | null) {
  const sec = section(text, startMarker, endMarker);
  if (!sec) return null;
  const casesMatch = sec.match(
    /cumulative\s+total\s*(?:in\s+2026)?\s+to\s+([\d\s]+?)\s+(?:confirmed\s+)?cases(?:\s+in\s+2026)?/i
  );
  if (!casesMatch) return null;
  const dateMatch = sec.match(/\(\d+(?:\s+[A-Za-z]+)?\s+to\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\)/i);
  const isoDate = dateMatch ? parseBulletinDate(dateMatch[1]) : bulletinDate(text);
  return { isoDate, cases: parseGroupedNumber(casesMatch[1]), deaths: null as number | null };
}

const TARGETS: Target[] = [
  {
    disease_en: "Dengue fever",
    country_en: "New Caledonia",
    extract: (text) => extractCumulativeTotal(text, "New Caledonia", "Other Pacific Island Countries and Areas"),
  },
  {
    disease_en: "Dengue fever",
    country_en: "French Polynesia",
    extract: (text) => extractCumulativeTotal(text, "French Polynesia", "New Caledonia"),
  },
  {
    disease_en: "Dengue fever",
    country_en: "Cambodia",
    // "Cambodia As of 12 July 2026, a total of 28 074 dengue cases, including
    // 38 deaths (case fatality rate: 0.1%), have been reported through the
    // National Dengue Surveillance System." Cambodia is a weekly-reported
    // national system, so unlike French Polynesia every edition checked
    // states cases/deaths together with an explicit "As of DATE" — a second,
    // date-less pattern is kept as a fallback (using the bulletin masthead
    // date) in case a future edition drops it the way French Polynesia does.
    extract: (text) => {
      const sec = section(text, "Cambodia", "China");
      if (!sec) return null;
      const withDate = sec.match(
        /As of (\d{1,2}\s+[A-Za-z]+\s+\d{4}),\s*a total of\s*([\d\s]+?)\s*dengue cases,\s*including\s*(\d+)\s*deaths/i
      );
      if (withDate) {
        return { isoDate: parseBulletinDate(withDate[1]), cases: parseGroupedNumber(withDate[2]), deaths: parseInt(withDate[3], 10) };
      }
      const noDate = sec.match(/a total of\s*([\d\s]+?)\s*dengue cases,\s*including\s*(\d+)\s*deaths/i);
      if (!noDate) return null;
      return { isoDate: bulletinDate(text), cases: parseGroupedNumber(noDate[1]), deaths: parseInt(noDate[2], 10) };
    },
  },
];

// ── Discovery ──────────────────────────────────────────────────────────────

async function findLatestEditionUrl(): Promise<{ itemUrl: string; edition: string }> {
  const res = await fetch(LISTING_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`listing page HTTP ${res.status}`);
  const html = await res.text();
  // Listed newest-first — first match is the latest edition.
  const match = html.match(
    /https:\/\/www\.who\.int\/westernpacific\/publications\/m\/item\/dengue-situation-update---(\d+)--[^"]+/
  );
  if (!match) throw new Error("no Dengue Situation Update link found on listing page");
  return { itemUrl: match[0], edition: match[1] };
}

async function findPdfUrl(itemUrl: string): Promise<string> {
  const res = await fetch(itemUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`item page HTTP ${res.status}`);
  const html = await res.text();
  // Unquoted href, same quirk as the PSSS bulletin item pages — verified
  // 2026-08-03. A quoted-href regex (`href="..."`) matches nothing here.
  const match = html.match(
    /href=(https:\/\/cdn\.who\.int\/media\/docs\/default-source\/wpro---documents\/emergency\/surveillance\/dengue\/[^\s">]+\.pdf[^\s">]*)/
  );
  if (!match) throw new Error("no PDF link found on bulletin item page");
  // The unquoted href carries an HTML-entity-escaped "&amp;" before the
  // download param (e.g. "...pdf?sfvrsn=xxx&amp;download=true"). WHO's CDN
  // tolerates the literal, undecoded string as a request URL (verified
  // 2026-08-03 — the PDF still downloads correctly either way), but decoding
  // it is the correct thing to send, not a "works by luck" reliance on that.
  return match[1].replace(/&amp;/g, "&");
}

async function extractBulletinText(pdfBuffer: Buffer): Promise<string> {
  const pdfParseFn = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
    (buf: Buffer) => Promise<{ text: string }>;
  const { text } = await pdfParseFn(pdfBuffer);
  // Collapse all whitespace (including the irregular multi-space/line-break
  // runs mid-sentence that this PDF's text layer produces) to single spaces
  // so every extraction regex can assume normal spacing.
  return text.replace(/\s+/g, " ");
}

// ── Main handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    return await runWproDengueUpdate(supabase);
  } catch (err) {
    console.error("[sync-wpro-dengue-update] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-wpro-dengue-update" } });
    await logCronRun(supabase, "sync-wpro-dengue-update", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runWproDengueUpdate(supabase: SupabaseClient) {
  const { itemUrl, edition } = await findLatestEditionUrl();
  const pdfUrl = await findPdfUrl(itemUrl);

  const pdfRes = await fetch(pdfUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!pdfRes.ok) throw new Error(`Dengue Situation Update PDF HTTP ${pdfRes.status}`);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  const text = await extractBulletinText(pdfBuffer);

  const log: { label: string; status: string; detail: string }[] = [];
  let updated = 0, skipped = 0, errors = 0;
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the push site below for why these,
  // and only these, need to reach the health-check.
  const lockedGuardBlocked: string[] = [];

  for (const target of TARGETS) {
    const label = `${target.disease_en}/${target.country_en}`;
    const parsed = target.extract(text);
    if (!parsed) {
      log.push({ label, status: "skip", detail: "regex did not match this edition's phrasing" });
      skipped++;
      continue;
    }
    const isoDate = parsed.isoDate;
    if (!isoDate) {
      log.push({ label, status: "skip", detail: "no usable date (neither a specific range nor the bulletin masthead date parsed)" });
      skipped++;
      continue;
    }
    if (parsed.cases <= 0) {
      log.push({ label, status: "skip", detail: `implausible cases (${parsed.cases})` });
      skipped++;
      continue;
    }

    const { data: existingRow, error: fetchErr } = await supabase
      .from("outbreaks")
      .select("id, cases, deaths, date, source_priority")
      .eq("disease_en", target.disease_en)
      .eq("country_en", target.country_en)
      .eq("active", true)
      .order("source_priority", { ascending: false })
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      log.push({ label, status: "error", detail: fetchErr.message });
      errors++;
      continue;
    }
    if (!existingRow) {
      // Scope decision: this cron only refreshes the three rows it already
      // knows exist (see file header) — it does not insert new rows. If one
      // of these three is ever deactivated or deleted, it needs a human
      // decision, not a silent re-insert from a narrow-purpose cron.
      log.push({ label, status: "skip", detail: "no active row found — not inserting (update-only cron, see file header)" });
      skipped++;
      continue;
    }

    const incoming: GuardedIncoming = {
      cases: parsed.cases,
      // Guard functions only branch on `deaths` inside zeroDeathGuard, which
      // this loop skips entirely when the bulletin doesn't report deaths for
      // this target — see the per-target comments above. 0 here is a safe
      // placeholder for the other guards (date/spike/collapse/zero-case),
      // never written to the DB as-is (the actual payload below uses
      // parsed.deaths, which may be null).
      deaths: parsed.deaths ?? 0,
      date: isoDate,
    };
    const existing: GuardedLockedRow = { cases: existingRow.cases, deaths: existingRow.deaths, date: existingRow.date, source_priority: existingRow.source_priority };

    // lockedRowRegressionGuard inspects both cases AND deaths — like
    // zeroDeathGuard above, it must not see the deaths=0 placeholder when this
    // target's bulletin doesn't report deaths at all, or it would misread a
    // real existing death count as "the incoming report decreased it".
    const guardReason =
      dateFloorGuard(incoming, existing) ??
      spikeGuard(incoming, existing) ??
      collapseGuard(incoming, existing) ??
      zeroCaseGuard(incoming, existing) ??
      (parsed.deaths !== null ? zeroDeathGuard(incoming, existing) : null) ??
      lockedRowRegressionGuard(parsed.deaths !== null ? incoming : { ...incoming, deaths: existing.deaths ?? 0 }, existing);
    if (guardReason) {
      log.push({ label, status: "skip", detail: guardReason });
      skipped++;
      // A refusal on a locked (source_priority>=10) row is not an
      // ordinary skip: nothing else will ever write this row again, so a
      // silently-blocked write freezes it on stale figures forever with
      // nothing to show for it (see check-mpox-sitrep/route.ts and
      // project_source_priority_is_ownership_not_freeze_2026_08_19). Ordinary
      // guards (dateFloor/spike/collapse/zeroCase/zeroDeath) stay unreported
      // here — their regular-operation volume isn't measured, so surfacing
      // them too would risk drowning the health-check in noise.
      if (guardReason.startsWith("guard:locked-row-")) lockedGuardBlocked.push(`${label}: ${guardReason}`);
      continue;
    }

    if (existingRow.cases === parsed.cases && existingRow.deaths === parsed.deaths && existingRow.date === isoDate) {
      log.push({ label, status: "skip", detail: "data unchanged" });
      skipped++;
      continue;
    }

    const deathsClause = parsed.deaths !== null && parsed.deaths > 0
      ? ` and ${parsed.deaths.toLocaleString("en")} death${parsed.deaths > 1 ? "s" : ""}`
      : "";
    const description = `Dengue in ${target.country_en} — WHO reported ${parsed.cases.toLocaleString("en")} cumulative case${parsed.cases > 1 ? "s" : ""}${deathsClause} in 2026 as of ${isoDate}. Source: WHO WPRO Dengue Situation Update ${edition}.`;

    const updatePayload: Record<string, unknown> = {
      cases:           parsed.cases,
      deaths:          parsed.deaths,
      date:            isoDate,
      source:          itemUrl,
      description,
      description_fr:  null,
      description_es:  null,
      description_ar:  null,
      description_id:  null,
      source_priority: Math.max(SOURCE_PRIORITY, existingRow.source_priority ?? 0),
    };

    // .select("id") so a blocked write (row now owned by a still-higher
    // priority source) shows up as 0 affected rows rather than a false
    // "updated" — same pattern used by sync-who-regional. Ceiling raised to
    // 10 on 2026-08-19 (see header) — lockedRowRegressionGuard above is what
    // actually protects a locked row from a decrease now, not this number.
    const { data: updatedRows, error: updateErr } = await supabase
      .from("outbreaks")
      .update(updatePayload)
      .eq("id", existingRow.id)
      .lte("source_priority", 10)
      .select("id");

    if (updateErr) {
      log.push({ label, status: "error", detail: updateErr.message });
      errors++;
    } else if (!updatedRows || updatedRows.length === 0) {
      log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
      skipped++;
    } else {
      log.push({ label, status: "updated", detail: `${parsed.cases} cases / ${parsed.deaths ?? "n/a"} deaths (${isoDate})` });
      updated++;
    }
  }

  console.log(`[sync-wpro-dengue-update] edition #${edition}: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  for (const l of log) console.log(`[sync-wpro-dengue-update]   ${l.label}: ${l.status} — ${l.detail}`);

  if (errors > 0 && isRealProduction) {
    Sentry.captureMessage(`[sync-wpro-dengue-update] ${errors} error(s) on edition #${edition}`, {
      level: "warning",
      tags: { component: "sync-wpro-dengue-update" },
      extra: { log },
    });
  }
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[sync-wpro-dengue-update] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }

  await logCronRun(supabase, "sync-wpro-dengue-update", errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok", updated,
    lockedGuardBlocked.length > 0 ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}` : undefined);
  return NextResponse.json({ ok: errors === 0 && lockedGuardBlocked.length === 0, edition, itemUrl, updated, skipped, errors, guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, log });
}
