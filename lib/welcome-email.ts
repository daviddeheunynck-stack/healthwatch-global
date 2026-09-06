const CONTENT: Record<string, {
  subject: string;
  greeting: string;
  intro: string;
  feature1Title: string; feature1Body: string;
  feature2Title: string; feature2Body: string;
  feature3Title: string; feature3Body: string;
  cta: string;
  alertsCta: string;
  upgrade: string;
  upgradeLink: string;
  closing: string;
  team: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "Bienvenue sur HealthWatch Global",
    greeting: "Bienvenue,",
    intro: "Votre compte HealthWatch Global est créé. Vous avez maintenant accès à la surveillance épidémique mondiale quotidienne.",
    feature1Title: "🗺️ Carte mondiale interactive",
    feature1Body: "Visualisez les foyers actifs sur une carte mise à jour toutes les heures, filtrés par région et niveau de risque.",
    feature2Title: "📊 Tableau de bord actualisé toutes les heures",
    feature2Body: "Données agrégées de l'OMS, l'ECDC, l'OPAS et l'Africa CDC — mises à jour toutes les heures.",
    feature3Title: "🔔 Configurez vos alertes régionales",
    feature3Body: "Définissez vos priorités de maladies et votre zone géographique pour recevoir des alertes ciblées dès qu'un foyer préoccupant apparaît dans votre région.",
    cta: "Accéder au tableau de bord →",
    alertsCta: "Configurer mes alertes →",
    upgrade: "✅ Votre essai Pro de 7 jours est déjà actif. Chiffres exacts, alertes régionales et prédictives, export CSV et rapports PDF — tout inclus pendant 7 jours.",
    upgradeLink: "Voir toutes les fonctionnalités →",
    closing: "Bonne surveillance,",
    team: "L'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous venez de créer un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "Welcome to HealthWatch Global",
    greeting: "Welcome,",
    intro: "Your HealthWatch Global account is ready. You now have access to daily global epidemic surveillance.",
    feature1Title: "🗺️ Interactive world map",
    feature1Body: "Visualise active outbreaks on a map updated every hour, filtered by region and risk level.",
    feature2Title: "📊 Dashboard updated every hour",
    feature2Body: "Data aggregated from WHO, ECDC, PAHO and Africa CDC — updated every hour.",
    feature3Title: "🔔 Configure your regional alerts",
    feature3Body: "Set your disease priorities and geographic focus to receive targeted alerts when an outbreak of concern emerges in your region.",
    cta: "Go to dashboard →",
    alertsCta: "Configure my alerts →",
    upgrade: "✅ Your 7-day Pro trial is already active. Exact figures, regional and predictive alerts, CSV export and PDF reports — all included for 7 days.",
    upgradeLink: "See all features →",
    closing: "Stay safe,",
    team: "The HealthWatch Global Team",
    unsubNote: "You're receiving this email because you just created an account on healthwatch-global.com.",
  },
  es: {
    subject: "Bienvenido a HealthWatch Global",
    greeting: "Bienvenido,",
    intro: "Su cuenta de HealthWatch Global está lista. Ahora tiene acceso a la vigilancia epidémica mundial diaria.",
    feature1Title: "🗺️ Mapa mundial interactivo",
    feature1Body: "Visualice brotes activos en un mapa actualizado cada hora, filtrados por región y nivel de riesgo.",
    feature2Title: "📊 Panel actualizado cada hora",
    feature2Body: "Datos agregados de la OMS, ECDC, PAHO y Africa CDC — actualizados cada hora.",
    feature3Title: "🔔 Configure sus alertas regionales",
    feature3Body: "Defina sus prioridades de enfermedades y zona geográfica para recibir alertas precisas cuando surja un brote relevante en su región.",
    cta: "Ir al panel →",
    alertsCta: "Configurar mis alertas →",
    upgrade: "✅ Su prueba Pro de 7 días ya está activa. Cifras exactas, alertas regionales y predictivas, exportación CSV e informes PDF — todo incluido durante 7 días.",
    upgradeLink: "Ver todas las funciones →",
    closing: "Cuídese,",
    team: "El equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque acaba de crear una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "مرحباً بك في HealthWatch Global",
    greeting: "أهلاً وسهلاً،",
    intro: "حسابك في HealthWatch Global جاهز. يمكنك الآن الوصول إلى مراقبة الأوبئة العالمية اليومية.",
    feature1Title: "🗺️ خريطة العالم التفاعلية",
    feature1Body: "تصور تفشيات الأمراض النشطة على خريطة محدّثة كل ساعة، مصفّاة حسب المنطقة ومستوى الخطر.",
    feature2Title: "📊 لوحة تحكم محدّثة كل ساعة",
    feature2Body: "بيانات مجمّعة من WHO وECDC وPAHO وAfrica CDC — تُحدَّث كل ساعة.",
    feature3Title: "🔔 إعداد تنبيهاتك الإقليمية",
    feature3Body: "حدد أولوياتك من الأمراض ومنطقتك الجغرافية لتلقي تنبيهات فورية عند ظهور تفشٍّ مقلق في منطقتك.",
    cta: "← الذهاب إلى لوحة التحكم",
    alertsCta: "← إعداد التنبيهات",
    upgrade: "✅ تجربتك المجانية Pro لمدة 7 أيام نشطة الآن. أرقام دقيقة، تنبيهات إقليمية وتنبؤية، تصدير CSV وتقارير PDF — كل شيء مشمول لمدة 7 أيام.",
    upgradeLink: "← استعراض جميع الميزات",
    closing: "مع السلامة،",
    team: "فريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد الإلكتروني لأنك أنشأت للتو حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "Selamat datang di HealthWatch Global",
    greeting: "Selamat datang,",
    intro: "Akun HealthWatch Global Anda siap. Anda sekarang memiliki akses ke pemantauan epidemi global harian.",
    feature1Title: "🗺️ Peta dunia interaktif",
    feature1Body: "Visualisasikan wabah aktif di peta yang diperbarui setiap jam, difilter berdasarkan wilayah dan tingkat risiko.",
    feature2Title: "📊 Dasbor diperbarui setiap jam",
    feature2Body: "Data diagregasi dari WHO, ECDC, PAHO dan Africa CDC — diperbarui setiap jam.",
    feature3Title: "🔔 Konfigurasi peringatan regional Anda",
    feature3Body: "Tetapkan prioritas penyakit dan fokus geografis untuk menerima peringatan yang ditargetkan saat wabah muncul di wilayah Anda.",
    cta: "Buka dasbor →",
    alertsCta: "Konfigurasi peringatan →",
    upgrade: "✅ Uji coba Pro 7 hari Anda sudah aktif. Angka tepat, peringatan regional dan prediktif, ekspor CSV dan laporan PDF — semua termasuk selama 7 hari.",
    upgradeLink: "Lihat semua fitur →",
    closing: "Jaga kesehatan,",
    team: "Tim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena baru saja membuat akun di healthwatch-global.com.",
  },
};

