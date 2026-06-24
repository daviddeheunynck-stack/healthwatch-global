// ─── Trial-ending reminder email ──────────────────────────────────────────────
// Sent at J-3 (3 days before trial_ends_at).
// Tone: positive ("here's what you've unlocked"), not fear-based.
// CTA → billing portal / account so the user can confirm their payment method.

const APP_URL = "https://healthwatch-global.com";

type PlanCopy = {
  subject:     string;
  headline:    string;
  intro:       (date: string) => string;
  highlights:  string[];
  ctaLabel:    string;
  reassurance: string;
  closing:     string;
};

type LocaleCopy = {
  starter: PlanCopy;
  pro:     PlanCopy;
};

const COPY: Record<string, LocaleCopy> = {
  fr: {
    starter: {
      subject:     "Votre essai HealthWatch se termine dans 3 jours",
      headline:    "Votre essai Pro se termine dans 3 jours.",
      intro:       (d) => `Votre accès Pro expire le <strong>${d}</strong>. Pour conserver l'accès aux chiffres exacts, aux rapports PDF et aux alertes, ajoutez un moyen de paiement dès maintenant.`,
      highlights:  [
        "Chiffres exacts (cas & décès) par épidémie",
        "Alertes régionales instantanées",
        "Export CSV illimité",
        "Rapports PDF pour toutes les régions",
      ],
      ctaLabel:    "Activer mon abonnement →",
      reassurance: "29 €/mois · Annulation possible à tout moment, sans frais.",
      closing:     "À très bientôt,\nL'équipe HealthWatch Global",
    },
    pro: {
      subject:     "Votre essai HealthWatch Pro se termine dans 3 jours",
      headline:    "Votre essai Pro se termine dans 3 jours.",
      intro:       (d) => `Votre accès Pro expire le <strong>${d}</strong>. Pour conserver l'accès aux chiffres exacts, aux rapports PDF et aux alertes, ajoutez un moyen de paiement dès maintenant.`,
      highlights:  [
        "Chiffres exacts (cas & décès) par épidémie",
        "Alertes régionales instantanées",
        "Export CSV illimité",
        "Rapports PDF pour toutes les régions",
      ],
      ctaLabel:    "Activer mon abonnement →",
      reassurance: "29 €/mois · Annulation possible à tout moment, sans frais.",
      closing:     "À très bientôt,\nL'équipe HealthWatch Global",
    },
  },
  en: {
    starter: {
      subject:     "Your HealthWatch trial ends in 3 days",
      headline:    "Your Pro trial ends in 3 days.",
      intro:       (d) => `Your Pro access expires on <strong>${d}</strong>. To keep access to exact figures, PDF reports and alerts, add a payment method now.`,
      highlights:  [
        "Exact case & death figures per outbreak",
        "Instant regional alerts",
        "Unlimited CSV export",
        "PDF reports for all regions",
      ],
      ctaLabel:    "Activate my subscription →",
      reassurance: "€29/month · Cancel anytime, no fees.",
      closing:     "See you soon,\nThe HealthWatch Global team",
    },
    pro: {
      subject:     "Your HealthWatch Pro trial ends in 3 days",
      headline:    "Your Pro trial ends in 3 days.",
      intro:       (d) => `Your Pro access expires on <strong>${d}</strong>. To keep access to exact figures, PDF reports and alerts, add a payment method now.`,
      highlights:  [
        "Exact case & death figures per outbreak",
        "Instant regional alerts",
        "Unlimited CSV export",
        "PDF reports for all regions",
      ],
      ctaLabel:    "Activate my subscription →",
      reassurance: "€29/month · Cancel anytime, no fees.",
      closing:     "See you soon,\nThe HealthWatch Global team",
    },
  },
  es: {
    starter: {
      subject:     "Su prueba de HealthWatch termina en 3 días",
      headline:    "Su prueba Pro termina en 3 días.",
      intro:       (d) => `Su acceso Pro expira el <strong>${d}</strong>. Para conservar el acceso a cifras exactas, informes PDF y alertas, añada un método de pago ahora.`,
      highlights:  [
        "Cifras exactas (casos y fallecimientos) por brote",
        "Alertas regionales instantáneas",
        "Exportación CSV ilimitada",
        "Informes PDF para todas las regiones",
      ],
      ctaLabel:    "Activar mi suscripción →",
      reassurance: "29 €/mes · Cancelación en cualquier momento, sin cargo.",
      closing:     "Hasta pronto,\nEl equipo de HealthWatch Global",
    },
    pro: {
      subject:     "Su prueba de HealthWatch Pro termina en 3 días",
      headline:    "Su prueba Pro termina en 3 días.",
      intro:       (d) => `Su acceso Pro expira el <strong>${d}</strong>. Para conservar el acceso a cifras exactas, informes PDF y alertas, añada un método de pago ahora.`,
      highlights:  [
        "Cifras exactas (casos y fallecimientos) por brote",
        "Alertas regionales instantáneas",
        "Exportación CSV ilimitada",
        "Informes PDF para todas las regiones",
      ],
      ctaLabel:    "Activar mi suscripción →",
      reassurance: "29 €/mes · Cancelación en cualquier momento, sin cargo.",
      closing:     "Hasta pronto,\nEl equipo de HealthWatch Global",
    },
  },
  ar: {
    starter: {
      subject:     "تنتهي تجربتك في HealthWatch خلال 3 أيام",
      headline:    "تجربتك Pro تنتهي خلال 3 أيام.",
      intro:       (d) => `ينتهي وصولك Pro في <strong>${d}</strong>. للاحتفاظ بالوصول إلى الأرقام الدقيقة وتقارير PDF والتنبيهات، أضف وسيلة دفع الآن.`,
      highlights:  [
        "أرقام دقيقة (الحالات والوفيات) لكل تفشٍّ",
        "تنبيهات إقليمية فورية",
        "تصدير CSV غير محدود",
        "تقارير PDF لجميع المناطق",
      ],
      ctaLabel:    "← تفعيل اشتراكي",
      reassurance: "29 €/شهر · إلغاء في أي وقت، دون رسوم.",
      closing:     "إلى اللقاء،\nفريق HealthWatch Global",
    },
    pro: {
      subject:     "تنتهي تجربتك في HealthWatch Pro خلال 3 أيام",
      headline:    "تجربتك Pro تنتهي خلال 3 أيام.",
      intro:       (d) => `ينتهي وصولك Pro في <strong>${d}</strong>. للاحتفاظ بالوصول إلى الأرقام الدقيقة وتقارير PDF والتنبيهات، أضف وسيلة دفع الآن.`,
      highlights:  [
        "أرقام دقيقة (الحالات والوفيات) لكل تفشٍّ",
        "تنبيهات إقليمية فورية",
        "تصدير CSV غير محدود",
        "تقارير PDF لجميع المناطق",
      ],
      ctaLabel:    "← تفعيل اشتراكي",
      reassurance: "29 €/شهر · إلغاء في أي وقت، دون رسوم.",
      closing:     "إلى اللقاء،\nفريق HealthWatch Global",
    },
  },
  id: {
    starter: {
      subject:     "Uji coba HealthWatch Anda berakhir dalam 3 hari",
      headline:    "Uji coba Pro Anda berakhir dalam 3 hari.",
      intro:       (d) => `Akses Pro Anda berakhir pada <strong>${d}</strong>. Untuk mempertahankan akses ke angka tepat, laporan PDF, dan peringatan, tambahkan metode pembayaran sekarang.`,
      highlights:  [
        "Angka tepat (kasus & kematian) per wabah",
        "Peringatan regional instan",
        "Ekspor CSV tak terbatas",
        "Laporan PDF untuk semua wilayah",
      ],
      ctaLabel:    "Aktifkan langganan saya →",
      reassurance: "€29/bulan · Batalkan kapan saja, tanpa biaya.",
      closing:     "Sampai jumpa,\nTim HealthWatch Global",
    },
    pro: {
      subject:     "Uji coba HealthWatch Pro Anda berakhir dalam 3 hari",
      headline:    "Uji coba Pro Anda berakhir dalam 3 hari.",
      intro:       (d) => `Akses Pro Anda berakhir pada <strong>${d}</strong>. Untuk mempertahankan akses ke angka tepat, laporan PDF, dan peringatan, tambahkan metode pembayaran sekarang.`,
      highlights:  [
        "Angka tepat (kasus & kematian) per wabah",
        "Peringatan regional instan",
        "Ekspor CSV tak terbatas",
        "Laporan PDF untuk semua wilayah",
      ],
      ctaLabel:    "Aktifkan langganan saya →",
      reassurance: "€29/bulan · Batalkan kapan saja, tanpa biaya.",
      closing:     "Sampai jumpa,\nTim HealthWatch Global",
    },
  },
};

