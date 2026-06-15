// ─── Payment failure notification email ───────────────────────────────────────
// Sent on invoice.payment_failed.
// Tone: calm, factual, action-oriented. No panic. Stripe retries automatically.

const APP_URL = "https://healthwatch-global.com";

type Copy = {
  subject:     string;
  badge:       string;
  headline:    string;
  intro:       string;
  whatHappens: string;
  ctaLabel:    string;
  ctaUrl:      (locale: string) => string;
  closing:     string;
  ps:          string;
};

const COPY: Record<string, Copy> = {
  fr: {
    subject:     "Problème de paiement sur votre abonnement HealthWatch ⚠️",
    badge:       "⚠️ Paiement",
    headline:    "Nous n'avons pas pu traiter votre paiement.",
    intro:       "Un problème est survenu lors du renouvellement de votre abonnement HealthWatch Global. Ne vous inquiétez pas — nous allons réessayer automatiquement dans quelques jours.",
    whatHappens: "Pour éviter toute interruption de service, vérifiez que votre moyen de paiement est à jour dans votre espace de facturation.",
    ctaLabel:    "Mettre à jour mon moyen de paiement →",
    ctaUrl:      (locale) => `${APP_URL}/${locale}/account`,
    closing:     "Si vous avez des questions, répondez directement à cet email.\n\nL'équipe HealthWatch Global",
    ps:          "Si votre paiement n'est pas régularisé, votre abonnement sera suspendu après plusieurs tentatives infructueuses.",
  },
  en: {
    subject:     "Payment issue with your HealthWatch subscription ⚠️",
    badge:       "⚠️ Payment",
    headline:    "We couldn't process your payment.",
    intro:       "There was a problem renewing your HealthWatch Global subscription. Don't worry — we'll automatically retry in a few days.",
    whatHappens: "To avoid any service interruption, please make sure your payment method is up to date in your billing settings.",
    ctaLabel:    "Update my payment method →",
    ctaUrl:      (locale) => `${APP_URL}/${locale}/account`,
    closing:     "If you have any questions, reply directly to this email.\n\nThe HealthWatch Global team",
    ps:          "If your payment isn't resolved, your subscription will be suspended after several failed attempts.",
  },
  es: {
    subject:     "Problema de pago en su suscripción HealthWatch ⚠️",
    badge:       "⚠️ Pago",
    headline:    "No pudimos procesar su pago.",
    intro:       "Hubo un problema al renovar su suscripción de HealthWatch Global. No se preocupe — volveremos a intentarlo automáticamente en unos días.",
    whatHappens: "Para evitar interrupciones del servicio, asegúrese de que su método de pago esté actualizado en su configuración de facturación.",
    ctaLabel:    "Actualizar mi método de pago →",
    ctaUrl:      (locale) => `${APP_URL}/${locale}/account`,
    closing:     "Si tiene alguna pregunta, responda directamente a este correo.\n\nEl equipo de HealthWatch Global",
    ps:          "Si el pago no se regulariza, su suscripción será suspendida tras varios intentos fallidos.",
  },
  ar: {
    subject:     "مشكلة في الدفع لاشتراكك في HealthWatch ⚠️",
    badge:       "⚠️ الدفع",
    headline:    "لم نتمكن من معالجة دفعتك.",
    intro:       "حدثت مشكلة عند تجديد اشتراكك في HealthWatch Global. لا داعي للقلق — سنعيد المحاولة تلقائياً خلال أيام.",
    whatHappens: "لتجنب أي انقطاع في الخدمة، تأكد من أن وسيلة الدفع الخاصة بك محدّثة في إعدادات الفوترة.",
    ctaLabel:    "← تحديث وسيلة الدفع",
    ctaUrl:      (locale) => `${APP_URL}/${locale}/account`,
    closing:     "إذا كان لديك أي سؤال، أجب مباشرةً على هذا البريد.\n\nفريق HealthWatch Global",
    ps:          "إذا لم يُحسم الدفع، سيُعلَّق اشتراكك بعد عدة محاولات فاشلة.",
  },
  id: {
    subject:     "Masalah pembayaran pada langganan HealthWatch Anda ⚠️",
    badge:       "⚠️ Pembayaran",
    headline:    "Kami tidak dapat memproses pembayaran Anda.",
    intro:       "Terjadi masalah saat memperbarui langganan HealthWatch Global Anda. Jangan khawatir — kami akan mencoba ulang secara otomatis dalam beberapa hari.",
    whatHappens: "Untuk menghindari gangguan layanan, pastikan metode pembayaran Anda sudah diperbarui di pengaturan penagihan.",
    ctaLabel:    "Perbarui metode pembayaran saya →",
    ctaUrl:      (locale) => `${APP_URL}/${locale}/account`,
    closing:     "Jika ada pertanyaan, balas langsung ke email ini.\n\nTim HealthWatch Global",
    ps:          "Jika pembayaran tidak diselesaikan, langganan Anda akan ditangguhkan setelah beberapa upaya yang gagal.",
  },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

export function buildPaymentFailedEmail(
  locale: string
): { subject: string; html: string } {
  const c     = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const ctaUrl = c.ctaUrl(locale);

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111827;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">

    <!-- Card -->
    <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;margin-bottom:16px">

      <!-- Warning badge -->
      <div style="display:inline-flex;align-items:center;gap:8px;background:#d9770620;border:1px solid #d9770640;border-radius:999px;padding:6px 14px;margin-bottom:24px">
        <span style="color:#fbbf24;font-size:13px;font-weight:700">${c.badge}</span>
      </div>

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 12px;line-height:1.3">
        ${c.headline}
      </h1>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;line-height:1.6">
        ${c.intro}
      </p>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 28px;line-height:1.6">
        ${c.whatHappens}
      </p>

      <!-- CTA -->
      <a href="${ctaUrl}"
         style="display:block;background:#d97706;color:#ffffff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;text-align:center">
        ${c.ctaLabel}
      </a>
    </div>

    <!-- PS -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;margin:0 0 8px">
      ${c.ps}
    </p>

    <!-- Closing -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;white-space:pre-line;margin:0">
      ${c.closing}
    </p>
  </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
