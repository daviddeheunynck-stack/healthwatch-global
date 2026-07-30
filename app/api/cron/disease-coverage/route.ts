// Hourly check for three classes of data gaps in the disease reference layer,
// triggered 30 minutes after every ingestion cycle (sync-outbreaks runs at :00,
// sync-africa-cdc / sync-ecdc-threats / sync-paho-alerts run at various times).
//
//   1. Unknown diseases (fresh) — disease_en values inserted in the last 90
//      minutes that do not match any pattern in DISEASE_MAP.  New/renamed
//      pathogens that need a DISEASE_MAP entry (transmission, travelerRisk,
//      factsheet…).
//
//   2. travelerRisk gaps — newly inserted active outbreaks where the matched
//      disease has no travelerRisk entry for the outbreak's region.
//
//   3. Unknown diseases (stock sweep) — same check as (1), but run against
//      every currently ACTIVE row regardless of insertion time. (1) alone has
//      a blind spot: a row that slips through unmatched at insertion stays
//      invisible forever once it's outside the 90-minute window (e.g. backfills,
//      manual script inserts, or a match that later regresses). Rows already
//      covered by EVENT_NAME_TRANSLATIONS (known non-disease events — food
//      safety recalls, toxin contaminations — deliberately kept out of
//      DISEASE_MAP, see that const's comment) are excluded: those are a
//      documented decision, not a gap.
//
// All three classes fire a Sentry warning immediately + a batched admin email
// when issues are found.
//
// Schedule: 30 * * * *  (every hour at :30)

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { matchDisease, matchEventNameTranslation } from "@/lib/disease-data";
import type { AppRegion } from "@/lib/disease-data";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const KNOWN_REGIONS = new Set<AppRegion>(["africa", "asia", "americas", "europe", "oceania"]);

