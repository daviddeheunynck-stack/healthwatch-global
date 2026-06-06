// ─── J+3 : Nudge upgrade ──────────────────────────────────────────────────────

const J3_CONTENT: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  lockedTitle: string;
  lockedItems: string[];
  ctaLabel: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "3 jours avec HealthWatch — voici ce qui est déverrouillé 🔓",
    headline: "Vous explorez HealthWatch depuis 3 jours.",
    intro: "Vous avez accès à la carte mondiale et au tableau de bord. Voici ce que les équipes Pro voient en plus — et qui change tout pour la prise de décision terrain.",
    lockedTitle: "Fonctionnalités réservées aux plans payants",
    lockedItems: [
      "📊 Chiffres exacts — cas confirmés et décès par foyer",
      "📬 Alertes email régionales — dès qu'un foyer est détecté dans vos zones",
      "📄 Rapports PDF régionaux — téléchargeables en 1 clic",
      "📥 Export CSV — pour vos propres analyses et rapports internes",
      "💬 Intégration Slack / Teams — alertes directement dans votre canal (Pro)",
    ],
    ctaLabel: "Voir les formules →",
    closing: "Bonne surveillance,\nL'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "3 days with HealthWatch — here's what you're missing 🔓",
    headline: "You've been exploring HealthWatch for 3 days.",
    intro: "You have access to the world map and dashboard. Here's what Pro teams see on top — and what changes everything for field decision-making.",
    lockedTitle: "Features reserved for paid plans",
    lockedItems: [
      "📊 Exact figures — confirmed cases and deaths per outbreak",
      "📬 Regional email alerts — as soon as an outbreak is detected in your areas",
      "📄 Regional PDF reports — downloadable in 1 click",
      "📥 CSV export — for your own analysis and internal reporting",
      "💬 Slack / Teams integration — alerts straight to your channel (Pro)",
    ],
    ctaLabel: "See plans →",
    closing: "Stay safe,\nThe HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "3 días con HealthWatch — esto es lo que te falta 🔓",
    headline: "Lleva 3 días explorando HealthWatch.",
    intro: "Tiene acceso al mapa mundial y al panel. Esto es lo que ven los equipos Pro además — y que cambia todo para la toma de decisiones en campo.",
    lockedTitle: "Funcionalidades reservadas a planes de pago",
    lockedItems: [
      "📊 Cifras exactas — casos confirmados y fallecidos por brote",
      "📬 Alertas email regionales — al detectar un brote en sus zonas",
      "📄 Informes PDF regionales — descargables en 1 clic",
      "📥 Exportación CSV — para sus propios análisis e informes internos",
      "💬 Integración Slack / Teams — alertas directo a su canal (Pro)",
    ],
    ctaLabel: "Ver planes →",
    closing: "Cuídese,\nEl equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "3 أيام مع HealthWatch — إليك ما تفتقده 🔓",
    headline: "لقد أمضيت 3 أيام في استكشاف HealthWatch.",
    intro: "لديك وصول إلى الخريطة العالمية ولوحة التحكم. إليك ما تراه فرق Pro إضافةً — وما يُغيِّر كل شيء في اتخاذ القرار الميداني.",
    lockedTitle: "ميزات حصرية للخطط المدفوعة",
    lockedItems: [
      "📊 الأرقام الدقيقة — الحالات المؤكدة والوفيات لكل تفشٍّ",
      "📬 تنبيهات بريدية إقليمية — فور رصد تفشٍّ في مناطقك",
      "📄 تقارير PDF إقليمية — تُحمَّل بنقرة واحدة",
      "📥 تصدير CSV — لتحليلاتك وتقاريرك الداخلية",
      "💬 تكامل Slack / Teams — التنبيهات مباشرةً في قناتك (Pro)",
    ],
    ctaLabel: "← عرض الخطط",
    closing: "مع السلامة،\nفريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "3 hari dengan HealthWatch — inilah yang Anda lewatkan 🔓",
    headline: "Anda telah menjelajahi HealthWatch selama 3 hari.",
    intro: "Anda memiliki akses ke peta dunia dan dasbor. Inilah yang dilihat tim Pro di samping itu — dan yang mengubah segalanya untuk pengambilan keputusan lapangan.",
    lockedTitle: "Fitur khusus paket berbayar",
    lockedItems: [
      "📊 Angka tepat — kasus terkonfirmasi dan kematian per wabah",
      "📬 Peringatan email regional — segera saat wabah terdeteksi di wilayah Anda",
      "📄 Laporan PDF regional — diunduh dalam 1 klik",
      "📥 Ekspor CSV — untuk analisis dan laporan internal Anda",
      "💬 Integrasi Slack / Teams — peringatan langsung ke saluran Anda (Pro)",
    ],
    ctaLabel: "Lihat paket →",
    closing: "Jaga kesehatan,\nTim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

// ─── J+12 : Last call ─────────────────────────────────────────────────────────

