// Weekly check for a new Samoa Ministry of Health dengue situation report
// (health.gov.ws). This row (`disease_en="Dengue fever"`, `country_en="Samoa"`) had
// no automated coverage at all until 2026-08-12 — it was last manually entered
// from Issue No. 47 (9 March 2026) and sat unrefreshed for 5 months, 21 issues
// behind (found via the daily data-quality staleness check), because
// sync-pacific-surveillance deliberately never writes dengue to `outbreaks`
// (its own header comment: PSSS is syndromic surveillance, not lab-confirmed —
// mixing the two would misrepresent the data). This cron is a dedicated,
// narrow fetcher for this one source instead.
//
// Approach (verified live 2026-08-12):
//   1. GET the listing page (health.gov.ws/dengue/), regex out every
//      "Dengue-sitrep-issue-no-N.pdf" link, take the highest N. Skip
//      everything below (no PDF download, no LLM call: this is what keeps a
//      weekly-cadence source cheap to poll) when its URL is identical to the
//      row's stored `source`, OR when its ISSUE NUMBER is lower than the one
//      the row already holds — the listing page can lag behind an issue found
//      by the daily manual review, see storedIssueNumber's doc.
//   2. Download the PDF, extract text with `pdf-parse` (plain text mode — this
//      report's numbers are real text, not a delimiter-less grid like the PSSS
//      bulletin sync-pacific-surveillance has to reconstruct positionally; a
//      live extraction confirmed clean, unambiguous field labels).
//   3. Feed the extracted text to Claude Haiku (same model + same
//      lib/geo-extract-llm.ts-style API-key resolution as the existing admin1
//      extraction) with a JSON-schema extraction prompt. Chosen over regex
//      because this is a hand-authored government report — the codebase's own
//      guard-file history (Guatemala death-toll footnote, DRC column
//      mismatches) is a record of exactly how brittle positional/regex
//      parsing gets against layout drift between issues; an LLM extraction
//      tolerates that better and the cost is negligible at ~weekly cadence.
//   4. Apply the same regressionGuard() used by the other PDF-sitrep parsers
//      (sync-paho-alerts, sync-ncdc, sync-drc-sitrep, check-mpox-sitrep)
//      before writing, plus lockedRowRegressionGuard — this cron writes onto a
//      source_priority=10 row, so it belongs to the 2026-08-19 sweep even
//      though it was created after it and was missed at the time. A blocked
//      write is logged as "ok" with the reason, never as an error (see
//      lib/outbreak-guards.ts); only a locked-row refusal on a genuinely
//      freezing row escalates.
//
// source_priority: this row was already locked at 10 (a deliberate prior
// protection against auto-overwrite) before this cron existed. Writing at 10
// (not the usual 5) preserves that lock level so this cron can keep updating
// the row on future issues while still refusing anything lower-trust.
//
// Schedule: weekly, matching the report's own cadence (new issues have
// appeared roughly every few days to a week; a daily check would just no-op
// most days at zero extra cost, but weekly avoids the empty HTML listing-page
// fetch entirely on days nothing can plausibly have changed).

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { regressionGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 90;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const LISTING_URL = "https://www.health.gov.ws/dengue/";
const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":     "text/html,application/pdf,*/*",
};

// Same 3-tier fallback as lib/geo-extract-llm.ts's resolveAnthropicKey — kept
// as its own small copy rather than an import so this cron stays self-
// contained like every other route file here, not because the logic differs.
async function resolveAnthropicKey(supabase: SupabaseClient): Promise<string> {
  const envKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (envKey) return envKey;
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "ANTHROPIC_API_KEY").single();
    return (data?.value ?? "").trim();
  } catch {
    return "";
  }
}

interface LatestIssue {
  url: string;
  issueNumber: number;
}

async function findLatestIssue(): Promise<LatestIssue | null> {
  // fetchWithRetry: 2 attempts, 10s each (worst case 21s vs. maxDuration=90)
  // on a transient network blip — see lib/fetch-retry.ts (2026-09-02).
  const { response: res, error: fetchErr, attemptsMade } = await fetchWithRetry(
    LISTING_URL, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 10_000, backoffMs: [1000] },
  );
  if (!res) { console.log(`[samoa-dengue] listing: ${errorMessage(fetchErr)} (${attemptsMade} tentative(s))`); return null; }
  if (!res.ok) { console.log(`[samoa-dengue] listing → HTTP ${res.status} (${attemptsMade} tentative(s))`); return null; }
  const html = await res.text();
  const re = /href=["']([^"']*Dengue-sitrep-issue-no-(\d+)\.pdf)["']/gi;
  let m: RegExpExecArray | null;
  let best: LatestIssue | null = null;
  while ((m = re.exec(html)) !== null) {
    const issueNumber = parseInt(m[2], 10);
    if (!best || issueNumber > best.issueNumber) best = { url: m[1], issueNumber };
  }
  return best;
}

/**
 * Issue number encoded in a stored `source` URL, or null when that URL isn't a
 * sitrep PDF of this series (row re-sourced by hand to something else).
 *
 * Exists because the row can legitimately hold an issue the LISTING PAGE does
 * not link. Found live 2026-08-27: the row carried issue #69 (report dated
 * 2026-08-10, written on 21/08 by the daily manual review, not by this cron —
 * its own last successful write was 13/08), while health.gov.ws/dengue/ still
 * stopped at #68. The identity test below used to be `row.source === latest.url`
 * — a STRING comparison — so #68 read as "a new issue", and every Monday this
 * cron downloaded that PDF, paid for a Haiku extraction, and had the write
 * refused by regressionGuard as `guard:older-report`. It would have kept doing
 * that until the ministry published a #70.
 */
function storedIssueNumber(source: string | null): number | null {
  const m = /Dengue-sitrep-issue-no-(\d+)\.pdf/i.exec(source ?? "");
  return m ? parseInt(m[1], 10) : null;
}

interface SitrepExtract {
  issueNumber:                number;
  reportDate:                 string; // YYYY-MM-DD
  cumulativeClinicalCases:    number;
  cumulativeLabConfirmedCases: number | null;
  cumulativeDeaths:           number;
  denv1Pct:                   number | null;
  denv2Pct:                   number | null;
  upoluPct:                   number | null;
  savaiiPct:                  number | null;
  under15Pct:                 number | null;
}

const EXTRACT_SYSTEM_PROMPT = `You are extracting structured data from a Samoa Ministry of Health dengue fever outbreak situation report. Read the report text and return ONLY a single JSON object (no markdown fences, no explanation, no extra text) with exactly these fields:
{"issueNumber": number, "reportDate": "YYYY-MM-DD", "cumulativeClinicalCases": number, "cumulativeLabConfirmedCases": number|null, "cumulativeDeaths": number, "denv1Pct": number|null, "denv2Pct": number|null, "upoluPct": number|null, "savaiiPct": number|null, "under15Pct": number|null}

All case/death counts must be the YEAR-TO-DATE CUMULATIVE totals from the report's "Summary of the Year to Date" section (usually a table with "Total Clinically Diagnosed Cases" / "Total Lab-Confirmed Cases" / "Reported Dengue-Related Deaths" columns) — NOT the current epi-week's new-case figures from the "Weekly Summary" section. reportDate is the "Date of report" field, converted to YYYY-MM-DD. denv1Pct/denv2Pct are the serotype percentages. upoluPct/savaiiPct are the geographic distribution percentages (there may be a third "other islands" bucket that doesn't need its own field). under15Pct is the percentage of cases in the age group most affected, only if that group is specifically "<15 years" (if a different age group is named, return null for this field). If a field genuinely cannot be found in the text, use null (issueNumber, reportDate, cumulativeClinicalCases and cumulativeDeaths should always be findable). Return ONLY the JSON object.`;

type ExtractResult = { ok: true; data: SitrepExtract } | { ok: false; reason: string };

// Haiku reliably follows "return only JSON" as a soft instruction but not always
// literally — wrapping the object in ```json fences is a common enough pattern
// (with no structured-output/tool-use enforcement here, unlike this codebase's
// StructuredOutput-style workflow tooling) that stripping fences defensively
// before parsing is cheaper than fighting the model on it. Found 2026-08-13:
// the very first live run against a real key failed extraction for exactly
// this reason.
function stripJsonFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced ? fenced[1] : raw).trim();
}