// ── Email helper ──────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY || !to) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  }).catch((e) => console.error("[disease-coverage] email send failed:", errorMessage(e)));
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    return await runDiseaseCoverage(req, supabase);
  } catch (err) {
    console.error("[disease-coverage] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "disease-coverage" } });
    await logCronRun(supabase, "disease-coverage", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runDiseaseCoverage(_req: NextRequest, supabase: SupabaseClient) {
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // ── 1. Outbreaks inserted in the last 90 minutes (covers all sync routes) ─
  const windowStart = new Date(Date.now() - 90 * 60_000).toISOString();
  const { data: rows, error } = await supabase
    .from("outbreaks")
    .select("disease_en, disease, region, active")
    .gte("created_at", windowStart);

  if (error) {
    console.error("[disease-coverage] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── 2. Deduplicate and classify ───────────────────────────────────────────
  // unknown: disease_en not matched in DISEASE_MAP (and not a known non-disease
  // event covered by EVENT_NAME_TRANSLATIONS)
  const unknownSeen   = new Set<string>();
  const unknownList: string[] = [];

  // travelerRisk gaps: active outbreaks in a region where the matched disease
  // has no travelerRisk entry for that region
  type Gap = { disease: string; region: string };
  const gapSeen = new Set<string>();
  const gapList: Gap[] = [];

  function checkUnknown(rawName: string) {
    if (unknownSeen.has(rawName)) return;
    unknownSeen.add(rawName);
    unknownList.push(rawName);
    if (isRealProduction) {
      Sentry.captureMessage(`[disease-coverage] Unknown disease: "${rawName}"`, {
        level: "warning",
        tags: { component: "disease-coverage", type: "unknown_disease" },
        extra: { rawName },
      });
    }
  }

  for (const row of (rows ?? [])) {
    const rawName = (row.disease_en || row.disease || "").trim();
    if (!rawName) continue;

    const { info, matched } = matchDisease(rawName);

    // 2a. Unknown disease (fresh — inserted in the last 90 minutes)
    if (!matched && !matchEventNameTranslation(rawName)) checkUnknown(rawName);

    // 2b. travelerRisk gap (active outbreaks only)
    if (matched && row.active) {
      const regionSlug = (row.region ?? "").toLowerCase().replace(/\s+/g, "-") as AppRegion;
      if (KNOWN_REGIONS.has(regionSlug) && !info.travelerRisk?.[regionSlug]) {
        const gapKey = `${info.name_en}::${regionSlug}`;
        if (!gapSeen.has(gapKey)) {
          gapSeen.add(gapKey);
          gapList.push({ disease: info.name_en, region: regionSlug });
          if (isRealProduction) {
            Sentry.captureMessage(
              `[disease-coverage] travelerRisk gap: ${info.name_en} × ${regionSlug}`,
              {
                level: "warning",
                tags: { component: "disease-coverage", type: "traveler_risk_gap" },
                extra: { disease: info.name_en, region: regionSlug },
              }
            );
          }
        }
      }
    }
  }

  // ── 2c. Unknown disease (stock sweep) ─────────────────────────────────────
  // Every currently active row, no time window — catches anything that slipped
  // through (1) outside its 90-minute lookback (see header comment).
  const { data: activeRows, error: activeError } = await supabase
    .from("outbreaks")
    .select("disease_en, disease")
    .eq("active", true);

  if (activeError) {
    console.error("[disease-coverage] active-stock query error:", activeError.message);
  } else {
    for (const row of activeRows ?? []) {
      const rawName = (row.disease_en || row.disease || "").trim();
      if (!rawName) continue;
      const { matched } = matchDisease(rawName);
      if (!matched && !matchEventNameTranslation(rawName)) checkUnknown(rawName);
    }
  }

  const hasIssues = unknownList.length > 0 || gapList.length > 0;
  console.log(
    `[disease-coverage] done — unknown: ${unknownList.length}, gaps: ${gapList.length}`
  );

  // ── 3. Admin email if issues found ────────────────────────────────────────
  // Throttled on the exact reported set. Section 2c's stock sweep has no time
  // window, so an unmatched active row nobody has added to DISEASE_MAP yet
  // re-reports on every run — and this cron runs hourly, which meant 24
  // identical admin emails a day for as long as the gap stayed open. The
  // fresh-90-minute check that preceded 2c self-cleared, so the noise was
  // bounded and no throttle was needed; 2c removed that bound without
  // replacing it. Same duplicate-noise pattern already stripped out of
  // data-quality's dashboard ceiling and seed-freshness tiers on 2026-07-29 —
  // an alert channel that repeats an unactionable item every hour is a channel
  // that stops being read. Keyed on the finding set itself, so a genuinely new
  // unknown disease or travelerRisk gap still emails on the very next run.
  const NOTIFY_SIG_KEY = "disease-coverage:last_notified_signature";
  const signature = JSON.stringify({
    unknown: [...unknownList].sort(),
    gaps: gapList.map((g) => `${g.disease}::${g.region}`).sort(),
  });
  let emailThrottled = false;

  if (hasIssues && adminEmail && isRealProduction) {
    const { data: sigRow, error: sigReadErr } = await supabase
      .from("site_config")
      .select("value")
      .eq("key", NOTIFY_SIG_KEY)
      .maybeSingle();
    // A failed read must not suppress the email — fall through and send, at
    // worst a duplicate. Silence is the worse failure mode here.
    if (sigReadErr) {
      console.error("[disease-coverage] notify-signature read failed:", sigReadErr.message);
    } else if (sigRow?.value === signature) {
      emailThrottled = true;
    }
  }

  if (hasIssues && adminEmail && isRealProduction && !emailThrottled) {
    const unknownHtml = unknownList.length > 0
      ? `<h3 style="color:#ef4444">Maladies non-reconnues (${unknownList.length})</h3>
         <p style="color:#9ca3af;font-size:13px">Ajouter un pattern + données dans <code>lib/disease-data.ts</code>.</p>
         <ul>${unknownList.map(n => `<li><code>${esc(n)}</code></li>`).join("")}</ul>`
      : "";

    const gapHtml = gapList.length > 0
      ? `<h3 style="color:#f59e0b">Gaps travelerRisk (${gapList.length})</h3>
         <p style="color:#9ca3af;font-size:13px">Foyers actifs dans une région sans profil de risque voyageur. Vérifier et mettre à jour <code>travelerRisk</code> dans <code>lib/disease-data.ts</code>.</p>
         <table style="border-collapse:collapse;font-size:13px;width:100%">
           <tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #374151">Maladie</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #374151">Région</th></tr>
           ${gapList.map(g => `<tr><td style="padding:4px 8px">${esc(g.disease)}</td><td style="padding:4px 8px">${esc(g.region)}</td></tr>`).join("")}
         </table>`
      : "";

    const html = `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:24px;border-radius:12px">
        <h2 style="color:#f59e0b;margin-top:0">HealthWatch — Rapport disease-coverage</h2>
        <p style="color:#9ca3af">${new Date().toISOString().split("T")[0]}</p>
        ${unknownHtml}
        ${gapHtml}
        <hr style="border-color:#1e293b;margin:20px 0">
        <p style="color:#475569;font-size:12px">Cron horaire automatique — lib/disease-data.ts</p>
      </div>`;

    await sendEmail(
      adminEmail,
      `[HealthWatch] Disease coverage — ${unknownList.length} inconnu(es), ${gapList.length} gap(s)`,
      html
    );

    const { error: sigWriteErr } = await supabase
      .from("site_config")
      .upsert({ key: NOTIFY_SIG_KEY, value: signature }, { onConflict: "key" });
    // Failing to store it only costs a duplicate email next hour, but say so
    // rather than leaving the throttle silently non-functional.
    if (sigWriteErr) {
      console.error("[disease-coverage] notify-signature write failed:", sigWriteErr.message);
    }
  }

  // Everything resolved — drop the throttle key so the next occurrence emails
  // immediately instead of being matched against a stale signature.
  if (!hasIssues) {
    const { error: sigClearErr } = await supabase
      .from("site_config")
      .delete()
      .eq("key", NOTIFY_SIG_KEY);
    if (sigClearErr) {
      console.error("[disease-coverage] notify-signature clear failed:", sigClearErr.message);
    }
  }

  await logCronRun(supabase, "disease-coverage", "ok", unknownList.length + gapList.length);
  return NextResponse.json({
    ok: true,
    unknown: unknownList,
    travelerRiskGaps: gapList,
    emailThrottled,
    checkedAt: new Date().toISOString(),
  });
}