const J12_CONTENT: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  questionLabel: string;
  question: string;
  urgencyText: string;
  ctaLabel: string;
  altText: string;
  altLink: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "12 jours avec HealthWatch — une question 👋",
    headline: "Vous utilisez HealthWatch depuis 12 jours.",
    intro: "La carte mondiale est active. Les données OMS arrivent chaque jour. Mais sans plan payant, vous voyez encore les chiffres floutés — et vous ne recevez pas les alertes en temps réel qui permettent d'anticiper.",
    questionLabel: "Notre question :",
    question: "Est-ce que les données que vous voyez ont déjà orienté une décision de votre équipe ?",
    urgencyText: "Si oui, vous méritez les données complètes. Cas confirmés, décès, rapports PDF, alertes instantanées — tout ce dont votre organisation a besoin pour ne jamais réagir trop tard.",
    ctaLabel: "Passer à Pro →",
    altText: "Ou parlez à notre équipe si vous avez des questions sur l'offre.",
    altLink: "Nous contacter →",
    closing: "Bonne surveillance,\nL'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "12 days with HealthWatch — a question 👋",
    headline: "You've been using HealthWatch for 12 days.",
    intro: "The world map is active. WHO data comes in every day. But without a paid plan, you still see blurred figures — and you don't receive the real-time alerts that help you stay ahead.",
    questionLabel: "Our question:",
    question: "Has the data you've seen already influenced a decision in your team?",
    urgencyText: "If so, you deserve the full data. Confirmed cases, deaths, PDF reports, instant alerts — everything your organization needs to never react too late.",
    ctaLabel: "Upgrade to Pro →",
    altText: "Or talk to our team if you have questions about the plans.",
    altLink: "Contact us →",
    closing: "Stay safe,\nThe HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "12 días con HealthWatch — una pregunta 👋",
    headline: "Lleva 12 días usando HealthWatch.",
    intro: "El mapa mundial está activo. Los datos de la OMS llegan cada día. Pero sin un plan de pago, todavía ve cifras borrosas — y no recibe las alertas en tiempo real que le permiten anticiparse.",
    questionLabel: "Nuestra pregunta:",
    question: "¿Los datos que ha visto ya han orientado alguna decisión de su equipo?",
    urgencyText: "Si es así, merece los datos completos. Casos confirmados, fallecidos, informes PDF, alertas instantáneas — todo lo que su organización necesita para no reaccionar demasiado tarde.",
    ctaLabel: "Actualizar a Pro →",
    altText: "O hable con nuestro equipo si tiene preguntas sobre los planes.",
    altLink: "Contactarnos →",
    closing: "Cuídese,\nEl equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "12 يوماً مع HealthWatch — سؤال 👋",
    headline: "لقد استخدمت HealthWatch منذ 12 يوماً.",
    intro: "الخريطة العالمية نشطة. تصل بيانات منظمة الصحة العالمية كل يوم. لكن بدون خطة مدفوعة، لا تزال ترى الأرقام مطموسة — ولا تتلقى التنبيهات الفورية التي تساعدك على التقدم.",
    questionLabel: "سؤالنا:",
    question: "هل أثّرت البيانات التي رأيتها بالفعل في قرار ما لفريقك؟",
    urgencyText: "إذا كان الأمر كذلك، فأنت تستحق البيانات الكاملة. الحالات المؤكدة، الوفيات، تقارير PDF، تنبيهات فورية — كل ما تحتاجه منظمتك حتى لا تتفاعل متأخراً أبداً.",
    ctaLabel: "← الترقية إلى Pro",
    altText: "أو تحدث إلى فريقنا إذا كان لديك أسئلة حول الخطط.",
    altLink: "← اتصل بنا",
    closing: "مع السلامة،\nفريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "12 hari dengan HealthWatch — sebuah pertanyaan 👋",
    headline: "Anda telah menggunakan HealthWatch selama 12 hari.",
    intro: "Peta dunia aktif. Data WHO masuk setiap hari. Namun tanpa paket berbayar, Anda masih melihat angka yang dikaburkan — dan tidak menerima peringatan real-time yang membantu Anda selalu selangkah lebih maju.",
    questionLabel: "Pertanyaan kami:",
    question: "Apakah data yang Anda lihat sudah mempengaruhi keputusan tim Anda?",
    urgencyText: "Jika iya, Anda layak mendapatkan data lengkap. Kasus terkonfirmasi, kematian, laporan PDF, peringatan instan — semua yang dibutuhkan organisasi Anda untuk tidak pernah bereaksi terlambat.",
    ctaLabel: "Upgrade ke Pro →",
    altText: "Atau bicara dengan tim kami jika ada pertanyaan tentang paket.",
    altLink: "Hubungi kami →",
    closing: "Jaga kesehatan,\nTim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

// ─── HTML builders ────────────────────────────────────────────────────────────

function emailShell(locale: string, body: string): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px;direction:${dir};">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    <div style="background:#dc2626;padding:24px 32px;">
      <h1 style="margin:0;font-size:20px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
    </div>
    ${body}
  </div>
</body>
</html>`;
}

export function buildJ3Email(locale: string): { subject: string; html: string } {
  const c = J3_CONTENT[locale] ?? J3_CONTENT.en;
  const pricingUrl = `https://healthwatch-global.com/${locale}/pricing`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">${c.intro}</p>

      <div style="background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:.05em;">${c.lockedTitle}</p>
        ${c.lockedItems.map((item) => `
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.5;">${item}</p>
        </div>`).join("")}
      </div>

      <div style="text-align:center;">
        <a href="${pricingUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;white-space:pre-line;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote}</p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body) };
}

export function buildJ12Email(locale: string): { subject: string; html: string } {
  const c = J12_CONTENT[locale] ?? J12_CONTENT.en;
  const pricingUrl = `https://healthwatch-global.com/${locale}/pricing`;
  const contactUrl = `https://healthwatch-global.com/${locale}/contact`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">${c.intro}</p>

      <div style="background:#1e3a5f;border:1px solid #2563eb44;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:.05em;">${c.questionLabel}</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#f1f5f9;line-height:1.5;font-style:italic;">"${c.question}"</p>
        <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">${c.urgencyText}</p>
      </div>

      <div style="text-align:center;margin-bottom:16px;">
        <a href="${pricingUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
      <div style="text-align:center;">
        <p style="margin:0 4px;font-size:13px;color:#64748b;">${c.altText}</p>
        <a href="${contactUrl}" style="color:#60a5fa;font-size:13px;font-weight:600;text-decoration:none;">${c.altLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;white-space:pre-line;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote}</p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body) };
}
