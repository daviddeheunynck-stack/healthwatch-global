// Schedule: 30 8 * * 1  — weekly, Monday 08:30 UTC.
//
// Detects when WHO publishes a new "Multi-country outbreak of cholera" update
// inside the Weekly Epidemiological Record, and confirms the citation the six
// African cholera rows already carry while no newer one exists.
//
// DETECTION ONLY — this cron never writes cases or deaths. That is deliberate,
// not an unfinished half: the cholera figures live in a per-country narrative
// inside the edition PDF ("Between 1 January 2026 and 28 June 2026, the
// Democratic Republic of the Congo reported a total of 32 193 cases and 908
// deaths"), not in a machine-readable table, and six countries would have to be
// matched out of free prose. Extracting them automatically is a separate,
// larger job with its own failure modes; deciding it is not this cron's call.
// Same division of labour as disease-coverage's coverage-gap emails and
// sync-pacific-surveillance: surface the event, leave the DB write to a human.
//
// WHY IT EXISTS (measured 2026-09-01). Six active rows — Cholera in DR Congo
// (32 193 cases / 908 deaths), Sudan, South Sudan, Congo, Somalia and Tanzania —
// all cite wer101-31 and carried no `source_confirmed_at` at all, because no
// cron in this repo reads the WER. Their freshness rested entirely on a prose
// comment in data-quality's DASHBOARD_SOURCES list, last checked by a human on
// 2026-08-12. Nothing could notice a new cholera update publishing, and nothing
// could notice one failing to.
//
// CADENCE — the trap this cron is shaped around. The WER itself is WEEKLY
// (a new wer<vol>-<issue> every Friday), but the cholera update inside it is
// MONTHLY: it is the continuation of the numbered "Multi-country outbreak of
// cholera" series that stopped at #38 (30 June 2026). Verified 2026-09-01 by
// reading the full-edition PDFs of issues 31 to 34: the country update appears
// in issue 31 only ("Data as of 28 June 2026", June = epi weeks 23-26), while
// 32, 33 and 34 mention cholera solely in their weekly signals list. So a new
// WER issue is NOT news, and comparing issue numbers alone would cry wolf every
// Friday. Only the presence of the update marker inside an edition counts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logCronRun, isRealProduction, captureSelfReport } from "@/lib/cron-monitor";
import { sendBrevoEmail } from "@/lib/brevo-send";
import { errorMessage } from "@/lib/error";
import { stampSourceConfirmed } from "@/lib/source-confirmed";
import * as Sentry from "@sentry/nextjs";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const WER_LISTING_URL = "https://www.who.int/publications/journals/weekly-epidemiological-record";
const ADMIN_PANEL_URL = "https://healthwatch-global.com/fr/admin";
const STATE_KEY       = "wer_cholera_scan";

// The marker that distinguishes an edition carrying the country update from one
// that merely lists cholera among the week's signals. Both strings are present
// in issue 31 and absent from 32/33/34 — the second one matters: the signals
// list can name cholera, but only the update carries a "Data as of <date>"
// cut-off line.
const CHOLERA_UPDATE_MARKER = /Multi-country outbreak of cholera/i;
const CHOLERA_DATA_AS_OF    = /Data as of\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i;

// Downloading a ~1 MB edition PDF per issue is the expensive part, so a run
// inspects at most this many new issues. Normally there is exactly one. The cap
// only bites after an outage, and the unscanned issues stay unscanned rather
// than being skipped — `lastScannedIssue` does not advance past them.
const MAX_ISSUES_PER_RUN = 5;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,application/pdf,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

interface WerIssue { volume: number; issue: number; url: string }
interface ScanState { lastScannedIssue: number; latestCholeraIssue: number; latestCholeraUrl: string }

/** Sort key so a volume roll-over (wer101-52 → wer102-1) orders correctly. */
const rank = (i: { volume: number; issue: number }) => i.volume * 1000 + i.issue;

function parseIssueRef(url: string): { volume: number; issue: number } | null {
  const m = url.match(/wer(\d+)-(\d+)/i);
  if (!m) return null;
  return { volume: parseInt(m[1], 10), issue: parseInt(m[2], 10) };
}

// ── 1. List the editions WHO currently publishes ─────────────────────────────

