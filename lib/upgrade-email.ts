// ─── Post-upgrade welcome emails ──────────────────────────────────────────────
// Sent immediately after checkout.session.completed for paid plans.
// Separate from the registration welcome (lib/welcome-email.ts).

const APP_URL = "https://healthwatch-global.com";

// ─── Per-plan, per-locale copy ────────────────────────────────────────────────

type PlanCopy = {
  subject:    string;
  headline:   string;
  intro:      string;
  features:   string[];
  ctaLabel:   string;
  ctaUrl:     string;
  secondaryLabel?: string;
  secondaryUrl?:   string;
  closing:    string;
  trialNote?: string;
};

const COPY: Record<string, Record<string, PlanCopy>> = {

  // ── Starter ────────────────────────────────────────────────────────────────
  starter: {
    fr: {
      subject:  "Bienvenue sur HealthWatch Starter 🚀",
      headline: "Votre plan Starter est actif.",
      intro:    "Vous avez maintenant accès aux données exactes de foyers épidémiques. Voici ce qui est déverrouillé :",
      features: [
        "📊 Chiffres exacts — cas confirmés et décès pour chaque foyer",
        "📄 Rapports PDF régionaux — 3 régions de votre choix, en 1 clic",
        "📥 Export CSV — toutes les épidémies actives pour vos analyses",
        "🔔 Alertes régionales — emails ciblés sur vos régions surveillées",
      ],
      ctaLabel: "Aller au tableau de bord →",
      ctaUrl:   `${APP_URL}/fr`,
      secondaryLabel: "Configurer mes alertes →",
      secondaryUrl:   `${APP_URL}/fr/account`,
      closing:  "Bonne surveillance,\nL'équipe HealthWatch Global",
    },
    en: {
      subject:  "Welcome to HealthWatch Starter 🚀",
      headline: "Your Starter plan is now active.",
      intro:    "You now have access to exact outbreak data. Here's what's unlocked:",
      features: [
        "📊 Exact figures — confirmed cases and deaths for every outbreak",
        "📄 Regional PDF reports — 3 regions of your choice, in 1 click",
        "📥 CSV export — all active outbreaks for your own analysis",
        "🔔 Regional alerts — targeted emails for your watched regions",
      ],
      ctaLabel: "Go to dashboard →",
      ctaUrl:   `${APP_URL}/en`,
      secondaryLabel: "Set up my alerts →",
      secondaryUrl:   `${APP_URL}/en/account`,
      closing:  "Stay vigilant,\nThe HealthWatch Global team",
    },
    es: {
      subject:  "Bienvenido a HealthWatch Starter 🚀",
      headline: "Su plan Starter ya está activo.",
      intro:    "Ahora tiene acceso a datos exactos de brotes. Esto es lo que está desbloqueado:",
      features: [
        "📊 Cifras exactas — casos confirmados y fallecidos por brote",
        "📄 Informes PDF regionales — 3 regiones a su elección, en 1 clic",
        "📥 Exportación CSV — todos los brotes activos para su análisis",
        "🔔 Alertas regionales — emails dirigidos a sus regiones monitoreadas",
      ],
      ctaLabel: "Ir al panel →",
      ctaUrl:   `${APP_URL}/es`,
      secondaryLabel: "Configurar alertas →",
      secondaryUrl:   `${APP_URL}/es/account`,
      closing:  "Permanezca alerta,\nEl equipo de HealthWatch Global",
    },
    ar: {
      subject:  "مرحباً بك في HealthWatch Starter 🚀",
      headline: "خطة Starter الخاصة بك نشطة الآن.",
      intro:    "أصبح بإمكانك الوصول إلى البيانات الدقيقة للتفشيات. إليك ما تم فتحه:",
      features: [
        "📊 الأرقام الدقيقة — الحالات المؤكدة والوفيات لكل تفشٍّ",
        "📄 تقارير PDF إقليمية — 3 مناطق حسب اختيارك، بنقرة واحدة",
        "📥 تصدير CSV — جميع التفشيات النشطة لتحليلاتك",
        "🔔 تنبيهات إقليمية — رسائل بريدية للمناطق التي تتابعها",
      ],
      ctaLabel: "← الذهاب إلى لوحة التحكم",
      ctaUrl:   `${APP_URL}/ar`,
      secondaryLabel: "← إعداد التنبيهات",
      secondaryUrl:   `${APP_URL}/ar/account`,
      closing:  "ابقوا يقظين،\nفريق HealthWatch Global",
    },
    id: {
      subject:  "Selamat datang di HealthWatch Starter 🚀",
      headline: "Paket Starter Anda sekarang aktif.",
      intro:    "Anda sekarang memiliki akses ke data wabah yang tepat. Berikut yang telah dibuka:",
      features: [
        "📊 Angka tepat — kasus terkonfirmasi dan kematian setiap wabah",
        "📄 Laporan PDF regional — 3 wilayah pilihan Anda, dalam 1 klik",
        "📥 Ekspor CSV — semua wabah aktif untuk analisis Anda",
        "🔔 Peringatan regional — email tertarget untuk wilayah yang Anda pantau",
      ],
      ctaLabel: "Ke dasbor →",
      ctaUrl:   `${APP_URL}/id`,
      secondaryLabel: "Atur peringatan →",
      secondaryUrl:   `${APP_URL}/id/account`,
      closing:  "Tetap waspada,\nTim HealthWatch Global",
    },
  },

  // ── Pro ────────────────────────────────────────────────────────────────────
  pro: {
    fr: {
      subject:  "Bienvenue sur HealthWatch Pro ⚡",
      headline: "Votre plan Pro est actif.",
      intro:    "Accès complet à la surveillance épidémique mondiale. Voici ce qui est déverrouillé :",
      features: [
        "📊 Chiffres exacts — cas confirmés et décès pour chaque foyer",
        "📄 Rapports PDF — toutes les régions mondiales",
        "📥 Export CSV — données complètes pour vos analyses",
        "⚡ Alertes temps réel — chaque nouveau foyer OMS en quelques secondes",
        "🌍 Toutes les régions — couverture mondiale sans restriction",
        "💬 Intégration Slack/Teams — alertes directement dans votre channel",
      ],
      ctaLabel: "Aller au tableau de bord →",
      ctaUrl:   `${APP_URL}/fr`,
      secondaryLabel: "Configurer Slack →",
      secondaryUrl:   `${APP_URL}/fr/account`,
      closing:  "Bonne surveillance,\nL'équipe HealthWatch Global",
      trialNote: "Votre essai Pro de 14 jours est en cours. Aucun prélèvement ne sera effectué avant la fin de la période d'essai.",
    },
    en: {
      subject:  "Welcome to HealthWatch Pro ⚡",
      headline: "Your Pro plan is now active.",
      intro:    "Full access to global epidemic surveillance. Here's what's unlocked:",
      features: [
        "📊 Exact figures — confirmed cases and deaths for every outbreak",
        "📄 PDF reports — all global regions",
        "📥 CSV export — complete data for your analysis",
        "⚡ Real-time alerts — every new WHO outbreak in seconds",
        "🌍 All regions — worldwide coverage, no restrictions",
        "💬 Slack/Teams integration — alerts directly in your channel",
      ],
      ctaLabel: "Go to dashboard →",
      ctaUrl:   `${APP_URL}/en`,
      secondaryLabel: "Connect Slack →",
      secondaryUrl:   `${APP_URL}/en/account`,
      closing:  "Stay vigilant,\nThe HealthWatch Global team",
      trialNote: "Your 14-day Pro trial is running. No charge will be made until the trial period ends.",
    },
    es: {
      subject:  "Bienvenido a HealthWatch Pro ⚡",
      headline: "Su plan Pro ya está activo.",
      intro:    "Acceso completo a la vigilancia epidémica mundial. Esto es lo que está desbloqueado:",
      features: [
        "📊 Cifras exactas — casos y fallecidos por brote",
        "📄 Informes PDF — todas las regiones mundiales",
        "📥 Exportación CSV — datos completos para su análisis",
        "⚡ Alertas en tiempo real — cada nuevo brote OMS en segundos",
        "🌍 Todas las regiones — cobertura mundial sin restricciones",
        "💬 Integración Slack/Teams — alertas en su canal",
      ],
      ctaLabel: "Ir al panel →",
      ctaUrl:   `${APP_URL}/es`,
      secondaryLabel: "Conectar Slack →",
      secondaryUrl:   `${APP_URL}/es/account`,
      closing:  "Permanezca alerta,\nEl equipo de HealthWatch Global",
      trialNote: "Su prueba Pro de 14 días está en marcha. No se realizará ningún cobro hasta el final del período de prueba.",
    },
    ar: {
      subject:  "مرحباً بك في HealthWatch Pro ⚡",
      headline: "خطة Pro الخاصة بك نشطة الآن.",
      intro:    "وصول كامل إلى مراقبة الأوبئة العالمية. إليك ما تم فتحه:",
      features: [
        "📊 الأرقام الدقيقة — الحالات والوفيات لكل تفشٍّ",
        "📄 تقارير PDF — جميع المناطق العالمية",
        "📥 تصدير CSV — بيانات كاملة لتحليلاتك",
        "⚡ تنبيهات فورية — كل تفشٍّ جديد من المنظمة في ثوانٍ",
        "🌍 جميع المناطق — تغطية عالمية بلا قيود",
        "💬 تكامل Slack/Teams — تنبيهات مباشرة في قناتك",
      ],
      ctaLabel: "← لوحة التحكم",
      ctaUrl:   `${APP_URL}/ar`,
      secondaryLabel: "← إعداد Slack",
      secondaryUrl:   `${APP_URL}/ar/account`,
      closing:  "ابقوا يقظين،\nفريق HealthWatch Global",
      trialNote: "تجربة Pro لمدة 14 يوماً جارية. لن يتم أي خصم قبل انتهاء فترة التجربة.",
    },
    id: {
      subject:  "Selamat datang di HealthWatch Pro ⚡",
      headline: "Paket Pro Anda sekarang aktif.",
      intro:    "Akses penuh ke pemantauan epidemi global. Berikut yang telah dibuka:",
      features: [
        "📊 Angka tepat — kasus dan kematian setiap wabah",
        "📄 Laporan PDF — semua wilayah global",
        "📥 Ekspor CSV — data lengkap untuk analisis Anda",
        "⚡ Peringatan real-time — setiap wabah WHO baru dalam hitungan detik",
        "🌍 Semua wilayah — cakupan global tanpa batasan",
        "💬 Integrasi Slack/Teams — peringatan langsung di channel Anda",
      ],
      ctaLabel: "Ke dasbor →",
      ctaUrl:   `${APP_URL}/id`,
      secondaryLabel: "Hubungkan Slack →",
      secondaryUrl:   `${APP_URL}/id/account`,
      closing:  "Tetap waspada,\nTim HealthWatch Global",
      trialNote: "Uji coba Pro 14 hari Anda sedang berjalan. Tidak ada tagihan hingga masa uji coba berakhir.",
    },
  },

  // ── Enterprise ─────────────────────────────────────────────────────────────
  enterprise: {
    fr: {
      subject:  "Bienvenue sur HealthWatch Enterprise 🏢",
      headline: "Votre plan Enterprise est actif.",
      intro:    "Accès complet + API REST pour intégrer les données dans vos outils. Voici ce qui est disponible :",
      features: [
        "🔑 API REST — accès programmatique aux données de foyers (300 req/min)",
        "📊 Toutes les fonctionnalités Pro — chiffres exacts, PDF, alertes, Slack",
        "🌍 Toutes les régions — couverture mondiale sans restriction",
        "🛠️ 5 clés API — gestion multi-environnements (prod, staging…)",
      ],
      ctaLabel: "Créer ma première clé API →",
      ctaUrl:   `${APP_URL}/fr/account`,
      secondaryLabel: "Lire la documentation →",
      secondaryUrl:   `${APP_URL}/fr/docs`,
      closing:  "Bonne surveillance,\nL'équipe HealthWatch Global",
    },
    en: {
      subject:  "Welcome to HealthWatch Enterprise 🏢",
      headline: "Your Enterprise plan is now active.",
      intro:    "Full access + REST API to integrate outbreak data into your own tools:",
      features: [
        "🔑 REST API — programmatic access to outbreak data (300 req/min)",
        "📊 All Pro features — exact figures, PDF reports, alerts, Slack",
        "🌍 All regions — worldwide coverage, no restrictions",
        "🛠️ 5 API keys — multi-environment management (prod, staging…)",
      ],
      ctaLabel: "Create my first API key →",
      ctaUrl:   `${APP_URL}/en/account`,
      secondaryLabel: "Read the API docs →",
      secondaryUrl:   `${APP_URL}/en/docs`,
      closing:  "Stay vigilant,\nThe HealthWatch Global team",
    },
    es: {
      subject:  "Bienvenido a HealthWatch Enterprise 🏢",
      headline: "Su plan Enterprise ya está activo.",
      intro:    "Acceso completo + API REST para integrar datos en sus propias herramientas:",
      features: [
        "🔑 API REST — acceso programático a datos de brotes (300 req/min)",
        "📊 Todas las funciones Pro — cifras exactas, PDF, alertas, Slack",
        "🌍 Todas las regiones — cobertura mundial sin restricciones",
        "🛠️ 5 claves API — gestión multi-entorno (prod, staging…)",
      ],
      ctaLabel: "Crear mi primera clave API →",
      ctaUrl:   `${APP_URL}/es/account`,
      secondaryLabel: "Leer la documentación →",
      secondaryUrl:   `${APP_URL}/es/docs`,
      closing:  "Permanezca alerta,\nEl equipo de HealthWatch Global",
    },
    ar: {
      subject:  "مرحباً بك في HealthWatch Enterprise 🏢",
      headline: "خطة Enterprise الخاصة بك نشطة الآن.",
      intro:    "وصول كامل + API REST لدمج البيانات في أدواتك الخاصة:",
      features: [
        "🔑 API REST — وصول برمجي لبيانات التفشيات (300 طلب/دقيقة)",
        "📊 جميع مزايا Pro — أرقام دقيقة، PDF، تنبيهات، Slack",
        "🌍 جميع المناطق — تغطية عالمية بلا قيود",
        "🛠️ 5 مفاتيح API — إدارة متعددة البيئات (إنتاج، تجريبي…)",
      ],
      ctaLabel: "← إنشاء أول مفتاح API",
      ctaUrl:   `${APP_URL}/ar/account`,
      secondaryLabel: "← قراءة التوثيق",
      secondaryUrl:   `${APP_URL}/ar/docs`,
      closing:  "ابقوا يقظين،\nفريق HealthWatch Global",
    },
    id: {
      subject:  "Selamat datang di HealthWatch Enterprise 🏢",
      headline: "Paket Enterprise Anda sekarang aktif.",
      intro:    "Akses penuh + REST API untuk mengintegrasikan data ke alat Anda sendiri:",
      features: [
        "🔑 REST API — akses programatik ke data wabah (300 req/mnt)",
        "📊 Semua fitur Pro — angka tepat, PDF, peringatan, Slack",
        "🌍 Semua wilayah — cakupan global tanpa batasan",
        "🛠️ 5 kunci API — manajemen multi-lingkungan (prod, staging…)",
      ],
      ctaLabel: "Buat kunci API pertama saya →",
      ctaUrl:   `${APP_URL}/id/account`,
      secondaryLabel: "Baca dokumentasi →",
      secondaryUrl:   `${APP_URL}/id/docs`,
      closing:  "Tetap waspada,\nTim HealthWatch Global",
    },
  },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, { badge: string; accent: string }> = {
  starter:    { badge: "#3b82f6", accent: "#60a5fa" },
  pro:        { badge: "#dc2626", accent: "#f87171" },
  enterprise: { badge: "#9333ea", accent: "#c084fc" },
};

export function buildUpgradeEmail(
  plan: "starter" | "pro" | "enterprise",
  locale: string
): { subject: string; html: string } {
  // "starter" no longer exists as a user-facing plan — redirect to pro template
  const effectivePlan = plan === "starter" ? "pro" : plan;
  const planCopy  = COPY[effectivePlan] ?? COPY.pro;
  const c         = planCopy[locale] ?? planCopy.en;
  const colors    = PLAN_COLORS[effectivePlan] ?? PLAN_COLORS.pro;
  const planLabel = effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1);
  const isRtl     = locale === "ar";

  const featureRows = c.features
    .map(
      (f) =>
        `<tr><td style="padding:6px 0;color:#d1d5db;font-size:14px;line-height:1.5">${f}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111827;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">

    <!-- Card -->
    <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;margin-bottom:16px">

      <!-- Plan badge -->
      <div style="display:inline-flex;align-items:center;gap:8px;background:${colors.badge}1a;border:1px solid ${colors.badge}4d;border-radius:999px;padding:6px 14px;margin-bottom:24px">
        <span style="color:${colors.accent};font-size:13px;font-weight:700;letter-spacing:.04em">${planLabel}</span>
      </div>

      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 12px;line-height:1.3">${c.headline}</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6">${c.intro}</p>

      <!-- Feature list -->
      <div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:20px;margin-bottom:28px">
        <table style="width:100%;border-collapse:collapse">
          <tbody>${featureRows}</tbody>
        </table>
      </div>

      ${c.trialNote ? `
      <!-- Trial note -->
      <div style="background:#92400e1a;border:1px solid #d9770640;border-radius:10px;padding:14px 16px;margin-bottom:24px">
        <p style="color:#fcd34d;font-size:13px;margin:0;line-height:1.5">⏳ ${c.trialNote}</p>
      </div>
      ` : ""}

      <!-- Primary CTA -->
      <a href="${c.ctaUrl}"
         style="display:block;background:${colors.badge};color:#ffffff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;text-align:center;margin-bottom:12px">
        ${c.ctaLabel}
      </a>

      ${c.secondaryLabel ? `
      <!-- Secondary CTA -->
      <a href="${c.secondaryUrl}"
         style="display:block;background:#374151;color:#d1d5db;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;text-decoration:none;text-align:center">
        ${c.secondaryLabel}
      </a>
      ` : ""}
    </div>

    <!-- Footer -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;white-space:pre-line;margin:0">
      ${c.closing}
    </p>
  </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
