import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken, unsubscribeAlertTokenSubject } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_LOCALES = new Set(["fr", "en", "es", "ar", "id"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared unsubscribe endpoint for the 3 paid alert features that email an
// address the account owner typed in freely (country_risk_alerts,
// geofence_alerts, category_alerts — see app/api/{country-risk-alerts,
// geofence-alerts,category-alerts}/route.ts). None of their recurring emails
// had an unsubscribe link before this: the only way to stop them was the
// Brevo blocklist, which only engages after the recipient marks the message
// as spam or it bounces. Found 2026-08-05 while auditing the email field on
// country_risk_alerts.
//
// One shared route rather than 3 near-duplicates of app/api/unsubscribe*
// (~170 lines each): the 3 tables need the exact same operation (delete one
// alert row by id), differing only in which table and what to call it in the
// confirmation copy — a real, current triplication, not a speculative one.
//
// Token subject is `${kind}:${id}`, not the bare row id: the 3 tables are
// separate UUID spaces, so composing them into the signed subject means a
// token for one kind can never be replayed against another kind's table,
// even in principle. No ownership check beyond the token is needed — same
// trust model as /api/unsubscribe (subscriptions.active=false by id+token
// alone): the signed link itself is the credential, exactly because the
// recipient proving they hold the link is the only thing this route can (or
// needs to) verify.
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
  fr: { title: "Désabonnement confirmé", body: (l) => `Vous ne recevrez plus d'emails pour ${l}.`, back: "← Retour au site" },
  en: { title: "Unsubscribed",           body: (l) => `You will no longer receive emails for ${l}.`, back: "← Back to website" },
  es: { title: "Suscripción cancelada",  body: (l) => `Ya no recibirá correos para ${l}.`, back: "← Volver al sitio" },
  ar: { title: "تم إلغاء الاشتراك",      body: (l) => `لن تتلقى بعد الآن رسائل بخصوص ${l}.`, back: "العودة إلى الموقع →" },
  id: { title: "Berhasil berhenti",      body: (l) => `Anda tidak akan lagi menerima email untuk ${l}.`, back: "← Kembali ke situs" },
};

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  fr: { title: "Lien invalide", body: "Ce lien est invalide ou a déjà été utilisé." },
  en: { title: "Invalid link",  body: "This link is invalid or has already been used." },
  es: { title: "Enlace no válido", body: "Este enlace no es válido o ya se ha utilizado." },
  ar: { title: "رابط غير صالح", body: "هذا الرابط غير صالح أو تم استخدامه مسبقاً." },
  id: { title: "Tautan tidak valid", body: "Tautan ini tidak valid atau sudah digunakan." },
};

const CONFIRM: Record<string, { title: string; body: (label: string) => string; cta: string; cancel: string }> = {
  fr: { title: "Confirmer le désabonnement", body: (l) => `Vous ne recevrez plus d'emails pour ${l}. Confirmer ?`, cta: "Me désabonner", cancel: "Annuler" },
  en: { title: "Confirm unsubscribe", body: (l) => `You will no longer receive emails for ${l}. Confirm?`, cta: "Unsubscribe me", cancel: "Cancel" },
  es: { title: "Confirmar cancelación", body: (l) => `Ya no recibirá correos para ${l}. ¿Confirmar?`, cta: "Cancelar suscripción", cancel: "Cancelar" },
  ar: { title: "تأكيد إلغاء الاشتراك", body: (l) => `لن تتلقى بعد الآن رسائل بخصوص ${l}. تأكيد؟`, cta: "إلغاء اشتراكي", cancel: "إلغاء" },
  id: { title: "Konfirmasi berhenti berlangganan", body: (l) => `Anda tidak akan lagi menerima email untuk ${l}. Konfirmasi?`, cta: "Berhenti berlangganan", cancel: "Batal" },
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
// prefetch (a GET) can't unsubscribe someone who never clicked. See
// lib/brevo-send.ts and app/api/unsubscribe/route.ts (the 2026-08-03 IOM
// incident this pattern already exists to prevent).
function confirmPage(locale: string, kind: string, rawId: string, token: string, label: string): string {
  const safeLocale = VALID_LOCALES.has(locale) ? locale : "en";
  const c   = CONFIRM[safeLocale];
  const dir = safeLocale === "ar" ? "rtl" : "ltr";
  const body = `
    <div class="icon">❓</div>
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
  if (!verifyUnsubscribeToken(unsubscribeAlertTokenSubject(kind, rawId), token)) {
    return html(resultPage(locale, false, label), 403);
  }

  return html(confirmPage(locale, kind, rawId, token, label), 200);
}

export async function POST(req: NextRequest) {
  // Mail-client one-click POST (List-Unsubscribe-Post) carries the same query
  // string as the original link; the confirmation-page form also submits
  // kind/id/token/locale, either as query string or as form fields.
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
  if (!verifyUnsubscribeToken(unsubscribeAlertTokenSubject(kind, rawId), token)) {
    return html(resultPage(locale, false, label), 403);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Full delete, not a soft-deactivate: none of the 3 tables has an `active`
  // column (unlike `subscriptions`), and this is the exact same operation the
  // trash-icon in each account panel already performs
  // (DELETE .eq("id", id).eq("user_id", user_id)) — just reachable without a
  // session, by whoever holds the signed link, since the recipient of these
  // emails often isn't the account owner.
  const { error, count } = await supabase
    .from(KINDS[kind].table)
    .delete()
    .eq("id", rawId);

  if (error) {
    console.error(`[unsubscribe-alert] delete error (${kind}):`, error);
    return html(resultPage(locale, false, label), 500);
  }

  console.log(`[unsubscribe-alert] kind=${kind} id=${rawId} rows_deleted=${count ?? "?"}`);
  // count === 0 means the link was already used or the alert no longer
  // exists — still show success rather than leaking whether the id was ever
  // valid.
  return html(resultPage(locale, true, label), 200);
}