// ─── Date formatter ────────────────────────────────────────────────────────────

function formatTrialEnd(isoDate: string, locale: string): string {
  try {
    const d = new Date(isoDate);
    // e.g. "12 juin 2025" / "June 12, 2025" / "12 de junio de 2025"
    return d.toLocaleDateString(locale === "ar" ? "ar-SA" : locale, {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return isoDate.slice(0, 10);
  }
}

// ─── Plan badge colours ────────────────────────────────────────────────────────

const PLAN_STYLE = {
  starter: { bg: "#1e3a5f", color: "#93c5fd", label: { fr: "Starter", en: "Starter", es: "Starter", ar: "Starter", id: "Starter" } },
  pro:     { bg: "#78350f", color: "#fcd34d", label: { fr: "Pro",     en: "Pro",     es: "Pro",     ar: "Pro",     id: "Pro"     } },
};

// ─── Copy for users who already have a payment method (Stripe webhook path) ────

const RENEW_COPY: Record<string, { intro: (d: string) => string; ctaLabel: string; reassurance: string }> = {
  fr: {
    intro:       (d) => `Votre essai Pro se termine le <strong>${d}</strong>. Vous avez déjà ajouté un moyen de paiement — votre abonnement Pro sera renouvelé automatiquement. Aucune action requise.`,
    ctaLabel:    "Gérer mon abonnement →",
    reassurance: "Annulation possible à tout moment depuis votre espace compte.",
  },
  en: {
    intro:       (d) => `Your Pro trial ends on <strong>${d}</strong>. You've already added a payment method — your Pro subscription will renew automatically. No action needed.`,
    ctaLabel:    "Manage my subscription →",
    reassurance: "Cancel anytime from your account page.",
  },
  es: {
    intro:       (d) => `Su prueba Pro termina el <strong>${d}</strong>. Ya añadió un método de pago — su suscripción Pro se renovará automáticamente. No se requiere ninguna acción.`,
    ctaLabel:    "Gestionar mi suscripción →",
    reassurance: "Cancelación en cualquier momento desde su cuenta.",
  },
  ar: {
    intro:       (d) => `ينتهي اشتراكك التجريبي Pro في <strong>${d}</strong>. لقد أضفت بالفعل طريقة دفع — سيتجدد اشتراكك Pro تلقائياً. لا يلزم أي إجراء.`,
    ctaLabel:    "← إدارة اشتراكي",
    reassurance: "يمكن الإلغاء في أي وقت من صفحة حسابك.",
  },
  id: {
    intro:       (d) => `Uji coba Pro Anda berakhir pada <strong>${d}</strong>. Anda sudah menambahkan metode pembayaran — langganan Pro Anda akan diperbarui secara otomatis. Tidak perlu tindakan lain.`,
    ctaLabel:    "Kelola langganan saya →",
    reassurance: "Batalkan kapan saja dari halaman akun Anda.",
  },
};

// ─── HTML builder ──────────────────────────────────────────────────────────────

type RegionalContext = { count: number; diseases: string[] };

const REGIONAL_COPY: Record<string, (ctx: RegionalContext) => string> = {
  fr: (c) => `🔔 <strong>${c.count} foyer${c.count > 1 ? "s" : ""} actif${c.count > 1 ? "s" : ""}</strong> dans votre région cette semaine${c.diseases.length ? ` (${c.diseases.join(", ")})` : ""} — les utilisateurs Pro ont été alertés sous 8h. Restez couvert.`,
  en: (c) => `🔔 <strong>${c.count} active outbreak${c.count > 1 ? "s" : ""}</strong> in your region this week${c.diseases.length ? ` (${c.diseases.join(", ")})` : ""} — Pro users were notified within 8h. Stay covered.`,
  es: (c) => `🔔 <strong>${c.count} brote${c.count > 1 ? "s" : ""} activo${c.count > 1 ? "s" : ""}</strong> en su región esta semana${c.diseases.length ? ` (${c.diseases.join(", ")})` : ""} — usuarios Pro notificados en menos de 8h.`,
  ar: (c) => `🔔 <strong>${c.count} تفشٍّ نشط</strong> في منطقتك هذا الأسبوع${c.diseases.length ? ` (${c.diseases.join("، ")})` : ""} — أُبلغ مستخدمو Pro خلال 8 ساعات.`,
  id: (c) => `🔔 <strong>${c.count} wabah aktif</strong> di wilayah Anda minggu ini${c.diseases.length ? ` (${c.diseases.join(", ")})` : ""} — pengguna Pro diberitahu dalam 8 jam.`,
};

export function buildTrialEndingEmail(
  plan: "starter" | "pro",
  locale: string,
  trialEndsAt: string,
  hasPaymentMethod = false,
  regionalContext: RegionalContext | null = null
): { subject: string; html: string } {
  const safeLocale = COPY[locale] ? locale : "en";
  // "starter" no longer exists — redirect to pro template
  const effectivePlan = plan === "starter" ? "pro" : plan;
  const c     = COPY[safeLocale][effectivePlan];
  const rc    = RENEW_COPY[safeLocale] ?? RENEW_COPY.en;
  const ps    = PLAN_STYLE[effectivePlan];
  const isRtl = safeLocale === "ar";
  const ctaUrl = `${APP_URL}/${safeLocale}/account`;
  const dateStr = formatTrialEnd(trialEndsAt, safeLocale);

  // Override copy for users who already have a payment method
  const intro      = hasPaymentMethod ? rc.intro(dateStr)  : c.intro(dateStr);
  const ctaLabel   = hasPaymentMethod ? rc.ctaLabel        : c.ctaLabel;
  const reassurance = hasPaymentMethod ? rc.reassurance    : c.reassurance;

  const bulletItems = c.highlights
    .map(
      (h) =>
        `<li style="padding:5px 0;color:#d1d5db;font-size:13px;line-height:1.5">
          <span style="color:#34d399;margin-${isRtl ? "left" : "right"}:8px">✓</span>${h}
        </li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${safeLocale}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#111827;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">

    <!-- Card -->
    <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;margin-bottom:16px">

      <!-- Plan badge -->
      <div style="margin-bottom:20px">
        <span style="display:inline-block;background:${ps.bg};color:${ps.color};font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.04em">
          ${ps.label[safeLocale as keyof typeof ps.label] ?? plan.toUpperCase()}
        </span>
      </div>

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 14px;line-height:1.3">
        ${c.headline}
      </h1>

      <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.7">
        ${intro}
      </p>

      <!-- Highlights -->
      <div style="background:#111827;border:1px solid #374151;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <ul style="margin:0;padding:0;list-style:none">
          ${bulletItems}
        </ul>
      </div>

      ${regionalContext ? `<!-- Regional context -->
      <div style="background:#1c2a1c;border:1px solid #365436;border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#86efac;line-height:1.6">
        ${(REGIONAL_COPY[safeLocale] ?? REGIONAL_COPY.en)(regionalContext)}
      </div>` : ""}

      <!-- CTA -->
      <a href="${ctaUrl}"
         style="display:block;background:#2563eb;color:#ffffff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;text-align:center;margin-bottom:16px">
        ${ctaLabel}
      </a>

      <!-- Reassurance -->
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;line-height:1.6">
        ${reassurance}
      </p>

    </div>

    <!-- Closing -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;white-space:pre-line;margin:0">
      ${c.closing}
    </p>

  </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
