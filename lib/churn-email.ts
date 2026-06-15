// ─── Cancellation / win-back email ────────────────────────────────────────────
// Sent immediately after customer.subscription.deleted fires.
// Tone: warm, human, zero pressure. One clear path back.

const APP_URL = "https://healthwatch-global.com";

type ChurnCopy = {
  subject:     string;
  headline:    string;
  intro:       string;
  losingTitle: string;
  losing:      string[];
  comeback:    string;
  ctaLabel:    string;
  ctaUrl:      string;
  contactLine: string;
  contactUrl:  string;
  closing:     string;
};

const COPY: Record<string, Record<string, ChurnCopy>> = {

  // ── Pro ───────────────────────────────────────────────────────────────────

  pro: {
    fr: {
      subject:     "Votre abonnement Pro est annulé — à bientôt 👋",
      headline:    "Votre abonnement Pro a été annulé.",
      intro:       "C'est confirmé. Vous repassez sur le plan gratuit à la fin de la période en cours.",
      losingTitle: "Vous n'aurez plus accès à :",
      losing: [
        "Alertes instantanées — dès notre synchronisation (toutes les 6h) avec l'OMS",
        "Rapports PDF pour toutes les régions mondiales",
        "Intégration Slack / Teams",
        "Chiffres exacts de cas et de décès",
        "Export CSV",
      ],
      comeback:  "Vous pouvez vous réabonner à tout moment — vos préférences seront restaurées.",
      ctaLabel:  "Voir les formules →",
      ctaUrl:    `${APP_URL}/fr/pricing`,
      contactLine: "Quelque chose n'a pas fonctionné comme prévu ? Je lis tous les emails — répondez directement.",
      contactUrl:  `${APP_URL}/fr/contact`,
      closing:   "Bonne continuation,\nDavid — HealthWatch Global",
    },
    en: {
      subject:     "Your Pro subscription has been cancelled — take care 👋",
      headline:    "Your Pro subscription has been cancelled.",
      intro:       "Confirmed. You'll revert to the free plan at the end of your current period.",
      losingTitle: "You'll lose access to:",
      losing: [
        "Instant alerts — the moment our 6h WHO sync detects something new",
        "PDF reports for all global regions",
        "Slack / Teams integration",
        "Exact case and death figures",
        "CSV export",
      ],
      comeback:  "You can resubscribe at any time — your preferences will be restored.",
      ctaLabel:  "See plans →",
      ctaUrl:    `${APP_URL}/en/pricing`,
      contactLine: "Something didn't work as expected? I read every email — reply directly.",
      contactUrl:  `${APP_URL}/en/contact`,
      closing:   "Take care,\nDavid — HealthWatch Global",
    },
    es: {
      subject:     "Su suscripción Pro ha sido cancelada — hasta pronto 👋",
      headline:    "Su suscripción Pro ha sido cancelada.",
      intro:       "Confirmado. Volverá al plan gratuito al final de su período actual.",
      losingTitle: "Perderá acceso a:",
      losing: [
        "Alertas instantáneas — en cada sincronización (cada 6h) con la OMS",
        "Informes PDF para todas las regiones",
        "Integración Slack / Teams",
        "Cifras exactas de casos y fallecidos",
        "Exportación CSV",
      ],
      comeback:  "Puede volver a suscribirse en cualquier momento — sus preferencias serán restauradas.",
      ctaLabel:  "Ver planes →",
      ctaUrl:    `${APP_URL}/es/pricing`,
      contactLine: "¿Algo no funcionó como esperaba? Leo todos los correos — responda directamente.",
      contactUrl:  `${APP_URL}/es/contact`,
      closing:   "Hasta pronto,\nDavid — HealthWatch Global",
    },
    ar: {
      subject:     "تم إلغاء اشتراكك في Pro — وداعاً 👋",
      headline:    "تم إلغاء اشتراكك في Pro.",
      intro:       "تأكيد. ستعود إلى الخطة المجانية في نهاية فترتك الحالية.",
      losingTitle: "لن تتمكن من الوصول إلى:",
      losing: [
        "التنبيهات الفورية — مع كل مزامنة (كل 6 ساعات) مع المنظمة",
        "تقارير PDF لجميع المناطق العالمية",
        "تكامل Slack / Teams",
        "الأرقام الدقيقة للحالات والوفيات",
        "تصدير CSV",
      ],
      comeback:  "يمكنك إعادة الاشتراك في أي وقت — وستُستعاد تفضيلاتك.",
      ctaLabel:  "← عرض الخطط",
      ctaUrl:    `${APP_URL}/ar/pricing`,
      contactLine: "شيء لم يسر كما هو متوقع؟ أقرأ كل رسالة — أجب مباشرةً.",
      contactUrl:  `${APP_URL}/ar/contact`,
      closing:   "مع السلامة،\nDavid — HealthWatch Global",
    },
    id: {
      subject:     "Langganan Pro Anda telah dibatalkan — sampai jumpa 👋",
      headline:    "Langganan Pro Anda telah dibatalkan.",
      intro:       "Dikonfirmasi. Anda akan kembali ke paket gratis di akhir periode Anda saat ini.",
      losingTitle: "Anda tidak lagi memiliki akses ke:",
      losing: [
        "Peringatan instan — pada setiap sinkronisasi 6 jam dengan WHO",
        "Laporan PDF untuk semua wilayah global",
        "Integrasi Slack / Teams",
        "Angka kasus dan kematian yang tepat",
        "Ekspor CSV",
      ],
      comeback:  "Anda dapat berlangganan kembali kapan saja — preferensi Anda akan dipulihkan.",
      ctaLabel:  "Lihat paket →",
      ctaUrl:    `${APP_URL}/id/pricing`,
      contactLine: "Sesuatu tidak berjalan seperti yang diharapkan? Saya membaca setiap email — balas langsung.",
      contactUrl:  `${APP_URL}/id/contact`,
      closing:   "Sampai jumpa,\nDavid — HealthWatch Global",
    },
  },

  // ── Enterprise ────────────────────────────────────────────────────────────

  enterprise: {
    fr: {
      subject:     "Votre abonnement Enterprise est annulé — à bientôt 👋",
      headline:    "Votre abonnement Enterprise a été annulé.",
      intro:       "C'est confirmé. L'accès à l'API et toutes les fonctionnalités Pro seront désactivés à la fin de la période en cours.",
      losingTitle: "Vous n'aurez plus accès à :",
      losing: [
        "API REST — accès programmatique aux données de foyers",
        "Toutes les fonctionnalités Pro (alertes, PDF, Slack, CSV)",
        "Vos clés API existantes seront révoquées automatiquement",
      ],
      comeback:  "Si votre équipe a encore besoin de l'API ou de nos données mises à jour toutes les 6h, contactez-nous — nous pouvons trouver une solution adaptée.",
      ctaLabel:  "Discuter avec nous →",
      ctaUrl:    `${APP_URL}/fr/contact`,
      contactLine: "Répondez directement à cet email — je lis tout personnellement.",
      contactUrl:  `${APP_URL}/fr/contact`,
      closing:   "Bonne continuation,\nDavid — HealthWatch Global",
    },
    en: {
      subject:     "Your Enterprise subscription has been cancelled — take care 👋",
      headline:    "Your Enterprise subscription has been cancelled.",
      intro:       "Confirmed. API access and all Pro features will be deactivated at the end of your current period.",
      losingTitle: "You'll lose access to:",
      losing: [
        "REST API — programmatic access to outbreak data",
        "All Pro features (alerts, PDF reports, Slack, CSV)",
        "Your existing API keys will be automatically revoked",
      ],
      comeback:  "If your team still needs the API or our data updated every 6h, reach out — we can find a solution that works.",
      ctaLabel:  "Talk to us →",
      ctaUrl:    `${APP_URL}/en/contact`,
      contactLine: "Reply directly to this email — I read everything personally.",
      contactUrl:  `${APP_URL}/en/contact`,
      closing:   "Take care,\nDavid — HealthWatch Global",
    },
    es: {
      subject:     "Su suscripción Enterprise ha sido cancelada — hasta pronto 👋",
      headline:    "Su suscripción Enterprise ha sido cancelada.",
      intro:       "Confirmado. El acceso a la API y todas las funciones Pro se desactivarán al final de su período actual.",
      losingTitle: "Perderá acceso a:",
      losing: [
        "API REST — acceso programático a datos de brotes",
        "Todas las funciones Pro (alertas, PDF, Slack, CSV)",
        "Sus claves API existentes serán revocadas automáticamente",
      ],
      comeback:  "Si su equipo todavía necesita la API o nuestros datos actualizados a diario, contáctenos — podemos encontrar una solución.",
      ctaLabel:  "Hablar con nosotros →",
      ctaUrl:    `${APP_URL}/es/contact`,
      contactLine: "Responda directamente a este correo — lo leo todo personalmente.",
      contactUrl:  `${APP_URL}/es/contact`,
      closing:   "Hasta pronto,\nDavid — HealthWatch Global",
    },
    ar: {
      subject:     "تم إلغاء اشتراكك في Enterprise — وداعاً 👋",
      headline:    "تم إلغاء اشتراكك في Enterprise.",
      intro:       "تأكيد. سيتم إلغاء الوصول إلى API وجميع مزايا Pro في نهاية فترتك الحالية.",
      losingTitle: "لن تتمكن من الوصول إلى:",
      losing: [
        "API REST — الوصول البرمجي لبيانات التفشيات",
        "جميع مزايا Pro (تنبيهات، PDF، Slack، CSV)",
        "ستُلغى مفاتيح API الحالية تلقائياً",
      ],
      comeback:  "إذا كان فريقك لا يزال بحاجة إلى API أو بياناتنا المحدّثة كل 6 ساعات، تواصل معنا — يمكننا إيجاد حل مناسب.",
      ctaLabel:  "← التحدث معنا",
      ctaUrl:    `${APP_URL}/ar/contact`,
      contactLine: "أجب مباشرةً على هذا البريد — أقرأ كل رسالة شخصياً.",
      contactUrl:  `${APP_URL}/ar/contact`,
      closing:   "مع السلامة،\nDavid — HealthWatch Global",
    },
    id: {
      subject:     "Langganan Enterprise Anda telah dibatalkan — sampai jumpa 👋",
      headline:    "Langganan Enterprise Anda telah dibatalkan.",
      intro:       "Dikonfirmasi. Akses API dan semua fitur Pro akan dinonaktifkan di akhir periode Anda saat ini.",
      losingTitle: "Anda tidak lagi memiliki akses ke:",
      losing: [
        "REST API — akses programatik ke data wabah",
        "Semua fitur Pro (peringatan, PDF, Slack, CSV)",
        "Kunci API Anda yang ada akan dicabut secara otomatis",
      ],
      comeback:  "Jika tim Anda masih membutuhkan API atau data kami yang diperbarui harian, hubungi kami — kami dapat menemukan solusi yang tepat.",
      ctaLabel:  "Bicara dengan kami →",
      ctaUrl:    `${APP_URL}/id/contact`,
      contactLine: "Balas langsung ke email ini — saya membaca semuanya secara pribadi.",
      contactUrl:  `${APP_URL}/id/contact`,
      closing:   "Sampai jumpa,\nDavid — HealthWatch Global",
    },
  },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

export function buildChurnEmail(
  plan: "starter" | "pro" | "enterprise",
  locale: string
): { subject: string; html: string } {
  const effectivePlan = plan === "starter" ? "pro" : plan;
  const planCopy = COPY[effectivePlan] ?? COPY.pro;
  const c        = planCopy[locale] ?? planCopy.en;
  const isRtl    = locale === "ar";

  const lossRows = c.losing
    .map(
      (item) =>
        `<tr><td style="padding:5px 0;color:#d1d5db;font-size:14px;line-height:1.5">✗ &nbsp;${item}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111827;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">

    <!-- Card -->
    <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;margin-bottom:16px">

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 12px">${c.headline}</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6">${c.intro}</p>

      <!-- What they're losing -->
      <div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px">
          ${c.losingTitle}
        </p>
        <table style="width:100%;border-collapse:collapse">
          <tbody>${lossRows}</tbody>
        </table>
      </div>

      <!-- Comeback message -->
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px">${c.comeback}</p>

      <!-- CTA -->
      <a href="${c.ctaUrl}"
         style="display:block;background:#374151;color:#f9fafb;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;text-align:center;margin-bottom:16px">
        ${c.ctaLabel}
      </a>

      <!-- Contact line -->
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;text-align:center">
        ${c.contactLine}
      </p>
    </div>

    <!-- Signature -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;white-space:pre-line;margin:0">
      ${c.closing}
    </p>
  </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
