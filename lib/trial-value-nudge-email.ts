// ─── Usage-triggered trial value nudge ────────────────────────────────────────
// Sent once, the first time a self-serve trial user (no Stripe subscription
// yet) receives a real "new outbreak" regional alert. Unlike trial-ending-email
// (a calendar-based J-3/J-1 reminder), this fires on an actual product event —
// "you just saw this work" — instead of an arbitrary date unrelated to whether
// the person has ever seen the product deliver anything.
//
// Same pilot/self-serve branching as trial-ending-email.ts: an institutional
// pilot (is_pilot=true) gets a "reply to talk about a Team plan" CTA instead of
// the self-serve Stripe checkout link, since pilots are meant to close as a
// human conversation, not an auto-charged card.

const APP_URL = "https://healthwatch-global.com";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface AlertContext {
  disease: string;
  country: string;
  riskLevel: "high" | "medium" | "low";
}

const RISK_LABELS: Record<string, Record<string, string>> = {
  fr: { high: "Élevé 🔴", medium: "Modéré 🟡", low: "Faible 🟢" },
  en: { high: "High 🔴", medium: "Medium 🟡", low: "Low 🟢" },
  es: { high: "Alto 🔴", medium: "Moderado 🟡", low: "Bajo 🟢" },
  ar: { high: "مرتفع 🔴", medium: "متوسط 🟡", low: "منخفض 🟢" },
  id: { high: "Tinggi 🔴", medium: "Sedang 🟡", low: "Rendah 🟢" },
};

const SELF_SERVE_COPY: Record<string, {
  subject: (disease: string) => string;
  headline: string;
  intro: (disease: string, country: string) => string;
  ctaLabel: string;
  reassurance: string;
  closing: string;
}> = {
  fr: {
    subject:     (d) => `Vous venez de voir HealthWatch en action — ${d}`,
    headline:    "Voici exactement ce qui s'arrêterait à la fin de votre essai.",
    intro:       (d, c) => `Vous venez de recevoir une alerte réelle : <strong>${esc(d)}</strong> en ${esc(c)}. C'est le genre de signal que vous ne recevriez plus après la fin de votre essai gratuit sans un moyen de paiement enregistré.`,
    ctaLabel:    "Activer mon abonnement (29 €/mois) →",
    reassurance: "Annulation possible à tout moment, sans frais.",
    closing:     "À bientôt,\nL'équipe HealthWatch Global",
  },
  en: {
    subject:     (d) => `You just saw HealthWatch in action — ${d}`,
    headline:    "This is exactly what would stop when your trial ends.",
    intro:       (d, c) => `You just received a real alert: <strong>${esc(d)}</strong> in ${esc(c)}. This is the kind of signal you'd stop receiving once your free trial ends, unless you add a payment method.`,
    ctaLabel:    "Activate my subscription (€29/month) →",
    reassurance: "Cancel anytime, no fees.",
    closing:     "See you soon,\nThe HealthWatch Global team",
  },
  es: {
    subject:     (d) => `Acaba de ver HealthWatch en acción — ${d}`,
    headline:    "Esto es exactamente lo que dejaría de recibir al terminar su prueba.",
    intro:       (d, c) => `Acaba de recibir una alerta real: <strong>${esc(d)}</strong> en ${esc(c)}. Este es el tipo de señal que dejaría de recibir al terminar su prueba gratuita, a menos que añada un método de pago.`,
    ctaLabel:    "Activar mi suscripción (29 €/mes) →",
    reassurance: "Cancelación en cualquier momento, sin cargo.",
    closing:     "Hasta pronto,\nEl equipo de HealthWatch Global",
  },
  ar: {
    subject:     (d) => `لقد شاهدت للتو HealthWatch أثناء العمل — ${d}`,
    headline:    "هذا بالضبط ما سيتوقف عند انتهاء تجربتك.",
    intro:       (d, c) => `لقد تلقيت للتو تنبيهاً حقيقياً: <strong>${esc(d)}</strong> في ${esc(c)}. هذا النوع من الإشارات سيتوقف عند انتهاء تجربتك المجانية ما لم تضف وسيلة دفع.`,
    ctaLabel:    "← تفعيل اشتراكي (29 €/شهر)",
    reassurance: "إلغاء في أي وقت، دون رسوم.",
    closing:     "إلى اللقاء،\nفريق HealthWatch Global",
  },
  id: {
    subject:     (d) => `Anda baru saja melihat HealthWatch bekerja — ${d}`,
    headline:    "Inilah persisnya yang akan berhenti saat uji coba Anda berakhir.",
    intro:       (d, c) => `Anda baru saja menerima peringatan nyata: <strong>${esc(d)}</strong> di ${esc(c)}. Inilah jenis sinyal yang akan berhenti Anda terima setelah uji coba gratis berakhir, kecuali Anda menambahkan metode pembayaran.`,
    ctaLabel:    "Aktifkan langganan saya (€29/bulan) →",
    reassurance: "Batalkan kapan saja, tanpa biaya.",
    closing:     "Sampai jumpa,\nTim HealthWatch Global",
  },
};

