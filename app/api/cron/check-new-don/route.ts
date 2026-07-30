// Hourly, offset 20min after sync-outbreaks: detects brand-new WHO Disease
// Outbreak News articles (URLs never seen in a previous run) and emails the
// admin a summary. sync-outbreaks already ingests these into the DB silently
// every hour — this is the "tell a human" layer on top, so a new DON gets
// reviewed/verified (and possibly posted about) instead of quietly appearing.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { fetchWHODONList, parseWHODONItems, donArticleUrl } from "@/lib/who-api";
import type { WHONewsItem } from "@/lib/who-api";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const ADMIN_PANEL_URL = "https://healthwatch-global.com/fr/admin";
const SEEN_KEY        = "known_don_urls";
const MAX_SEEN         = 500; // bounds site_config row size; WHO's own feed never resurfaces an older URL anyway
const FEED_TOP         = 25;  // WHO publishes far fewer than this per week — generous overlap margin

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Returns whether the email actually sent — callers previously assumed
// success from the fact that this was called at all (see weekly-digest for
// the same class of bug: BREVO_API_KEY missing was indistinguishable from a
// successful send).
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!BREVO_API_KEY || !to) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
        to:          [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      Sentry.captureMessage(`[check-new-don] Brevo ${res.status}: ${errText}`, "error");
      return false;
    }
    return true;
  } catch (e: unknown) {
    console.error("[check-new-don] email:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "check-new-don" } });
    return false;
  }
}

interface NewDonSummary {
  title:     string;
  url:       string;
  diseaseEn: string | null;
  countryEn: string | null;
  cases:     number | null;
  deaths:    number | null;
  inDb:      boolean;
}