export function buildWelcomeEmail(locale: string): { subject: string; html: string } {
  const c = CONTENT[locale] ?? CONTENT.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const dashboardUrl = `https://healthwatch-global.com/${locale}`;
  const pricingUrl = `https://healthwatch-global.com/${locale}/pricing`;

  const alertsUrl = `https://healthwatch-global.com/${locale}/account#regional-alerts`;

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px;direction:${dir};">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

    <!-- Header -->
    <div style="background:#dc2626;padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
      <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">Global Epidemic Surveillance</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">
      <p style="font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 8px;">${c.greeting}</p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 32px;">${c.intro}</p>

      <!-- Features -->
      <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:32px;">

        <div style="background:#0f172a;border-radius:12px;padding:18px 20px;border-left:3px solid #dc2626;">
          <p style="margin:0 0 4px;font-weight:700;color:#f1f5f9;font-size:14px;">${c.feature1Title}</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">${c.feature1Body}</p>
        </div>

        <div style="background:#0f172a;border-radius:12px;padding:18px 20px;border-left:3px solid #f59e0b;">
          <p style="margin:0 0 4px;font-weight:700;color:#f1f5f9;font-size:14px;">${c.feature2Title}</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">${c.feature2Body}</p>
        </div>

        <div style="background:#0f172a;border-radius:12px;padding:18px 20px;border-left:3px solid #22c55e;">
          <p style="margin:0 0 4px;font-weight:700;color:#f1f5f9;font-size:14px;">${c.feature3Title}</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">${c.feature3Body}</p>
        </div>

      </div>

      <!-- CTA -->
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:28px;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 24px;border-radius:8px;font-weight:700;font-size:14px;">
          ${c.cta}
        </a>
        <a href="${alertsUrl}"
           style="display:inline-block;background:#1e293b;color:#f59e0b;text-decoration:none;
                  padding:14px 24px;border-radius:8px;font-weight:700;font-size:14px;
                  border:1px solid #f59e0b44;">
          ${c.alertsCta}
        </a>
      </div>

      <!-- Upgrade nudge -->
      <div style="background:#1e3a5f;border:1px solid #2563eb44;border-radius:10px;padding:16px 20px;text-align:center;">
        <p style="margin:0 0 8px;color:#93c5fd;font-size:13px;line-height:1.6;">${c.upgrade}</p>
        <a href="${pricingUrl}" style="color:#60a5fa;font-size:13px;font-weight:600;text-decoration:none;">${c.upgradeLink}</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 2px;font-size:13px;color:#e2e8f0;">${c.closing}</p>
      <p style="margin:0 0 12px;font-size:13px;color:#e2e8f0;font-weight:600;">${c.team}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote}</p>
    </div>

  </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