const PILOT_COPY: Record<string, {
  subject: (disease: string) => string;
  headline: string;
  intro: (d: string, c: string, org: string) => string;
  ctaLabel: string;
  reassurance: string;
  closing: string;
}> = {
  fr: {
    subject:     (d) => `Vous venez de voir HealthWatch en action — ${d}`,
    headline:    "Voici ce que votre équipe garderait avec un plan Team.",
    intro:       (d, c, org) => `Vous venez de recevoir une alerte réelle : <strong>${esc(d)}</strong> en ${esc(c)}. Si ${esc(org)} souhaite garder ce niveau de couverture au-delà du pilote, répondez à cet email — on cale un tarif Team adapté (à partir de 149€/mois pour 5 sièges).`,
    ctaLabel:    "Répondre pour en discuter →",
    reassurance: "Pas de renouvellement automatique, pas de carte enregistrée pendant le pilote.",
    closing:     "À bientôt,\nDavid — HealthWatch Global",
  },
  en: {
    subject:     (d) => `You just saw HealthWatch in action — ${d}`,
    headline:    "Here's what your team would keep with a Team plan.",
    intro:       (d, c, org) => `You just received a real alert: <strong>${esc(d)}</strong> in ${esc(c)}. If ${esc(org)} wants to keep this level of coverage beyond the pilot, just reply to this email — we'll set up a Team plan that fits (from €149/month for 5 seats).`,
    ctaLabel:    "Reply to discuss →",
    reassurance: "No auto-renewal, no card on file during the pilot.",
    closing:     "Talk soon,\nDavid — HealthWatch Global",
  },
  es: {
    subject:     (d) => `Acaba de ver HealthWatch en acción — ${d}`,
    headline:    "Esto es lo que su equipo conservaría con un plan Team.",
    intro:       (d, c, org) => `Acaba de recibir una alerta real: <strong>${esc(d)}</strong> en ${esc(c)}. Si ${esc(org)} desea mantener este nivel de cobertura más allá del piloto, responda a este email.`,
    ctaLabel:    "Responder para hablar →",
    reassurance: "Sin renovación automática, sin tarjeta durante el piloto.",
    closing:     "Hasta pronto,\nDavid — HealthWatch Global",
  },
  ar: {
    subject:     (d) => `لقد شاهدت للتو HealthWatch أثناء العمل — ${d}`,
    headline:    "هذا ما سيحتفظ به فريقكم مع خطة Team.",
    intro:       (d, c, org) => `لقد تلقيت للتو تنبيهاً حقيقياً: <strong>${esc(d)}</strong> في ${esc(c)}. إذا رغب ${esc(org)} بالحفاظ على هذا المستوى من التغطية، فقط ردوا على هذا البريد.`,
    ctaLabel:    "← الرد للمناقشة",
    reassurance: "لا تجديد تلقائي، لا بطاقة مسجلة خلال التجربة.",
    closing:     "إلى اللقاء،\nDavid — HealthWatch Global",
  },
  id: {
    subject:     (d) => `Anda baru saja melihat HealthWatch bekerja — ${d}`,
    headline:    "Inilah yang akan dipertahankan tim Anda dengan paket Team.",
    intro:       (d, c, org) => `Anda baru saja menerima peringatan nyata: <strong>${esc(d)}</strong> di ${esc(c)}. Jika ${esc(org)} ingin mempertahankan tingkat cakupan ini, balas email ini saja.`,
    ctaLabel:    "Balas untuk berdiskusi →",
    reassurance: "Tanpa perpanjangan otomatis, tanpa kartu selama pilot.",
    closing:     "Sampai jumpa,\nDavid — HealthWatch Global",
  },
};

export function buildTrialValueNudgeEmail(
  locale: string,
  alert: AlertContext,
  pilot: { isPilot: boolean; organization: string | null }
): { subject: string; html: string } {
  const safeLocale = SELF_SERVE_COPY[locale] ? locale : "en";
  const isRtl = safeLocale === "ar";
  const isPilot = pilot.isPilot;
  const org = pilot.organization || (safeLocale === "fr" ? "votre organisation" : "your organization");

  const c = isPilot ? PILOT_COPY[safeLocale] : SELF_SERVE_COPY[safeLocale];
  const riskLabels = RISK_LABELS[safeLocale] ?? RISK_LABELS.en;

  const ctaUrl = isPilot
    ? "mailto:david.deheunynck@gmail.com?subject=" + encodeURIComponent(safeLocale === "fr" ? `Suite du pilote — ${org}` : `Following up on our pilot — ${org}`)
    : `${APP_URL}/${safeLocale}/account`;

  const subject = c.subject(alert.disease);
  const headline = c.headline;
  const intro = isPilot
    ? (c as typeof PILOT_COPY.en).intro(alert.disease, alert.country, org)
    : (c as typeof SELF_SERVE_COPY.en).intro(alert.disease, alert.country);

  const html = `<!DOCTYPE html>
<html lang="${safeLocale}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#111827;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">
    <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;margin-bottom:16px">

      <div style="margin-bottom:20px">
        <span style="display:inline-block;background:#78350f;color:#fcd34d;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.04em">
          ${isPilot ? "PILOT" : "PRO TRIAL"}
        </span>
      </div>

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 14px;line-height:1.3">${headline}</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.7">${intro}</p>

      <!-- The alert just received -->
      <div style="background:#111827;border:1px solid #374151;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <p style="color:#ffffff;font-size:15px;font-weight:700;margin:0 0 4px">${esc(alert.disease)}</p>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 10px">${esc(alert.country)}</p>
        <span style="font-size:12px;color:#e5e7eb">${riskLabels[alert.riskLevel] ?? alert.riskLevel}</span>
      </div>

      <a href="${ctaUrl}"
         style="display:block;background:#2563eb;color:#ffffff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;text-align:center;margin-bottom:16px">
        ${c.ctaLabel}
      </a>

      <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;line-height:1.6">${c.reassurance}</p>
    </div>

    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;white-space:pre-line;margin:0">${c.closing}</p>
  </div>
</body>
</html>`;

  return { subject, html };
}