async function fetchIssueList(): Promise<WerIssue[] | null> {
  try {
    const res = await fetch(WER_LISTING_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.log(`[wer-cholera] listing → HTTP ${res.status}`); return null; }
    const html = await res.text();
    const seen = new Map<string, WerIssue>();
    const hrefRe = /href="([^"]*wer\d+-\d+[^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
      const ref = parseIssueRef(m[1]);
      if (!ref) continue;
      const key = `${ref.volume}-${ref.issue}`;
      if (seen.has(key)) continue;
      // The listing mixes absolute and root-relative hrefs for the same series.
      const url = m[1].startsWith("http")
        ? m[1]
        : `https://www.who.int${m[1].startsWith("/") ? "" : "/"}${m[1]}`;
      seen.set(key, { ...ref, url });
    }
    const issues = [...seen.values()].sort((a, b) => rank(a) - rank(b));
    return issues.length > 0 ? issues : null;
  } catch (e) {
    console.log("[wer-cholera] fetch listing:", errorMessage(e));
    return null;
  }
}

// ── 2. Does this edition carry the cholera country update? ───────────────────

/** The edition PDF hides behind an iris.who.int bitstream link labelled "Download full edition". */
async function fetchEditionPdfUrl(issueUrl: string): Promise<string | null> {
  try {
    const res = await fetch(issueUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.log(`[wer-cholera] issue page → HTTP ${res.status}`); return null; }
    const html = await res.text();
    const m = html.match(/<a[^>]*href="(https:\/\/iris\.who\.int[^"]*)"[^>]*>[\s\S]{0,200}?Download full edition/i);
    return m ? m[1] : null;
  } catch (e) {
    console.log("[wer-cholera] fetch issue page:", errorMessage(e));
    return null;
  }
}

interface CholeraProbe { carriesUpdate: boolean; dataAsOf: string | null }

async function probeEdition(issueUrl: string): Promise<CholeraProbe | null> {
  const pdfUrl = await fetchEditionPdfUrl(issueUrl);
  if (!pdfUrl) return null;
  try {
    const res = await fetch(pdfUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30000) });
    if (!res.ok) { console.log(`[wer-cholera] PDF → HTTP ${res.status}`); return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as (b: Buffer) => Promise<{ text: string }>;
    const text = (await pdfParse(buf)).text;
    if (!CHOLERA_UPDATE_MARKER.test(text)) return { carriesUpdate: false, dataAsOf: null };
    // The marker alone also appears in a table of contents; the "Data as of"
    // cut-off is what only the update itself carries.
    const asOf = text.match(CHOLERA_DATA_AS_OF);
    return { carriesUpdate: Boolean(asOf), dataAsOf: asOf ? asOf[1] : null };
  } catch (e) {
    console.log("[wer-cholera] parse PDF:", errorMessage(e));
    return null;
  }
}

// ── 3. Notify ────────────────────────────────────────────────────────────────

// Same helper, same three replacements as sync-pacific-surveillance (l.144) and
// disease-coverage (l.60). Nothing in this email is typed by a human: `citedUrl`
// and `rowLabels` are `outbreaks.source` / `disease` / `country` — columns fed by
// the scrapers from third-party HTML — and `issue.url` comes from WHO's own
// listing markup. Unescaped, a `<` reaching any of them would land as live markup
// in the admin's mail client.
function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function notifyNewUpdate(
  issue: WerIssue,
  dataAsOf: string | null,
  citedUrl: string,
  rowLabels: string[],
): Promise<boolean> {
  const to = ADMIN_EMAILS?.split(",")[0]?.trim();
  if (!to || !BREVO_API_KEY || !isRealProduction) return false;
  const html = `
    <p>Une nouvelle mise à jour choléra multi-pays est parue dans le Relevé épidémiologique hebdomadaire de l'OMS.</p>
    <p><strong>Édition :</strong> <a href="${esc(issue.url)}">wer${issue.volume}-${issue.issue}</a>${dataAsOf ? ` — données arrêtées au ${esc(dataAsOf)}` : ""}</p>
    <p><strong>Édition citée par la base :</strong> <a href="${esc(citedUrl)}">${esc(citedUrl)}</a></p>
    <p>${rowLabels.length} ligne(s) concernée(s) : ${rowLabels.map(esc).join(", ")}.</p>
    <p>Les chiffres sont dans une narration par pays à l'intérieur du PDF, pas dans une table exploitable — la reprise est manuelle. Le lien « Download full edition (PDF) » est sur la page de l'édition.</p>
    <p><a href="${ADMIN_PANEL_URL}">Ouvrir l'admin</a></p>`;
  try {
    await sendBrevoEmail({ to, subject: `[HWG] Nouvelle mise à jour choléra OMS — wer${issue.volume}-${issue.issue}`, html, apiKey: BREVO_API_KEY });
    return true;
  } catch (e) {
    console.error("[wer-cholera] email failed:", errorMessage(e));
    return false;
  }
}

