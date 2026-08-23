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

// Sibling of /api/unsubscribe-signal (weekly signal) and /api/unsubscribe
// (weekly digest) — this one is for the onboarding/lifecycle sequence
// (J1/J3/J7/pilot-conversion/trial-expired, lib/onboarding-emails.ts).
// Found 2026-08-23: every one of those templates' in-body "Unsubscribe" link
// pointed at /api/unsubscribe-signal instead, which sets display_filters.
// no_weekly_signal — a flag onboarding-sequence/winback-sequence/expire-trials
// never check. They check no_onboarding_emails, which had no writer anywhere
// in the codebase: a user clicking that link saw "unsubscribed", but kept
// receiving every onboarding email regardless. This route is the missing
// writer; lib/onboarding-emails.ts now points at it instead.
const MESSAGES: Record<string, { title: string; body: string; back: string }> = {
  fr: { title: "Désabonnement confirmé", body: "Vous ne recevrez plus les e-mails de bienvenue et de suivi HealthWatch Global.", back: "← Retour au site" },
  en: { title: "Unsubscribed",           body: "You will no longer receive HealthWatch Global's welcome and follow-up emails.", back: "← Back to website" },
  es: { title: "Suscripción cancelada",  body: "Ya no recibirá los correos de bienvenida y seguimiento de HealthWatch Global.", back: "← Volver al sitio" },
  ar: { title: "تم إلغاء الاشتراك",      body: "لن تتلقى بعد الآن رسائل الترحيب والمتابعة من HealthWatch Global.",             back: "العودة إلى الموقع →" },
  id: { title: "Berhasil berhenti",      body: "Anda tidak akan menerima email selamat datang dan tindak lanjut dari HealthWatch Global lagi.", back: "← Kembali ke situs" },
};

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  fr: { title: "Lien invalide", body: "Ce lien est invalide ou a déjà été utilisé." },
  en: { title: "Invalid link",  body: "This link is invalid or has already been used." },
  es: { title: "Enlace no válido", body: "Este enlace no es válido o ya se ha utilizado." },
  ar: { title: "رابط غير صالح", body: "هذا الرابط غير صالح أو تم استخدامه مسبقاً." },
  id: { title: "Tautan tidak valid", body: "Tautan ini tidak valid atau sudah digunakan." },
};

const CONFIRM: Record<string, { title: string; body: string; cta: string; cancel: string }> = {
  fr: { title: "Confirmer le désabonnement", body: "Vous ne recevrez plus les e-mails de bienvenue et de suivi HealthWatch Global. Confirmer ?", cta: "Me désabonner", cancel: "Annuler" },
  en: { title: "Confirm unsubscribe", body: "You will no longer receive HealthWatch Global's welcome and follow-up emails. Confirm?", cta: "Unsubscribe me", cancel: "Cancel" },
  es: { title: "Confirmar cancelación", body: "Ya no recibirá los correos de bienvenida y seguimiento de HealthWatch Global. ¿Confirmar?", cta: "Cancelar suscripción", cancel: "Cancelar" },
  ar: { title: "تأكيد إلغاء الاشتراك", body: "لن تتلقى بعد الآن رسائل الترحيب والمتابعة من HealthWatch Global. تأكيد؟", cta: "إلغاء اشتراكي", cancel: "إلغاء" },
  id: { title: "Konfirmasi berhenti berlangganan", body: "Anda tidak akan lagi menerima email selamat datang dan tindak lanjut dari HealthWatch Global. Konfirmasi?", cta: "Berhenti berlangganan", cancel: "Batal" },
};

