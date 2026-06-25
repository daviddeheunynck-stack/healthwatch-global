// Weekly check for two classes of data gaps in the disease reference layer:
//
//   1. Unknown diseases — disease_en values in the outbreaks table that do not
//      match any pattern in DISEASE_MAP.  These are new/renamed pathogens that
//      need a DISEASE_MAP entry (transmission, travelerRisk, factsheet…).
//
//   2. travelerRisk gaps — active outbreaks where the matched disease has no
//      travelerRisk entry for the outbreak's region.  Signals that the static
//      travelerRisk table is out of date for that disease × region pair.
//
// Schedule: 0 8 * * 1  (Monday 08:00 UTC)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { matchDisease } from "@/lib/disease-data";
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // ── 1. All unique disease_en values (last 180 days + all active) ─────────
  const cutoff = new Date(Date.now() - 180 * 86_400_000).toISOString().split("T")[0];
  const { data: rows, error } = await supabase
    .from("outbreaks")
    .select("disease_en, disease, region, active")
    .or(`date.gte.${cutoff},active.eq.true`);

  if (error) {
    console.error("[disease-coverage] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── 2. Deduplicate and classify ───────────────────────────────────────────
  // unknown: disease_en not matched in DISEASE_MAP
  const unknownSeen   = new Set<string>();
  const unknownList: string[] = [];

  // travelerRisk gaps: active outbreaks in a region where the matched disease
  // has no travelerRisk entry for that region
  type Gap = { disease: string; region: string };
  const gapSeen = new Set<string>();
  const gapList: Gap[] = [];

  for (const row of (rows ?? [])) {
    const rawName = (row.disease_en || row.disease || "").trim();
    if (!rawName) continue;

    const { info, matched } = matchDisease(rawName);

    // 2a. Unknown disease
    if (!matched && !unknownSeen.has(rawName)) {
      unknownSeen.add(rawName);
      unknownList.push(rawName);
      Sentry.captureMessage(`[disease-coverage] Unknown disease: "${rawName}"`, {
        level: "warning",
        tags: { component: "disease-coverage", type: "unknown_disease" },
        extra: { rawName },
      });
    }

    // 2b. travelerRisk gap (active outbreaks only)
    if (matched && row.active) {
      const regionSlug = (row.region ?? "").toLowerCase().replace(/\s+/g, "-") as AppRegion;
      if (KNOWN_REGIONS.has(regionSlug) && !info.travelerRisk?.[regionSlug]) {
        const gapKey = `${info.name_en}::${regionSlug}`;
        if (!gapSeen.has(gapKey)) {
          gapSeen.add(gapKey);
          gapList.push({ disease: info.name_en, region: regionSlug });
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

  const hasIssues = unknownList.length > 0 || gapList.length > 0;
  console.log(
    `[disease-coverage] done — unknown: ${unknownList.length}, gaps: ${gapList.length}`
  );

  // ── 3. Admin email if issues found ────────────────────────────────────────
  if (hasIssues && adminEmail) {
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
        <p style="color:#475569;font-size:12px">Cron hebdomadaire automatique — lib/disease-data.ts</p>
      </div>`;

    await sendEmail(
      adminEmail,
      `[HealthWatch] Disease coverage — ${unknownList.length} inconnu(es), ${gapList.length} gap(s)`,
      html
    );
  }

  return NextResponse.json({
    ok: true,
    unknown: unknownList,
    travelerRiskGaps: gapList,
    checkedAt: new Date().toISOString(),
  });
}
