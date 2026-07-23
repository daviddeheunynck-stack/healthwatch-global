import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_LOCALES = new Set(["fr", "en", "es", "ar", "id"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES: Record<string, { title: string; body: string; back: string }> = {
  fr: { title: "Désabonnement confirmé", body: "Vous ne recevrez plus d'emails promotionnels de HealthWatch Global.", back: "← Retour au site" },
  en: { title: "Unsubscribed",           body: "You will no longer receive promotional emails from HealthWatch Global.", back: "← Back to website" },
  es: { title: "Suscripción cancelada",  body: "Ya no recibirá correos promocionales de HealthWatch Global.",          back: "← Volver al sitio" },
  ar: { title: "تم إلغاء الاشتراك",      body: "لن تتلقى بعد الآن رسائل ترويجية من HealthWatch Global.",             back: "العودة إلى الموقع →" },
  id: { title: "Berhasil berhenti",      body: "Anda tidak akan menerima email promosi dari HealthWatch Global lagi.",  back: "← Kembali ke situs" },
};

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  fr: { title: "Lien invalide", body: "Ce lien est invalide ou a déjà été utilisé." },
  en: { title: "Invalid link",  body: "This link is invalid or has already been used." },
  es: { title: "Enlace no válido", body: "Este enlace no es válido o ya se ha utilizado." },
  ar: { title: "رابط غير صالح", body: "هذا الرابط غير صالح أو تم استخدامه مسبقاً." },
  id: { title: "Tautan tidak valid", body: "Tautan ini tidak valid atau sudah digunakan." },
};

function htmlPage(locale: string, success: boolean): string {
  const safeLocale = VALID_LOCALES.has(locale) ? locale : "en";
  const m   = MESSAGES[safeLocale];
  const err = ERROR_MESSAGES[safeLocale];
  const dir = safeLocale === "ar" ? "rtl" : "ltr";

  return `<!DOCTYPE html>
<html lang="${safeLocale}" dir="${dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${success ? m.title : err.title} — HealthWatch Global</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#111827;color:#e5e7eb;
      display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px 16px}
    .card{background:#1f2937;border:1px solid #374151;border-radius:16px;padding:40px 36px;
      max-width:460px;width:100%;text-align:center}
    .icon{font-size:44px;margin-bottom:20px}
    h1{color:#f9fafb;font-size:20px;font-weight:700;margin:0 0 12px}
    p{color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 28px}
    a{display:inline-block;color:#9ca3af;text-decoration:none;font-size:13px;
      border:1px solid #374151;border-radius:8px;padding:8px 18px}
    a:hover{color:#f9fafb;border-color:#6b7280}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "⚠️"}</div>
    <h1>${success ? m.title : err.title}</h1>
    <p>${success ? m.body : err.body}</p>
    <a href="https://healthwatch-global.com/${safeLocale}">${m.back}</a>
  </div>
</body>
</html>`;
}

function html(content: string, status: number) {
  return new NextResponse(content, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const rawId     = req.nextUrl.searchParams.get("id") ?? "";
  const token     = req.nextUrl.searchParams.get("token") ?? "";
  const rawLocale = req.nextUrl.searchParams.get("locale") ?? "en";
  const locale    = VALID_LOCALES.has(rawLocale) ? rawLocale : "en";

  if (!UUID_RE.test(rawId)) {
    return html(htmlPage(locale, false), 400);
  }
  // The id alone used to be treated as a valid credential — anyone who learned
  // another user's UUID (exposed elsewhere by /api/team/members, /api/org/activity)
  // could silently flip their display_filters. A handful of links already sent
  // before this fix will 403 once; every email template generating this URL now
  // includes the matching token.
  if (!verifyUnsubscribeToken(rawId, token)) {
    return html(htmlPage(locale, false), 403);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Read current display_filters to merge without overwriting existing prefs
  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("display_filters")
    .eq("id", rawId)
    .maybeSingle();

  if (fetchErr || !profile) {
    return html(htmlPage(locale, false), profile === null ? 404 : 500);
  }

  const merged = { ...(profile.display_filters as Record<string, unknown> ?? {}), no_weekly_signal: true };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ display_filters: merged })
    .eq("id", rawId);

  if (updateErr) {
    console.error("[unsubscribe-signal] update error:", updateErr);
    return html(htmlPage(locale, false), 500);
  }

  return html(htmlPage(locale, true), 200);
}