async function extractSitrep(apiKey: string, text: string): Promise<ExtractResult> {
  let raw = "";
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:     EXTRACT_SYSTEM_PROMPT,
      messages:   [{ role: "user", content: text.slice(0, 8000) }],
    });
    raw = (response.content[0]?.type === "text" ? response.content[0].text : "").trim();
    if (!raw) return { ok: false, reason: "empty response from Haiku" };

    let parsed: Partial<SitrepExtract>;
    try {
      parsed = JSON.parse(stripJsonFences(raw)) as Partial<SitrepExtract>;
    } catch {
      return { ok: false, reason: `response was not valid JSON: ${raw.slice(0, 200)}` };
    }

    if (
      typeof parsed.issueNumber !== "number" ||
      typeof parsed.reportDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.reportDate) ||
      typeof parsed.cumulativeClinicalCases !== "number" ||
      typeof parsed.cumulativeDeaths !== "number"
    ) {
      return { ok: false, reason: `missing/malformed required field(s): ${JSON.stringify(parsed).slice(0, 200)}` };
    }
    return { ok: true, data: parsed as SitrepExtract };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[sync-samoa-dengue] Haiku extraction error:", message);
    if (/credit balance is too low/i.test(message)) {
      Sentry.captureMessage(
        "[sync-samoa-dengue] Anthropic API credit balance too low — top up at console.anthropic.com (Settings > Billing)",
        "error",
      );
    }
    return { ok: false, reason: `API error: ${message}` };
  }
}

