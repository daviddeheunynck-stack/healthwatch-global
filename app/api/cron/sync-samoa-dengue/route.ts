// Weekly check for a new Samoa Ministry of Health dengue situation report
// (health.gov.ws). This row (`disease_en="Dengue"`, `country_en="Samoa"`) had
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
//      "Dengue-sitrep-issue-no-N.pdf" link, take the highest N. Compare its
//      URL against the row's stored `source` — identical means no new issue,
//      skip everything below (no PDF download, no LLM call: this is what keeps
//      a weekly-cadence source cheap to poll daily).
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
//      before writing.
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
import { regressionGuard } from "@/lib/outbreak-guards";

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
  const res = await fetch(LISTING_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
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

async function extractSitrep(apiKey: string, text: string): Promise<SitrepExtract | null> {
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:     EXTRACT_SYSTEM_PROMPT,
      messages:   [{ role: "user", content: text.slice(0, 8000) }],
    });
    const raw = (response.content[0]?.type === "text" ? response.content[0].text : "").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SitrepExtract>;
    if (
      typeof parsed.issueNumber !== "number" ||
      typeof parsed.reportDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.reportDate) ||
      typeof parsed.cumulativeClinicalCases !== "number" ||
      typeof parsed.cumulativeDeaths !== "number"
    ) {
      return null; // malformed/incomplete — treat as extraction failure, don't guess
    }
    return parsed as SitrepExtract;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[sync-samoa-dengue] Haiku extraction error:", message);
    if (/credit balance is too low/i.test(message)) {
      Sentry.captureMessage(
        "[sync-samoa-dengue] Anthropic API credit balance too low — top up at console.anthropic.com (Settings > Billing)",
        "error",
      );
    }
    return null;
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
    .eq("disease_en", "Dengue")
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

  const extracted = await extractSitrep(apiKey, text);
  if (!extracted) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, `extraction failed for issue ${latest.issueNumber}`);
    return NextResponse.json({ ok: false, error: "extraction failed", issueNumber: latest.issueNumber }, { status: 502 });
  }

  const guardReason = regressionGuard(
    { cases: extracted.cumulativeClinicalCases, deaths: extracted.cumulativeDeaths, date: extracted.reportDate },
    { cases: row.cases, deaths: row.deaths, date: row.date },
  );
  if (guardReason) {
    await logCronRun(supabase, "sync-samoa-dengue", "error", 0, `guard blocked issue ${latest.issueNumber}: ${guardReason}`);
    return NextResponse.json({ ok: false, error: guardReason, issueNumber: latest.issueNumber }, { status: 200 });
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
