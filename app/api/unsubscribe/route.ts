import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_LOCALES = new Set(["fr", "en", "es", "ar", "id"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Localised copy ───────────────────────────────────────────────────────────

const MESSAGES: Record<string, { title: string; body: string; back: string }> = {
  fr: {
    title: "Désabonnement confirmé",
    body:  "Vous avez été désabonné(e) avec succès. Vous ne recevrez plus de digest hebdomadaire.",
    back:  "← Retour au site",
  },
  en: {
    title: "Unsubscribed",
    body:  "You have been successfully unsubscribed and will no longer receive the weekly digest.",
    back:  "← Back to the website",
  },
  es: {
    title: "Suscripción cancelada",
    body:  "Se ha cancelado su suscripción correctamente. Ya no recibirá el digest semanal.",
    back:  "← Volver al sitio",
  },
  ar: {
    title: "تم إلغاء الاشتراك",
    body:  "تم إلغاء اشتراكك بنجاح. لن تتلقى بعد الآن الملخص الأسبوعي.",
    back:  "العودة إلى الموقع →",
  },
  id: {
    title: "Berhasil berhenti berlangganan",
    body:  "Anda telah berhasil berhenti berlangganan dan tidak akan menerima digest mingguan lagi.",
    back:  "← Kembali ke situs",
  },
};

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  fr: { title: "Lien invalide", body: "Ce lien de désabonnement est invalide ou a déjà été utilisé." },
  en: { title: "Invalid link",  body: "This unsubscribe link is invalid or has already been used." },
  es: { title: "Enlace no válido", body: "Este enlace de cancelación no es válido o ya se ha utilizado." },
  ar: { title: "رابط غير صالح",   body: "رابط إلغاء الاشتراك هذا غير صالح أو تم استخدامه بالفعل." },
  id: { title: "Tautan tidak valid", body: "Tautan berhenti berlangganan ini tidak valid atau sudah digunakan." },
};

// ─── HTML page builder ────────────────────────────────────────────────────────

function htmlPage(locale: string, success: boolean): string {
  const safeLocale = VALID_LOCALES.has(locale) ? locale : "en";
  const m   = MESSAGES[safeLocale];
  const err = ERROR_MESSAGES[safeLocale];
  const dir = safeLocale === "ar" ? "rtl" : "ltr";

  const title = success ? m.title : err.title;
  const body  = success ? m.body  : err.body;
  const icon  = success ? "✅" : "⚠️";

  return `<!DOCTYPE html>
<html lang="${safeLocale}" dir="${dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — HealthWatch Global</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #111827;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px 16px;
    }
    .card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 16px;
      padding: 40px 36px;
      max-width: 460px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 44px; margin-bottom: 20px; }
    h1 { color: #f9fafb; font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    p  { color: #9ca3af; font-size: 14px; line-height: 1.7; margin: 0 0 28px; }
    a  {
      display: inline-block;
      color: #9ca3af;
      text-decoration: none;
      font-size: 13px;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 8px 18px;
      transition: color .15s, border-color .15s;
    }
    a:hover { color: #f9fafb; border-color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="https://healthwatch-global.com/${safeLocale}">${m.back}</a>
  </div>
</body>
</html>`;
}

function html(content: string, status: number) {
  return new NextResponse(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const rawId     = req.nextUrl.searchParams.get("id") ?? "";
  const token     = req.nextUrl.searchParams.get("token") ?? "";
  const rawLocale = req.nextUrl.searchParams.get("locale") ?? "en";
  const locale    = VALID_LOCALES.has(rawLocale) ? rawLocale : "en";

  // Validate UUID format before hitting the database
  if (!UUID_RE.test(rawId)) {
    return html(htmlPage(locale, false), 400);
  }
  // The id alone used to be treated as a valid credential — the exact gap
  // already fixed on the sibling /api/unsubscribe-signal (subscriptions.id
  // isn't as broadly exposed as profiles.id, but the same fix belongs here
  // for the same reason: the link itself should be the credential, not a
  // guessable/learnable UUID. A handful of links already sent before this
  // fix will 403 once; every sender now includes the matching token.
  if (!verifyUnsubscribeToken(rawId, token)) {
    return html(htmlPage(locale, false), 403);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Soft-delete: set active = false — preserves history and allows re-subscription
  // via the webhook upsert (onConflict: "email" will flip active back to true on
  // the next successful purchase).
  const { error, count } = await supabase
    .from("subscriptions")
    .update({ active: false })
    .eq("id", rawId)
    .eq("active", true); // no-op if already inactive — idempotent

  if (error) {
    console.error("[unsubscribe] DB error:", error);
    return html(htmlPage(locale, false), 500);
  }

  console.log(`[unsubscribe] id=${rawId} rows_updated=${count ?? "?"}`);
  // count === 0 means the link was already used or never existed — still show success
  // to avoid leaking whether an ID is valid.
  return html(htmlPage(locale, true), 200);
}