function pageShell(safeLocale: string, dir: string, title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="${safeLocale}" dir="${dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — HealthWatch Global</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#111827;color:#e5e7eb;
      display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px 16px}
    .card{background:#1f2937;border:1px solid #374151;border-radius:16px;padding:40px 36px;
      max-width:460px;width:100%;text-align:center}
    .icon{font-size:44px;margin-bottom:20px}
    h1{color:#f9fafb;font-size:20px;font-weight:700;margin:0 0 12px}
    p{color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 28px}
    a,button{display:inline-block;color:#9ca3af;text-decoration:none;font-size:13px;font-family:inherit;
      background:transparent;cursor:pointer;border:1px solid #374151;border-radius:8px;padding:8px 18px}
    a:hover,button:hover{color:#f9fafb;border-color:#6b7280}
    button.primary{background:#dc2626;border-color:#dc2626;color:#ffffff;font-weight:700;margin-bottom:10px}
    button.primary:hover{background:#b91c1c;border-color:#b91c1c;color:#ffffff}
    .row{display:flex;flex-direction:column;gap:10px}
  </style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`;
}

// GET only shows a confirmation page — no write — so a security-gateway link
// prefetch (a GET) can't unsubscribe someone who never clicked. See lib/brevo-send.ts.
function confirmPage(locale: string, rawId: string, token: string): string {
  const safeLocale = VALID_LOCALES.has(locale) ? locale : "en";
  const c   = CONFIRM[safeLocale];
  const dir = safeLocale === "ar" ? "rtl" : "ltr";
  const body = `
    <div class="icon">❓</div>
    <h1>${c.title}</h1>
    <p>${c.body}</p>
    <form method="POST" class="row">
      <input type="hidden" name="id" value="${rawId}"/>
      <input type="hidden" name="token" value="${token}"/>
      <input type="hidden" name="locale" value="${safeLocale}"/>
      <button type="submit" class="primary">${c.cta}</button>
      <a href="https://healthwatch-global.com/${safeLocale}">${c.cancel}</a>
    </form>`;
  return pageShell(safeLocale, dir, c.title, body);
}

function resultPage(locale: string, success: boolean): string {
  const safeLocale = VALID_LOCALES.has(locale) ? locale : "en";
  const m   = MESSAGES[safeLocale];
  const err = ERROR_MESSAGES[safeLocale];
  const dir = safeLocale === "ar" ? "rtl" : "ltr";
  const title = success ? m.title : err.title;
  const body = `
    <div class="icon">${success ? "✅" : "⚠️"}</div>
    <h1>${title}</h1>
    <p>${success ? m.body : err.body}</p>
    <a href="https://healthwatch-global.com/${safeLocale}">${m.back}</a>`;
  return pageShell(safeLocale, dir, title, body);
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
    return html(resultPage(locale, false), 400);
  }
  if (!verifyUnsubscribeToken(rawId, token)) {
    return html(resultPage(locale, false), 403);
  }

  return html(confirmPage(locale, rawId, token), 200);
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const rawId     = form?.get("id")?.toString()     ?? req.nextUrl.searchParams.get("id") ?? "";
  const token     = form?.get("token")?.toString()  ?? req.nextUrl.searchParams.get("token") ?? "";
  const rawLocale = form?.get("locale")?.toString() ?? req.nextUrl.searchParams.get("locale") ?? "en";
  const locale    = VALID_LOCALES.has(rawLocale) ? rawLocale : "en";

  if (!UUID_RE.test(rawId)) {
    return html(resultPage(locale, false), 400);
  }
  if (!verifyUnsubscribeToken(rawId, token)) {
    return html(resultPage(locale, false), 403);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Read current display_filters to merge without overwriting existing prefs
  // (e.g. a prior no_weekly_signal opt-out must survive this write).
  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("display_filters")
    .eq("id", rawId)
    .maybeSingle();

  if (fetchErr || !profile) {
    return html(resultPage(locale, false), profile === null ? 404 : 500);
  }

  const merged = { ...(profile.display_filters as Record<string, unknown> ?? {}), no_onboarding_emails: true };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ display_filters: merged })
    .eq("id", rawId);

  if (updateErr) {
    console.error("[unsubscribe-onboarding] update error:", updateErr);
    return html(resultPage(locale, false), 500);
  }

  return html(resultPage(locale, true), 200);
}
