// ─── Trial-ending reminder email ──────────────────────────────────────────────
// Sent at J-3 (3 days before trial_ends_at).
// Tone: positive ("here's what you've unlocked"), not fear-based.
// CTA → billing portal / account so the user can confirm their payment method.

const APP_URL = "https://healthwatch-global.com";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type PlanCopy = {
  subject:     string;
  subject1?:   string;
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
      subject1:    "Votre essai HealthWatch se termine demain",
      headline:    "Votre essai Pro se termine dans 3 jours.",
      intro:       (d) => `Votre accès Pro expire le <strong>${d}</strong>. Pour conserver l'accès aux chiffres exacts, aux rapports PDF et aux alertes, ajoutez un moyen de paiement dès maintenant.`,
      highlights:  [
        "Chiffres exacts (cas & décès) par épidémie",
        "Alertes régionales instantanées",
        "Export CSV illimité",
        "Rapports PDF pour toutes les régions",
        "Alertes par maladie — Mpox, Ebola, Choléra où qu'ils surviennent",
      ],
      ctaLabel:    "Activer mon abonnement →",
      reassurance: "29 €/mois · Annulation possible à tout moment, sans frais.",
      closing:     "À très bientôt,\nL'équipe HealthWatch Global",
    },
    pro: {
      subject:     "Votre essai HealthWatch Pro se termine dans 3 jours",
      subject1:    "Votre essai HealthWatch Pro se termine demain",
      headline:    "Votre essai Pro se termine dans 3 jours.",
      intro:       (d) => `Votre accès Pro expire le <strong>${d}</strong>. Pour conserver l'accès aux chiffres exacts, aux rapports PDF et aux alertes, ajoutez un moyen de paiement dès maintenant.`,
      highlights:  [
        "Chiffres exacts (cas & décès) par épidémie",
        "Alertes régionales instantanées",
        "Export CSV illimité",
        "Rapports PDF pour toutes les régions",
        "Alertes par maladie — Mpox, Ebola, Choléra où qu'ils surviennent",
      ],
      ctaLabel:    "Activer mon abonnement →",
      reassurance: "29 €/mois · Annulation possible à tout moment, sans frais.",
      closing:     "À très bientôt,\nL'équipe HealthWatch Global",
    },
  },
  en: {
    starter: {
      subject:     "Your HealthWatch trial ends in 3 days",
      subject1:    "Your HealthWatch trial ends tomorrow",
      headline:    "Your Pro trial ends in 3 days.",
      intro:       (d) => `Your Pro access expires on <strong>${d}</strong>. To keep access to exact figures, PDF reports and alerts, add a payment method now.`,
      highlights:  [
        "Exact case & death figures per outbreak",
        "Instant regional alerts",
        "Unlimited CSV export",
        "PDF reports for all regions",
        "Disease-specific alerts — Mpox, Ebola, Cholera wherever they strike",
      ],
      ctaLabel:    "Activate my subscription →",
      reassurance: "€29/month · Cancel anytime, no fees.",
      closing:     "See you soon,\nThe HealthWatch Global team",
    },
    pro: {
      subject:     "Your HealthWatch Pro trial ends in 3 days",
      subject1:    "Your HealthWatch Pro trial ends tomorrow",
      headline:    "Your Pro trial ends in 3 days.",
      intro:       (d) => `Your Pro access expires on <strong>${d}</strong>. To keep access to exact figures, PDF reports and alerts, add a payment method now.`,
      highlights:  [
        "Exact case & death figures per outbreak",
        "Instant regional alerts",
        "Unlimited CSV export",
        "PDF reports for all regions",
        "Disease-specific alerts — Mpox, Ebola, Cholera wherever they strike",
      ],
      ctaLabel:    "Activate my subscription →",
      reassurance: "€29/month · Cancel anytime, no fees.",
      closing:     "See you soon,\nThe HealthWatch Global team",
    },
  },
  es: {
    starter: {
      subject:     "Su prueba de HealthWatch termina en 3 días",
      subject1:    "Su prueba de HealthWatch termina mañana",
      headline:    "Su prueba Pro termina en 3 días.",
      intro:       (d) => `Su acceso Pro expira el <strong>${d}</strong>. Para conservar el acceso a cifras exactas, informes PDF y alertas, añada un método de pago ahora.`,
      highlights:  [
        "Cifras exactas (casos y fallecimientos) por brote",
        "Alertas regionales instantáneas",
        "Exportación CSV ilimitada",
        "Informes PDF para todas las regiones",
        "Alertas por enfermedad — Mpox, Ébola, Cólera donde quiera que aparezcan",
      ],
      ctaLabel:    "Activar mi suscripción →",
      reassurance: "29 €/mes · Cancelación en cualquier momento, sin cargo.",
      closing:     "Hasta pronto,\nEl equipo de HealthWatch Global",
    },
    pro: {
      subject:     "Su prueba de HealthWatch Pro termina en 3 días",
      subject1:    "Su prueba de HealthWatch Pro termina mañana",
      headline:    "Su prueba Pro termina en 3 días.",
      intro:       (d) => `Su acceso Pro expira el <strong>${d}</strong>. Para conservar el acceso a cifras exactas, informes PDF y alertas, añada un método de pago ahora.`,
      highlights:  [
        "Cifras exactas (casos y fallecimientos) por brote",
        "Alertas regionales instantáneas",
        "Exportación CSV ilimitada",
        "Informes PDF para todas las regiones",
        "Alertas por enfermedad — Mpox, Ébola, Cólera donde quiera que aparezcan",
      ],
      ctaLabel:    "Activar mi suscripción →",
      reassurance: "29 €/mes · Cancelación en cualquier momento, sin cargo.",
      closing:     "Hasta pronto,\nEl equipo de HealthWatch Global",
    },
  },
  ar: {
    starter: {
      subject:     "تنتهي تجربتك في HealthWatch خلال 3 أيام",
      subject1:    "تنتهي تجربتك في HealthWatch غداً",
      headline:    "تجربتك Pro تنتهي خلال 3 أيام.",
      intro:       (d) => `ينتهي وصولك Pro في <strong>${d}</strong>. للاحتفاظ بالوصول إلى الأرقام الدقيقة وتقارير PDF والتنبيهات، أضف وسيلة دفع الآن.`,
      highlights:  [
        "أرقام دقيقة (الحالات والوفيات) لكل تفشٍّ",
        "تنبيهات إقليمية فورية",
        "تصدير CSV غير محدود",
        "تقارير PDF لجميع المناطق",
        "تنبيهات خاصة بالأمراض — Mpox، إيبولا، كوليرا أينما ظهرت",
      ],
      ctaLabel:    "← تفعيل اشتراكي",
      reassurance: "29 €/شهر · إلغاء في أي وقت، دون رسوم.",
      closing:     "إلى اللقاء،\nفريق HealthWatch Global",
    },
    pro: {
      subject:     "تنتهي تجربتك في HealthWatch Pro خلال 3 أيام",
      subject1:    "تنتهي تجربتك في HealthWatch Pro غداً",
      headline:    "تجربتك Pro تنتهي خلال 3 أيام.",
      intro:       (d) => `ينتهي وصولك Pro في <strong>${d}</strong>. للاحتفاظ بالوصول إلى الأرقام الدقيقة وتقارير PDF والتنبيهات، أضف وسيلة دفع الآن.`,
      highlights:  [
        "أرقام دقيقة (الحالات والوفيات) لكل تفشٍّ",
        "تنبيهات إقليمية فورية",
        "تصدير CSV غير محدود",
        "تقارير PDF لجميع المناطق",
        "تنبيهات خاصة بالأمراض — Mpox، إيبولا، كوليرا أينما ظهرت",
      ],
      ctaLabel:    "← تفعيل اشتراكي",
      reassurance: "29 €/شهر · إلغاء في أي وقت، دون رسوم.",
      closing:     "إلى اللقاء،\nفريق HealthWatch Global",
    },
  },
  id: {
    starter: {
      subject:     "Uji coba HealthWatch Anda berakhir dalam 3 hari",
      subject1:    "Uji coba HealthWatch Anda berakhir besok",
      headline:    "Uji coba Pro Anda berakhir dalam 3 hari.",
      intro:       (d) => `Akses Pro Anda berakhir pada <strong>${d}</strong>. Untuk mempertahankan akses ke angka tepat, laporan PDF, dan peringatan, tambahkan metode pembayaran sekarang.`,
      highlights:  [
        "Angka tepat (kasus & kematian) per wabah",
        "Peringatan regional instan",
        "Ekspor CSV tak terbatas",
        "Laporan PDF untuk semua wilayah",
        "Peringatan per penyakit — Mpox, Ebola, Kolera di mana pun muncul",
      ],
      ctaLabel:    "Aktifkan langganan saya →",
      reassurance: "€29/bulan · Batalkan kapan saja, tanpa biaya.",
      closing:     "Sampai jumpa,\nTim HealthWatch Global",
    },
    pro: {
      subject:     "Uji coba HealthWatch Pro Anda berakhir dalam 3 hari",
      subject1:    "Uji coba HealthWatch Pro Anda berakhir besok",
      headline:    "Uji coba Pro Anda berakhir dalam 3 hari.",
      intro:       (d) => `Akses Pro Anda berakhir pada <strong>${d}</strong>. Untuk mempertahankan akses ke angka tepat, laporan PDF, dan peringatan, tambahkan metode pembayaran sekarang.`,
      highlights:  [
        "Angka tepat (kasus & kematian) per wabah",
        "Peringatan regional instan",
        "Ekspor CSV tak terbatas",
        "Laporan PDF untuk semua wilayah",
        "Peringatan per penyakit — Mpox, Ebola, Kolera di mana pun muncul",
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

// ─── Copy for institutional pilot users (is_pilot=true) ────────────────────────
// The /pilot page promises a 45-min closing session ending in a concrete paid
// proposal (Team plan or custom) — this is the backstop email if that session
// hasn't happened yet by J-3/J-1. It must never look like the generic €29/month
// self-serve pitch: different plan (Team), different CTA (reply to talk, not
// silently auto-activate a subscription), and it names their organization.
const PILOT_COPY: Record<string, {
  subject: (org: string) => string;
  subject1: (org: string) => string;
  headline: string;
  intro: (d: string, org: string) => string;
  ctaLabel: string;
  reassurance: string;
  closing: string;
}> = {
  fr: {
    subject:  (org) => `Le pilote HealthWatch de ${org} se termine dans 3 jours`,
    subject1: (org) => `Le pilote HealthWatch de ${org} se termine demain`,
    headline: "Votre pilote institutionnel se termine dans 3 jours.",
    intro:    (d, org) => `L'accès Pro de ${esc(org)} expire le <strong>${d}</strong> et repassera automatiquement en gratuit sans action de votre part. Si votre équipe souhaite continuer, répondez à cet email — on prend 15 minutes pour caler un tarif Team adapté à votre organisation (à partir de 149€/mois pour 5 sièges, ajustable).`,
    ctaLabel: "Répondre pour en discuter →",
    reassurance: "Pas de renouvellement automatique, pas de carte bancaire enregistrée pendant le pilote.",
    closing:  "À bientôt,\nDavid — HealthWatch Global",
  },
  en: {
    subject:  (org) => `${org}'s HealthWatch pilot ends in 3 days`,
    subject1: (org) => `${org}'s HealthWatch pilot ends tomorrow`,
    headline: "Your institutional pilot ends in 3 days.",
    intro:    (d, org) => `${esc(org)}'s Pro access expires on <strong>${d}</strong> and will automatically revert to Free — no action needed on your end. If your team wants to continue, just reply to this email — we'll set up a Team plan that fits your organization (from €149/month for 5 seats, adjustable).`,
    ctaLabel: "Reply to discuss →",
    reassurance: "No auto-renewal, no card on file during the pilot.",
    closing:  "Talk soon,\nDavid — HealthWatch Global",
  },
  es: {
    subject:  (org) => `El piloto de ${org} en HealthWatch termina en 3 días`,
    subject1: (org) => `El piloto de ${org} en HealthWatch termina mañana`,
    headline: "Su piloto institucional termina en 3 días.",
    intro:    (d, org) => `El acceso Pro de ${esc(org)} expira el <strong>${d}</strong> y volverá automáticamente al plan gratuito. Si su equipo desea continuar, responda a este email — buscamos juntos un plan Team adaptado (desde 149€/mes para 5 puestos).`,
    ctaLabel: "Responder para hablar →",
    reassurance: "Sin renovación automática, sin tarjeta registrada durante el piloto.",
    closing:  "Hasta pronto,\nDavid — HealthWatch Global",
  },
  ar: {
    subject:  (org) => `ينتهي برنامج ${org} التجريبي خلال 3 أيام`,
    subject1: (org) => `ينتهي برنامج ${org} التجريبي غداً`,
    headline: "ينتهي برنامجكم التجريبي المؤسسي خلال 3 أيام.",
    intro:    (d, org) => `ينتهي وصول ${esc(org)} في <strong>${d}</strong> وسيعود تلقائياً إلى الخطة المجانية. إذا رغب فريقكم بالاستمرار، فقط ردوا على هذا البريد.`,
    ctaLabel: "← الرد للمناقشة",
    reassurance: "لا تجديد تلقائي، لا بطاقة مسجلة خلال التجربة.",
    closing:  "إلى اللقاء،\nDavid — HealthWatch Global",
  },
  id: {
    subject:  (org) => `Pilot HealthWatch ${org} berakhir dalam 3 hari`,
    subject1: (org) => `Pilot HealthWatch ${org} berakhir besok`,
    headline: "Pilot institusional Anda berakhir dalam 3 hari.",
    intro:    (d, org) => `Akses Pro ${esc(org)} berakhir pada <strong>${d}</strong> dan akan otomatis kembali ke Free. Jika tim Anda ingin melanjutkan, balas email ini saja.`,
    ctaLabel: "Balas untuk berdiskusi →",
    reassurance: "Tanpa perpanjangan otomatis, tanpa kartu selama pilot.",
    closing:  "Sampai jumpa,\nDavid — HealthWatch Global",
  },
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
  fr: (c) => `🔔 <strong>${c.count} foyer${c.count > 1 ? "s" : ""} actif${c.count > 1 ? "s" : ""}</strong> dans votre région cette semaine${c.diseases.length ? ` (${c.diseases.map(esc).join(", ")})` : ""} — les utilisateurs Pro ont été alertés sous 8h. Restez couvert.`,
  en: (c) => `🔔 <strong>${c.count} active outbreak${c.count > 1 ? "s" : ""}</strong> in your region this week${c.diseases.length ? ` (${c.diseases.map(esc).join(", ")})` : ""} — Pro users were notified within 8h. Stay covered.`,
  es: (c) => `🔔 <strong>${c.count} brote${c.count > 1 ? "s" : ""} activo${c.count > 1 ? "s" : ""}</strong> en su región esta semana${c.diseases.length ? ` (${c.diseases.map(esc).join(", ")})` : ""} — usuarios Pro notificados en menos de 8h.`,
  ar: (c) => `🔔 <strong>${c.count} تفشٍّ نشط</strong> في منطقتك هذا الأسبوع${c.diseases.length ? ` (${c.diseases.map(esc).join("، ")})` : ""} — أُبلغ مستخدمو Pro خلال 8 ساعات.`,
  id: (c) => `🔔 <strong>${c.count} wabah aktif</strong> di wilayah Anda minggu ini${c.diseases.length ? ` (${c.diseases.map(esc).join(", ")})` : ""} — pengguna Pro diberitahu dalam 8 jam.`,
};

export function buildTrialEndingEmail(
  plan: "starter" | "pro",
  locale: string,
  trialEndsAt: string,
  hasPaymentMethod = false,
  regionalContext: RegionalContext | null = null,
  pilot: { isPilot: boolean; organization: string | null } | null = null
): { subject: string; html: string } {
  const safeLocale = COPY[locale] ? locale : "en";
  // "starter" no longer exists — redirect to pro template
  const effectivePlan = plan === "starter" ? "pro" : plan;
  const c     = COPY[safeLocale][effectivePlan];
  const rc    = RENEW_COPY[safeLocale] ?? RENEW_COPY.en;
  const ps    = PLAN_STYLE[effectivePlan];
  const isRtl = safeLocale === "ar";
  const dateStr = formatTrialEnd(trialEndsAt, safeLocale);
  const daysLeft = Math.round((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);

  // Pilot users who haven't converted yet (no Stripe sub) get the institutional
  // copy — different plan framing (Team, not €29/mo Pro) and a human CTA
  // (reply to talk) instead of a silent self-serve "activate my subscription"
  // link. A pilot who already has a payment method converted on their own
  // initiative, which takes priority over this branch.
  const isPilotPending = !!pilot?.isPilot && !hasPaymentMethod;
  const pc = PILOT_COPY[safeLocale] ?? PILOT_COPY.en;
  const org = pilot?.organization || (safeLocale === "fr" ? "votre organisation" : "your organization");

  const ctaUrl = isPilotPending
    ? "mailto:david.deheunynck@gmail.com?subject=" + encodeURIComponent(safeLocale === "fr" ? `Suite du pilote — ${org}` : `Following up on our pilot — ${org}`)
    : `${APP_URL}/${safeLocale}/account`;

  // Override copy for users who already have a payment method
  const intro = isPilotPending
    ? pc.intro(dateStr, org)
    : (hasPaymentMethod ? rc.intro(dateStr) : c.intro(dateStr));
  const ctaLabel = isPilotPending
    ? pc.ctaLabel
    : (hasPaymentMethod ? rc.ctaLabel : c.ctaLabel);
  const reassurance = isPilotPending
    ? pc.reassurance
    : (hasPaymentMethod ? rc.reassurance : c.reassurance);
  const headline = isPilotPending ? pc.headline : c.headline;
  const closing  = isPilotPending ? pc.closing : c.closing;
  const subject  = isPilotPending
    ? (daysLeft <= 1 ? pc.subject1(org) : pc.subject(org))
    : (daysLeft <= 1 ? (c.subject1 ?? c.subject) : c.subject);

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
        ${headline}
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
      ${closing}
    </p>

  </div>
</body>
</html>`;

  return { subject, html };
}
