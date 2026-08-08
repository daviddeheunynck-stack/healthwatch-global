import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken, alertConfirmTokenSubject } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_LOCALES = new Set(["fr", "en", "es", "ar", "id"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Confirmation counterpart to app/api/unsubscribe-alert/route.ts, for the
// same 3 tables (see the 2026-08-08 migration adding confirmed_at). GET only
// shows a confirmation page — no write — for the identical reason
// unsubscribe-alert's GET does: an email-security gateway prefetching every
// link in a message to scan it must not be able to silently confirm consent
// a human never gave (same class of incident as the 2026-08-03 IOM
// unsubscribe prefetch, just inverted — there the risk was an unwanted
// unsubscribe, here it's an unwanted confirm).
const KINDS: Record<string, { table: string; label: Record<string, string> }> = {
  country_risk: {
    table: "country_risk_alerts",
    label: { fr: "cette alerte de risque pays", en: "this country risk alert", es: "esta alerta de riesgo de país", ar: "تنبيه خطر البلد هذا", id: "peringatan risiko negara ini" },
  },
  geofence: {
    table: "geofence_alerts",
    label: { fr: "cette alerte de zone", en: "this geofence alert", es: "esta alerta de zona", ar: "تنبيه المنطقة هذا", id: "peringatan zona ini" },
  },
  category: {
    table: "category_alerts",
    label: { fr: "cette alerte de catégorie", en: "this category alert", es: "esta alerta de categoría", ar: "تنبيه الفئة هذا", id: "peringatan kategori ini" },
  },
};

const MESSAGES: Record<string, { title: string; body: (label: string) => string; back: string }> = {
  fr: { title: "Alerte confirmée",  body: (l) => `Vous recevrez désormais des emails pour ${l}.`, back: "← Retour au site" },
  en: { title: "Alert confirmed",   body: (l) => `You will now receive emails for ${l}.`, back: "← Back to website" },
  es: { title: "Alerta confirmada", body: (l) => `Ahora recibirá correos para ${l}.`, back: "← Volver al sitio" },
  ar: { title: "تم تأكيد التنبيه", body: (l) => `ستتلقى الآن رسائل بخصوص ${l}.`, back: "العودة إلى الموقع →" },
  id: { title: "Peringatan dikonfirmasi", body: (l) => `Anda sekarang akan menerima email untuk ${l}.`, back: "← Kembali ke situs" },
};

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  fr: { title: "Lien invalide", body: "Ce lien est invalide, expiré, ou l'alerte a été supprimée." },
  en: { title: "Invalid link",  body: "This link is invalid, expired, or the alert has been deleted." },
  es: { title: "Enlace no válido", body: "Este enlace no es válido, ha expirado, o la alerta ha sido eliminada." },
  ar: { title: "رابط غير صالح", body: "هذا الرابط غير صالح أو منتهي الصلاحية أو تم حذف التنبيه." },
  id: { title: "Tautan tidak valid", body: "Tautan ini tidak valid, kedaluwarsa, atau peringatan telah dihapus." },
};

const CONFIRM: Record<string, { title: string; body: (label: string) => string; cta: string; cancel: string }> = {
  fr: { title: "Confirmer cette alerte", body: (l) => `Activer ${l} sur cette adresse email ?`, cta: "Confirmer", cancel: "Annuler" },
  en: { title: "Confirm this alert", body: (l) => `Activate ${l} on this email address?`, cta: "Confirm", cancel: "Cancel" },
  es: { title: "Confirmar esta alerta", body: (l) => `¿Activar ${l} en esta dirección de correo?`, cta: "Confirmar", cancel: "Cancelar" },
  ar: { title: "تأكيد هذا التنبيه", body: (l) => `تفعيل ${l} على عنوان البريد الإلكتروني هذا؟`, cta: "تأكيد", cancel: "إلغاء" },
  id: { title: "Konfirmasi peringatan ini", body: (l) => `Aktifkan ${l} di alamat email ini?`, cta: "Konfirmasi", cancel: "Batal" },
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
    button.primary{background:#1d4ed8;border-color:#1d4ed8;color:#ffffff;font-weight:700;margin-bottom:10px}
    button.primary:hover{background:#1e40af;border-color:#1e40af;color:#ffffff}
    .row{display:flex;flex-direction:column;gap:10px}
  </style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`;
}

function confirmPage(locale: string, kind: string, rawId: string, token: string, label: string): string {
  const safeLocale = VALID_LOCALES.has(locale) ? locale : "en";
  const c   = CONFIRM[safeLocale];
  const dir = safeLocale === "ar" ? "rtl" : "ltr";
  const body = `
    <div class="icon">✉️</div>
    <h1>${c.title}</h1>
    <p>${c.body(label)}</p>
    <form method="POST" class="row">
      <input type="hidden" name="kind" value="${kind}"/>
      <input type="hidden" name="id" value="${rawId}"/>
      <input type="hidden" name="token" value="${token}"/>
      <input type="hidden" name="locale" value="${safeLocale}"/>
      <button type="submit" class="primary">${c.cta}</button>
      <a href="https://healthwatch-global.com/${safeLocale}">${c.cancel}</a>
    </form>`;
  return pageShell(safeLocale, dir, c.title, body);
}

function resultPage(locale: string, success: boolean, label: string): string {
  const safeLocale = VALID_LOCALES.has(locale) ? locale : "en";
  const m   = MESSAGES[safeLocale];
  const err = ERROR_MESSAGES[safeLocale];
  const dir = safeLocale === "ar" ? "rtl" : "ltr";
  const title = success ? m.title : err.title;
  const body = `
    <div class="icon">${success ? "✅" : "⚠️"}</div>
    <h1>${title}</h1>
    <p>${success ? m.body(label) : err.body}</p>
    <a href="https://healthwatch-global.com/${safeLocale}">${m.back}</a>`;
  return pageShell(safeLocale, dir, title, body);
}

function html(content: string, status: number) {
  return new NextResponse(content, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function labelFor(kind: string, locale: string): string {
  const l = KINDS[kind]?.label;
  return l?.[locale] ?? l?.en ?? "this alert";
}

export async function GET(req: NextRequest) {
  const kind      = req.nextUrl.searchParams.get("kind") ?? "";
  const rawId     = req.nextUrl.searchParams.get("id") ?? "";
  const token     = req.nextUrl.searchParams.get("token") ?? "";
  const rawLocale = req.nextUrl.searchParams.get("locale") ?? "en";
  const locale    = VALID_LOCALES.has(rawLocale) ? rawLocale : "en";
  const label     = labelFor(kind, locale);

  if (!KINDS[kind] || !UUID_RE.test(rawId)) {
    return html(resultPage(locale, false, label), 400);
  }
  if (!verifyUnsubscribeToken(alertConfirmTokenSubject(kind, rawId), token)) {
    return html(resultPage(locale, false, label), 403);
  }

  return html(confirmPage(locale, kind, rawId, token, label), 200);
}

export async function POST(req: NextRequest) {
  const form      = await req.formData().catch(() => null);
  const kind      = form?.get("kind")?.toString()   ?? req.nextUrl.searchParams.get("kind") ?? "";
  const rawId     = form?.get("id")?.toString()     ?? req.nextUrl.searchParams.get("id") ?? "";
  const token     = form?.get("token")?.toString()  ?? req.nextUrl.searchParams.get("token") ?? "";
  const rawLocale = form?.get("locale")?.toString() ?? req.nextUrl.searchParams.get("locale") ?? "en";
  const locale    = VALID_LOCALES.has(rawLocale) ? rawLocale : "en";
  const label     = labelFor(kind, locale);

  if (!KINDS[kind] || !UUID_RE.test(rawId)) {
    return html(resultPage(locale, false, label), 400);
  }
  if (!verifyUnsubscribeToken(alertConfirmTokenSubject(kind, rawId), token)) {
    return html(resultPage(locale, false, label), 403);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Idempotent: a double-click, or an email-security scanner that somehow
  // still reaches the POST (form submission, not a bare GET prefetch), must
  // not error out on a second confirm. .is("confirmed_at", null) means a
  // second call just matches 0 rows rather than re-stamping a new timestamp.
  const { error, data } = await supabase
    .from(KINDS[kind].table)
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", rawId)
    .is("confirmed_at", null)
    .select("id");

  if (error) {
    console.error(`[confirm-alert] update error (${kind}):`, error);
    return html(resultPage(locale, false, label), 500);
  }

  console.log(`[confirm-alert] kind=${kind} id=${rawId} rows_confirmed=${data?.length ?? 0}`);
  // 0 rows means already confirmed or the row no longer exists — still show
  // success rather than leaking which case it was.
  return html(resultPage(locale, true, label), 200);
}
