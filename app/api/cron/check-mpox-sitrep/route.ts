// Twice-weekly check (Wed + Sat 08:00 UTC) for new WHO Mpox Situation Reports.
// When a new sitrep is detected, sends an email to the admin with a direct link
// and a link to the admin panel to update the Mpox/Mondial row (~5 min job).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/error";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const WHO_SITREP_PAGE = "https://www.who.int/emergencies/situations/mpox-outbreak";
const ADMIN_PANEL_URL = "https://healthwatch-global.com/fr/admin";

// ── Parse WHO listing page ────────────────────────────────────────────────────

async function fetchLatestSitrep(): Promise<{ url: string; num: number } | null> {
  try {
    const res = await fetch(WHO_SITREP_PAGE, {
      headers: {
        "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
        "Accept":     "text/html,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.log(`[mpox-sitrep] WHO page → HTTP ${res.status}`);
      return null;
    }
    return parseSitrepLinks(await res.text());
  } catch (e) {
    console.log("[mpox-sitrep] fetch error:", errorMessage(e));
    return null;
  }
}

function parseSitrepLinks(html: string): { url: string; num: number } | null {
  // WHO sitrep URLs follow this pattern:
  // /publications/m/item/multi-country-outbreak-of-mpox--external-situation-report--65---30-april-2026
  const hrefRe = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  let bestNum = 0;
  let bestUrl = "";

  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1];
    const numMatch = href.match(/external-situation-report--(\d+)/i);
    if (!numMatch) continue;
    const num = parseInt(numMatch[1], 10);
    if (num > bestNum) {
      bestNum = num;
      bestUrl  = href.startsWith("http") ? href : `https://www.who.int${href}`;
    }
  }

  if (bestNum === 0) return null;
  return { url: bestUrl, num: bestNum };
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendNotification(to: string, sitrep: { url: string; num: number }) {
  if (!BREVO_API_KEY || !to) return false;

  const subject = `🦠 Nouveau sitrep Mpox OMS — Rapport #${sitrep.num}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <h2 style="border-bottom:2px solid #e5e7eb;padding-bottom:8px">
        🦠 Nouveau rapport de situation Mpox détecté
      </h2>
      <p>L'OMS vient de publier le <strong>rapport de situation Mpox n°${sitrep.num}</strong>.</p>
      <p style="color:#374151">
        <strong>3 étapes (≈ 5 min) :</strong><br>
        1. Ouvrir le rapport → relever cas totaux confirmés, décès, date de coupure<br>
        2. Aller dans le panel admin → Épidémies → ✏️ sur <em>Mpox / Mondial</em><br>
        3. Mettre à jour les chiffres + passer la ligne en <strong>Actif</strong>
      </p>
      <p style="margin:24px 0;display:flex;gap:12px">
        <a href="${sitrep.url}"
           style="display:inline-block;background:#dc2626;color:white;padding:10px 20px;
                  border-radius:8px;text-decoration:none;font-weight:bold;margin-right:12px">
          📄 Sitrep #${sitrep.num} (WHO)
        </a>
        <a href="${ADMIN_PANEL_URL}"
           style="display:inline-block;background:#111827;color:white;padding:10px 20px;
                  border-radius:8px;text-decoration:none;font-weight:bold">
          ⚙️ Panel admin
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">
        HealthWatch Global · surveillance automatique des sitreps OMS Mpox
      </p>
    </div>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:     [{ email: to }],
      subject,
      htmlContent: html,
    }),
  }).catch((e) => { console.error("[mpox-sitrep] email error:", errorMessage(e)); return null; });

  return res?.ok ?? false;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // Load last known sitrep URL
  const { data: configRow } = await supabase
    .from("site_config")
    .select("value")
    .eq("key", "mpox_last_sitrep_url")
    .single();

  const lastKnownUrl = configRow?.value ?? "";

  // Fetch latest from WHO
  const latest = await fetchLatestSitrep();

  if (!latest) {
    console.log("[mpox-sitrep] Could not detect sitrep from WHO page — will retry next run.");
    return NextResponse.json({ status: "no_data", lastKnown: lastKnownUrl });
  }

  console.log(`[mpox-sitrep] Latest detected: #${latest.num} — ${latest.url}`);
  console.log(`[mpox-sitrep] Last known:      ${lastKnownUrl || "(none)"}`);

  if (latest.url === lastKnownUrl) {
    console.log("[mpox-sitrep] Already up to date, no action needed.");
    return NextResponse.json({ status: "up_to_date", sitrep: latest.num });
  }

  // New sitrep → notify + persist
  console.log(`[mpox-sitrep] NEW sitrep #${latest.num} detected.`);

  const emailSent = adminEmail ? await sendNotification(adminEmail, latest) : false;

  await supabase
    .from("site_config")
    .upsert({ key: "mpox_last_sitrep_url", value: latest.url, updated_at: new Date().toISOString() });

  return NextResponse.json({
    status:    "new_sitrep",
    sitrep:    latest.num,
    url:       latest.url,
    emailSent,
  });
}