function buildEmail(items: NewDonSummary[]): { subject: string; html: string } {
  const rows = items.map((d) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1e293b">
        <a href="${esc(d.url)}" style="color:#60a5fa;text-decoration:none;font-weight:600">${esc(d.title)}</a><br>
        <span style="font-size:12px;color:#94a3b8">
          ${d.diseaseEn ? esc(d.diseaseEn) : "?"} · ${d.countryEn ? esc(d.countryEn) : "?"}
          ${d.cases  !== null ? ` · ${d.cases.toLocaleString("fr-FR")} cas` : ""}
          ${d.deaths !== null ? ` · ${d.deaths.toLocaleString("fr-FR")} décès` : ""}
        </span><br>
        <span style="font-size:11px;color:${d.inDb ? "#34d399" : "#fbbf24"}">
          ${d.inDb ? "✅ déjà en base (sync-outbreaks)" : "⏳ pas encore en base — vérifier manuellement"}
        </span>
      </td>
    </tr>`).join("");

  const subject = items.length === 1
    ? `🆕 Nouveau DON OMS — ${items[0].diseaseEn ?? items[0].title}`
    : `🆕 ${items.length} nouveaux DON OMS détectés`;

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="font-size:16px;font-weight:700;color:#60a5fa;margin:0 0 16px">HealthWatch — Nouveau(x) DON OMS</p>
  <table style="width:100%;border-collapse:collapse">${rows}</table>
  <p style="margin-top:20px">
    <a href="${ADMIN_PANEL_URL}" style="display:inline-block;background:#111827;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold">⚙️ Admin</a>
  </p>
  <p style="margin-top:16px;font-size:11px;color:#475569">${new Date().toISOString()}</p>
</div>`;

  return { subject, html };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[check-new-don] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Defensive wrapper: section 2 already handles its own fetch failure, but
  // sections 3-5 below (seen-set persistence, per-DON parse/dedup loop, admin
  // email) run outside any enclosing try/catch. An uncaught exception there
  // propagated straight out: bare 500, no Sentry event, logCronRun never
  // reached. Same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runCheckNewDon(req, supabase);
  } catch (err) {
    console.error("[check-new-don] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "check-new-don" } });
    await logCronRun(supabase, "check-new-don", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runCheckNewDon(_req: NextRequest, supabase: SupabaseClient) {
  // ── 1. Load previously-seen DON article URLs ──────────────────────────
  const { data: configRow } = await supabase
    .from("site_config").select("value").eq("key", SEEN_KEY).maybeSingle();

  const isFirstRun = !configRow;
  let known: Set<string>;
  try {
    known = new Set(JSON.parse(configRow?.value || "[]"));
  } catch {
    known = new Set();
  }

  // ── 2. Fetch current WHO DON feed ──────────────────────────────────────
  let items: WHONewsItem[];
  try {
    items = await fetchWHODONList(FEED_TOP);
  } catch (e: unknown) {
    console.error("[check-new-don] WHO fetch failed:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "check-new-don" } });
    await logCronRun(supabase, "check-new-don", "error", 0, errorMessage(e));
    return NextResponse.json({ error: "who_fetch_failed" }, { status: 502 });
  }

  const withUrls = items
    .map((item) => ({ item, url: donArticleUrl(item) }))
    .filter((x): x is { item: WHONewsItem; url: string } => !!x.url);
  const newOnes = withUrls.filter((x) => !known.has(x.url));

  // ── 3. Persist the merged seen-set regardless of what happens next ─────
  const merged = Array.from(new Set([...known, ...withUrls.map((x) => x.url)])).slice(-MAX_SEEN);
  await supabase.from("site_config").upsert(
    { key: SEEN_KEY, value: JSON.stringify(merged), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  // First run ever: nothing to compare against yet — seed silently instead
  // of emailing WHO's entire existing backlog as if it just appeared.
  if (isFirstRun) {
    console.log(`[check-new-don] First run — seeded ${withUrls.length} known DON(s), no alert sent.`);
    await logCronRun(supabase, "check-new-don", "ok", 0);
    return NextResponse.json({ status: "seeded", known: withUrls.length });
  }

  if (newOnes.length === 0) {
    await logCronRun(supabase, "check-new-don", "ok", 0);
    return NextResponse.json({ status: "up_to_date", checked: withUrls.length });
  }

  console.log(`[check-new-don] ${newOnes.length} new DON(s) detected.`);

  // ── 4. Summarize each new DON (best-effort parse + DB ingestion check) ──
  const summaries: NewDonSummary[] = [];
  for (const { item, url } of newOnes) {
    let diseaseEn: string | null = null;
    let countryEn: string | null = null;
    let cases:  number | null = null;
    let deaths: number | null = null;

    try {
      const parsed = await parseWHODONItems(item);
      if (parsed.length > 0) {
        diseaseEn = parsed[0].disease_en;
        countryEn = parsed.length > 1 ? `${parsed.length} pays` : parsed[0].country_en;
        cases  = parsed.reduce((s, p) => s + p.cases, 0);
        deaths = parsed.reduce((s, p) => s + p.deaths, 0);
      }
    } catch (e: unknown) {
      console.warn(`[check-new-don] parse failed for ${url}:`, errorMessage(e));
    }

    const { count } = await supabase
      .from("outbreaks")
      .select("id", { count: "exact", head: true })
      .eq("source", url);

    summaries.push({ title: item.Title, url, diseaseEn, countryEn, cases, deaths, inDb: (count ?? 0) > 0 });
  }

  // ── 5. Alert ─────────────────────────────────────────────────────────────
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();
  let emailSent = false;
  if (adminEmail && isRealProduction) {
    const { subject, html } = buildEmail(summaries);
    emailSent = await sendEmail(adminEmail, subject, html);
  }

  // New DONs were found either way (the JSON response below still reports them),
  // but flag the run as errored if the admin alert email itself didn't go out —
  // otherwise a missing BREVO_API_KEY looks identical to "nothing to report".
  const emailExpected = !!adminEmail && isRealProduction;
  await logCronRun(supabase, "check-new-don", emailExpected && !emailSent ? "error" : "ok", summaries.length);

  return NextResponse.json({ status: "new_don_found", count: summaries.length, emailSent, summaries });
}