function buildDescription(e: SitrepExtract): string {
  const serotypes = e.denv1Pct !== null && e.denv2Pct !== null
    ? `serotypes DENV-1 (${e.denv1Pct}%) and DENV-2 (${e.denv2Pct}%), `
    : "";
  const geo = e.upoluPct !== null && e.savaiiPct !== null
    ? `${e.upoluPct}% of cases in Upolu and ${e.savaiiPct}% in Savaii, `
    : "";
  const age = e.under15Pct !== null ? `children under 15 accounting for ${e.under15Pct}% of cases, ` : "";
  const lab = e.cumulativeLabConfirmedCases !== null ? ` and ${e.cumulativeLabConfirmedCases.toLocaleString("en")} lab-confirmed cases` : "";
  return `Dengue outbreak in Samoa, ongoing since January 2025. Per Samoa Ministry of Health situation report (Issue No. ${e.issueNumber}, ${e.reportDate}): ${e.cumulativeClinicalCases.toLocaleString("en")} cumulative clinically diagnosed cases${lab} since 1 January 2025, ${e.cumulativeDeaths} dengue-related death${e.cumulativeDeaths === 1 ? "" : "s"}, ${serotypes}${geo}${age}Source: Samoa MoH Health Security & Disease Surveillance Division.`.replace(/, Source:/, ". Source:");
}

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
    return await runSyncSamoaDengue(supabase);
  } catch (err) {
    console.error("[sync-samoa-dengue] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-samoa-dengue" } });
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncSamoaDengue(supabase: SupabaseClient) {
  const { data: row, error: rowErr } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths, date, source, description, source_priority")
    .eq("disease_en", "Dengue fever")
    .eq("country_en", "Samoa")
    .maybeSingle();

  if (rowErr) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, rowErr.message);
    return NextResponse.json({ ok: false, error: rowErr.message }, { status: 500 });
  }
  if (!row) {
    // Nothing to update — this cron maintains an existing row, it doesn't create one.
    await logCronRun(supabase, "sync-samoa-dengue", "ok", 0);
    return NextResponse.json({ ok: true, skipped: "no Dengue/Samoa row found" });
  }

  const latest = await findLatestIssue();
  if (!latest) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, "could not find any issue on listing page");
    return NextResponse.json({ ok: false, error: "listing page parse failed" }, { status: 502 });
  }

  if (row.source === latest.url) {
    await logCronRun(supabase, "sync-samoa-dengue", "ok", 0);
    return NextResponse.json({ ok: true, skipped: "no new issue", issueNumber: latest.issueNumber });
  }

  // Same shortcut, one step wider: the listing page's best issue is OLDER than
  // the one the row already holds (see storedIssueNumber's doc). Nothing below
  // could ever produce a write — regressionGuard would refuse it — so stop
  // before the PDF download and the paid extraction rather than after them.
  // A missing/unparseable stored number falls through to the existing
  // behaviour instead of skipping blind, and a REPUBLISHED issue under the
  // same number still reaches the extraction: only strictly-older is skipped.
  const stored = storedIssueNumber(row.source);
  if (stored !== null && latest.issueNumber < stored) {
    await logCronRun(supabase, "sync-samoa-dengue", "ok", 0,
      `listing page still at issue ${latest.issueNumber}, row already holds ${stored}`);
    return NextResponse.json({
      ok: true,
      skipped: "listing page behind stored issue",
      issueNumber: latest.issueNumber,
      storedIssueNumber: stored,
    });
  }

  const pdfRes = await fetch(latest.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!pdfRes.ok) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, `PDF fetch failed: ${pdfRes.status}`);
    return NextResponse.json({ ok: false, error: `PDF fetch ${pdfRes.status}` }, { status: 502 });
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  const pdfParseFn = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
    (buf: Buffer) => Promise<{ text: string }>;
  const { text } = await pdfParseFn(pdfBuffer);

  const apiKey = await resolveAnthropicKey(supabase);
  if (!apiKey) {
    // Same silent-degradation shape as geo-extract-llm.ts's admin1 extraction —
    // but unlike that one (which has a regex fallback), there's no fallback
    // here: without the key this cron simply cannot parse the PDF, so surface
    // it loudly rather than quietly doing nothing.
    Sentry.captureMessage("[sync-samoa-dengue] No Anthropic API key available (env + app_settings both empty) — cannot extract new issue", "error");
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, "no Anthropic API key configured");
    return NextResponse.json({ ok: false, error: "no Anthropic API key configured" }, { status: 500 });
  }

  const extractResult = await extractSitrep(apiKey, text);
  if (!extractResult.ok) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, `extraction failed for issue ${latest.issueNumber}: ${extractResult.reason}`);
    return NextResponse.json({ ok: false, error: "extraction failed", reason: extractResult.reason, issueNumber: latest.issueNumber }, { status: 502 });
  }
  const extracted = extractResult.data;

  const incoming = {
    cases:  extracted.cumulativeClinicalCases,
    deaths: extracted.cumulativeDeaths,
    date:   extracted.reportDate,
  };
  // lockedRowRegressionGuard was missing here entirely: this cron writes at
  // source_priority 10 onto a row already locked at 10, which is exactly the
  // class the 2026-08-19 sweep covered (d124101 / eb57f8e / 8a235be / 79bdd51)
  // — but this route was created 2026-08-12 and none of those commits touched
  // it. Composed the same way as every swept cron: ordinary guards first, the
  // locked-row refusal after.
  const guardReason =
    regressionGuard(incoming, { cases: row.cases, deaths: row.deaths, date: row.date }) ??
    lockedRowRegressionGuard(incoming, { cases: row.cases, deaths: row.deaths, date: row.date, source_priority: row.source_priority });
  if (guardReason) {
    // A blocked write is the guard working as intended — lib/outbreak-guards.ts
    // says so at the top of regressionGuard, and the other nine callers log it
    // as a skip. This one logged "error", so a correct refusal put a red line
    // in the daily health-check e-mail for four days running (24-27/08,
    // `guard:older-report` on issue 68), which is how a real failure of this
    // cron becomes invisible. Same rule as sync-malaysia-dengue, its closest
    // twin: ordinary guard → ok with the reason kept in the message; only a
    // locked-row refusal on a row that is genuinely FREEZING (lockedRowIsFreezing,
    // 2026-08-24) escalates, because there the lock really is holding stale
    // figures nothing else will ever refresh.
    const freezing = guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing({
      cases: row.cases, deaths: row.deaths, date: row.date, source_priority: row.source_priority,
    });
    if (freezing) {
      Sentry.captureMessage(
        `[samoa-dengue] blocked by anti-regression guard on locked row: ${guardReason}`,
        "warning",
      );
    }
    await logCronRun(supabase, "sync-samoa-dengue", freezing ? "error" : "ok", 0,
      freezing
        ? `écriture bloquée par le garde anti-régression : issue ${latest.issueNumber} — ${guardReason}`
        : `guard blocked issue ${latest.issueNumber}: ${guardReason}`);
    return NextResponse.json({ ok: true, status: `skip: ${guardReason}`, issueNumber: latest.issueNumber, guardBlocked: freezing || undefined }, { status: 200 });
  }

  const description = buildDescription(extracted);
  const payload: Record<string, unknown> = {
    cases:           extracted.cumulativeClinicalCases,
    deaths:          extracted.cumulativeDeaths,
    date:            extracted.reportDate,
    source:          latest.url,
    description,
    source_priority: 10, // preserve the pre-existing lock level, see header comment
  };
  if (row.description !== description) {
    payload.description_fr = null;
    payload.description_es = null;
    payload.description_ar = null;
    payload.description_id = null;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("outbreaks")
    .update(payload)
    .eq("id", row.id)
    .lte("source_priority", 10)
    .select("id");

  if (updateErr) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, updateErr.message);
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, "update blocked (row locked above priority 10, 0 rows affected)");
    return NextResponse.json({ ok: false, error: "blocked, 0 rows affected" }, { status: 500 });
  }

  await logCronRun(supabase, "sync-samoa-dengue", "ok", 1);
  return NextResponse.json({
    ok: true,
    updated: true,
    issueNumber: latest.issueNumber,
    cases: extracted.cumulativeClinicalCases,
    deaths: extracted.cumulativeDeaths,
  });
}
