// Confirmation-request email sent immediately after a country-risk/geofence/
// category alert is created (app/api/{country-risk-alerts,geofence-alerts,
// category-alerts}/route.ts) -- see the 2026-08-08 migration adding
// confirmed_at. Deliberately separate from lib/unsubscribe-token.ts's link
// builder (that file owns the signed URL, not the email copy) and from
// lib/pilot-emails.ts (a different feature's confirmation flow entirely).
import { sendBrevoEmail } from "@/lib/brevo-send";
import { isRealProduction } from "@/lib/cron-monitor";
import { rateLimit } from "@/lib/rate-limit";
import type { UnsubscribeAlertKind } from "@/lib/unsubscribe-token";
import * as Sentry from "@sentry/nextjs";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const KIND_LABEL: Record<UnsubscribeAlertKind, Record<string, string>> = {
  country_risk: { fr: "alerte de risque pays", en: "country risk alert", es: "alerta de riesgo de país", ar: "تنبيه خطر البلد", id: "peringatan risiko negara" },
  geofence:     { fr: "alerte de zone",        en: "geofence alert",     es: "alerta de zona",           ar: "تنبيه المنطقة",       id: "peringatan zona" },
  category:     { fr: "alerte de catégorie",   en: "category alert",     es: "alerta de categoría",      ar: "تنبيه الفئة",         id: "peringatan kategori" },
};