// ── 4. Run ───────────────────────────────────────────────────────────────────

async function runCheckWerCholera(supabase: SupabaseClient) {
  // Ground truth for "which edition do we cite" is the rows themselves, not a
  // config key — a key would drift the moment someone re-sources a row by hand.
  const { data: rows, error: rowsErr } = await supabase
    .from("outbreaks")
    .select("id, disease, country, source")
    .ilike("source", "%weekly-epidemiological-record%");

  if (rowsErr) {
    await logCronRun(supabase, "check-wer-cholera", "error", 0, `lecture des lignes citant le WER impossible : ${rowsErr.message}`);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }

  const cited = (rows ?? []) as { id: string; disease: string; country: string; source: string }[];
  if (cited.length === 0) {
    // Not an error and not a silence: nothing cites the WER any more, so there
    // is nothing to confirm. Says so rather than logging an empty success.
    await logCronRun(supabase, "check-wer-cholera", "no_data", 0,
      "aucune ligne ne cite le Relevé épidémiologique hebdomadaire — rien à confirmer", new Date().toISOString());
    return NextResponse.json({ status: "no_rows" });
  }

  // All six rows cite the same edition today; if that ever splits, the newest
  // citation is the one to compare against — an older straggler is an ingestion
  // gap on that row, not a reason to call the whole series out of date.
  const citedRefs = cited
    .map((r) => ({ row: r, ref: parseIssueRef(r.source) }))
    .filter((x): x is { row: typeof cited[number]; ref: { volume: number; issue: number } } => x.ref !== null);
  if (citedRefs.length === 0) {
    await logCronRun(supabase, "check-wer-cholera", "error", 0,
      `${cited.length} ligne(s) citent le WER mais aucune URL ne contient de référence wer<vol>-<num> exploitable`);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
  const newestCited = citedRefs.reduce((a, b) => (rank(a.ref) >= rank(b.ref) ? a : b));
  const citedUrl    = newestCited.row.source;

  const { data: stateRow } = await supabase.from("site_config").select("value").eq("key", STATE_KEY).maybeSingle();
  let state: ScanState;
  try {
    const raw = stateRow?.value;
    state = typeof raw === "string" ? JSON.parse(raw) : (raw as ScanState);
    if (!state || typeof state.lastScannedIssue !== "number") throw new Error("shape");
  } catch {
    // First run, or a value written by hand: seed from what the rows cite, so
    // the cron never re-downloads the whole back catalogue.
    state = {
      lastScannedIssue:   rank(newestCited.ref),
      latestCholeraIssue: rank(newestCited.ref),
      latestCholeraUrl:   citedUrl,
    };
  }

  const issues = await fetchIssueList();
  if (!issues) {
    // NOT `no_data`. health-check documents no_data as a legitimate idle state
    // and keeps quiet about it, so an unreachable listing — or markup that stops
    // yielding wer<vol>-<num> links — would read as "nothing new this week" for
    // as long as it lasted. That is the shape that let sync-paho-alerts drop the
    // measles sitrep for 16 days while reporting green.
    await logCronRun(supabase, "check-wer-cholera", "error", 0,
      `liste des éditions du WER illisible (${WER_LISTING_URL}) — aucun lien wer<vol>-<num> trouvé : page injoignable ou balisage changé`);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }

  const pending = issues.filter((i) => rank(i) > state.lastScannedIssue).sort((a, b) => rank(a) - rank(b));
  const toScan  = pending.slice(0, MAX_ISSUES_PER_RUN);
  let scannedThrough = state.lastScannedIssue;
  let failedIssue: WerIssue | null = null;

  for (const issue of toScan) {
    const probe = await probeEdition(issue.url);
    if (!probe) {
      // Stop at the first unreadable edition instead of stepping over it: a
      // skipped issue is exactly how a missed cholera update would become
      // permanently invisible. lastScannedIssue does not advance past it, so the
      // next run retries the same one.
      failedIssue = issue;
      break;
    }
    scannedThrough = rank(issue);
    if (probe.carriesUpdate) {
      state.latestCholeraIssue = rank(issue);
      state.latestCholeraUrl   = issue.url;
      console.log(`[wer-cholera] cholera update found in wer${issue.volume}-${issue.issue} (data as of ${probe.dataAsOf})`);
    }
  }

  state.lastScannedIssue = scannedThrough;
  await supabase.from("site_config").upsert({
    key:        STATE_KEY,
    value:      JSON.stringify(state),
    updated_at: new Date().toISOString(),
  });

  if (failedIssue) {
    await logCronRun(supabase, "check-wer-cholera", "error", 0,
      `édition wer${failedIssue.volume}-${failedIssue.issue} illisible (${failedIssue.url}) — lien « Download full edition » introuvable, PDF injoignable ou illisible ; impossible de dire si elle porte une mise à jour choléra`);
    return NextResponse.json({ status: "error", issue: failedIssue.url }, { status: 200 });
  }

  // A cholera update newer than the one the rows cite: real news, and the only
  // outcome that needs a human.
  if (state.latestCholeraIssue > rank(newestCited.ref)) {
    const ref = parseIssueRef(state.latestCholeraUrl);
    const issue: WerIssue = ref ? { ...ref, url: state.latestCholeraUrl } : { volume: 0, issue: 0, url: state.latestCholeraUrl };
    const labels = cited.map((r) => `${r.disease} / ${r.country}`);
    const emailed = await notifyNewUpdate(issue, null, citedUrl, labels);
    captureSelfReport(
      `[wer-cholera] nouvelle mise à jour choléra OMS (wer${issue.volume}-${issue.issue}) — ${cited.length} ligne(s) citent encore ${citedUrl}`,
      { source: "check-wer-cholera", level: "warning" },
    );
    await logCronRun(supabase, "check-wer-cholera", "ok", 0,
      `mise à jour choléra plus récente parue : wer${issue.volume}-${issue.issue} — ${cited.length} ligne(s) citent encore l'édition ${newestCited.ref.volume}-${newestCited.ref.issue}, reprise manuelle${emailed ? ", e-mail envoyé" : ""}`,
      new Date().toISOString());
    return NextResponse.json({ status: "new_update", issue: state.latestCholeraUrl, emailed });
  }

  // Nothing newer exists. That IS a source confirmation, in the exact sense
  // lib/source-confirmed.ts defines: the source was re-read and carried nothing
  // more recent than what the rows cite. Scoped to rows citing this exact
  // edition — a listing cannot confirm a row it does not name.
  const confirmable = cited.filter((r) => r.source === citedUrl).map((r) => r.id);
  const confirmed   = await stampSourceConfirmed(supabase, confirmable);
  if (confirmed.error) console.error("[wer-cholera] stamp failed:", confirmed.error);

  // rows stays 0: a confirmation is not a data write (migration 20260824030000
  // keeps it from bumping updated_at), and inflating rows would set lastNonZero
  // and claim an ingestion that did not happen. That the check really ran goes
  // in evaluatedAt, which exists for exactly that.
  await logCronRun(supabase, "check-wer-cholera", "no_data", 0, undefined, new Date().toISOString());
  return NextResponse.json({
    status:    "up_to_date",
    scanned:   toScan.length,
    confirmed: confirmed.stamped,
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    return await runCheckWerCholera(supabase);
  } catch (e) {
    console.error("[wer-cholera] uncaught:", e);
    Sentry.captureException(e, { tags: { cron: "check-wer-cholera" } });
    await logCronRun(supabase, "check-wer-cholera", "error", 0, errorMessage(e));
    return NextResponse.json({ success: false, error: errorMessage(e) }, { status: 200 });
  }
}