const COPY: Record<string, { subject: (l: string) => string; heading: string; body: (l: string) => string; cta: string; ignore: string }> = {
  fr: {
    subject: (l) => `Confirmez votre ${l} — HealthWatch Global`,
    heading: "Confirmez votre adresse email",
    body: (l) => `Quelqu'un a configuré une <strong>${esc(l)}</strong> sur HealthWatch Global avec cette adresse. Pour commencer à recevoir ces alertes, confirmez que vous êtes bien le destinataire.`,
    cta: "Confirmer cette alerte →",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — aucune alerte ne sera envoyée sans confirmation.",
  },
  en: {
    subject: (l) => `Confirm your ${l} — HealthWatch Global`,
    heading: "Confirm your email address",
    body: (l) => `Someone set up a <strong>${esc(l)}</strong> on HealthWatch Global using this address. To start receiving these alerts, confirm you're the intended recipient.`,
    cta: "Confirm this alert →",
    ignore: "If you didn't request this, simply ignore this email — no alert will be sent without confirmation.",
  },
  es: {
    subject: (l) => `Confirme su ${l} — HealthWatch Global`,
    heading: "Confirme su dirección de correo",
    body: (l) => `Alguien configuró una <strong>${esc(l)}</strong> en HealthWatch Global con esta dirección. Para empezar a recibir estas alertas, confirme que usted es el destinatario.`,
    cta: "Confirmar esta alerta →",
    ignore: "Si usted no solicitó esto, simplemente ignore este correo — no se enviará ninguna alerta sin confirmación.",
  },
  ar: {
    subject: (l) => `تأكيد ${l} — HealthWatch Global`,
    heading: "تأكيد عنوان بريدك الإلكتروني",
    body: (l) => `قام شخص ما بإعداد <strong>${esc(l)}</strong> على HealthWatch Global باستخدام هذا العنوان. لبدء تلقي هذه التنبيهات، يرجى تأكيد أنك المستلم المقصود.`,
    cta: "← تأكيد هذا التنبيه",
    ignore: "إذا لم تطلب هذا، يرجى تجاهل هذه الرسالة — لن يُرسل أي تنبيه دون تأكيد.",
  },
  id: {
    subject: (l) => `Konfirmasi ${l} Anda — HealthWatch Global`,
    heading: "Konfirmasi alamat email Anda",
    body: (l) => `Seseorang telah mengatur <strong>${esc(l)}</strong> di HealthWatch Global menggunakan alamat ini. Untuk mulai menerima peringatan ini, konfirmasikan bahwa Anda adalah penerima yang dituju.`,
    cta: "Konfirmasi peringatan ini →",
    ignore: "Jika Anda tidak meminta ini, abaikan saja email ini — tidak ada peringatan yang akan dikirim tanpa konfirmasi.",
  },
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * Confirmation emails go to an address the account owner typed in freely, so
 * this route is the one place where an authenticated user can cause mail to
 * be sent to an arbitrary third party. The double opt-in above stops the
 * RECURRING alerts, but nothing stopped the confirmation request itself from
 * being replayed: MAX_ALERTS caps rows held at once, not rows created over
 * time, and all 3 routes expose DELETE — so create/delete/create in a loop
 * was an unbounded mail generator pointed at any address, sent from
 * alerts@healthwatch-global.com (deliverability + abuse exposure on our own
 * sending domain).
 *
 * Only THIRD-PARTY addresses are limited. `to === ownerEmail` is the common
 * case by far (the account owner alerting themselves, and category-alerts
 * even defaults `email` to `user.email`), it is already a proven address —
 * Supabase confirmed it at signup — and a legitimate bulk setup can
 * legitimately create up to MAX_ALERTS rows in one sitting across the 3
 * features. Rate-limiting that case would break real use to no benefit,
 * since the owner can already mail themselves.
 *
 * Two counters, both must pass: per recipient (one address can't be buried)
 * and per user (one account can't spray many addresses). In-memory and
 * per-process like every other rate limit in this repo (see lib/rate-limit.ts
 * — a Redis store is the documented upgrade path); on serverless that makes
 * it a speed bump rather than a hard cap, but it turns a free unbounded
 * loop into one that visibly reports itself to Sentry.
 */
function thirdPartySendAllowed(to: string, ownerEmail: string | null | undefined, userId: string): string | null {
  const norm  = to.trim().toLowerCase();
  const owner = (ownerEmail ?? "").trim().toLowerCase();
  if (owner && norm === owner) return null;

  if (!rateLimit(`alert-confirm:user:${userId}`, { limit: 10, windowMs: HOUR_MS }).allowed)
    return "per-user limit (10/h to third-party addresses)";
  if (!rateLimit(`alert-confirm:to:${norm}`, { limit: 3, windowMs: HOUR_MS }).allowed)
    return "per-recipient limit (3/h)";
  return null;
}

export async function sendAlertConfirmationEmail(
  to: string,
  kind: UnsubscribeAlertKind,
  confirmUrl: string,
  locale: string,
  apiKey: string,
  owner?: { id: string; email: string | null | undefined }
): Promise<void> {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const label = KIND_LABEL[kind][locale] ?? KIND_LABEL[kind].en;

  const html = `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#60a5fa;font-size:17px;font-weight:700;margin:0 0 16px">${c.heading}</p>
  <p style="font-size:14px;line-height:1.6;margin:0 0 24px">${c.body(label)}</p>
  <a href="${confirmUrl}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">${c.cta}</a>
  <p style="margin-top:24px;font-size:11px;color:#475569">${c.ignore}</p>
</div>`;

  // Best-effort: the alert row is already committed by the time this runs
  // (see call sites) — a Brevo hiccup here must not turn a successful
  // creation into a failed API response. Callers catch and log to Sentry.
  if (!isRealProduction) return;

  // Blocked = the row simply stays pending, exactly as it does when Brevo
  // itself fails (see the call sites' comment). Not thrown: a rate-limited
  // send is an expected outcome, not an error the caller should surface.
  if (owner) {
    const blocked = thirdPartySendAllowed(to, owner.email, owner.id);
    if (blocked) {
      console.warn(`[alert-confirm-email] ${kind} confirmation to a third-party address suppressed — ${blocked}`);
      Sentry.captureMessage("alert confirmation email rate-limited", {
        level: "warning",
        tags: { part: "alert-confirmation-email", kind },
        extra: { reason: blocked, user_id: owner.id },
      });
      return;
    }
  }

  await sendBrevoEmail({ to, subject: c.subject(label), html, apiKey });
}
