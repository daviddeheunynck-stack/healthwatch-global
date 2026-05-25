import type { Outbreak } from "./outbreaks";

const RISK_COLORS = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

const LABELS: Record<string, Record<string, string>> = {
  fr: {
    subject: "Votre briefing épidémiologique hebdomadaire",
    title: "Briefing Épidémiologique",
    subtitle: "Synthèse de la semaine",
    region: "Région surveillée",
    noOutbreaks: "Aucun foyer actif signalé dans votre région cette semaine. Bonne nouvelle !",
    cases: "Cas", deaths: "Décès", risk: "Risque",
    disease: "Maladie", country: "Pays",
    active: "actif(s)",
    high: "Élevé", medium: "Moyen", low: "Faible",
    cta: "Voir le tableau de bord complet →",
    unsubscribe: "Se désabonner",
    sources: "Sources : OMS · CDC · ECDC · ProMED",
  },
  en: {
    subject: "Your weekly epidemiological briefing",
    title: "Epidemiological Briefing",
    subtitle: "Weekly summary",
    region: "Monitored region",
    noOutbreaks: "No active outbreaks reported in your region this week. Good news!",
    cases: "Cases", deaths: "Deaths", risk: "Risk",
    disease: "Disease", country: "Country",
    active: "active",
    high: "High", medium: "Medium", low: "Low",
    cta: "View full dashboard →",
    unsubscribe: "Unsubscribe",
    sources: "Sources: WHO · CDC · ECDC · ProMED",
  },
  es: {
    subject: "Su informe epidemiológico semanal",
    title: "Informe Epidemiológico",
    subtitle: "Resumen semanal",
    region: "Región monitoreada",
    noOutbreaks: "No se han reportado brotes activos en su región esta semana. ¡Buenas noticias!",
    cases: "Casos", deaths: "Muertes", risk: "Riesgo",
    disease: "Enfermedad", country: "País",
    active: "activo(s)",
    high: "Alto", medium: "Medio", low: "Bajo",
    cta: "Ver el panel completo →",
    unsubscribe: "Cancelar suscripción",
    sources: "Fuentes: OMS · CDC · ECDC · ProMED",
  },
  ar: {
    subject: "ملخصك الوبائي الأسبوعي",
    title: "الملخص الوبائي",
    subtitle: "ملخص الأسبوع",
    region: "المنطقة المراقبة",
    noOutbreaks: "لم يتم الإبلاغ عن أي تفشيات نشطة في منطقتك هذا الأسبوع. أخبار جيدة!",
    cases: "الحالات", deaths: "الوفيات", risk: "الخطر",
    disease: "المرض", country: "البلد",
    active: "نشط",
    high: "عالي", medium: "متوسط", low: "منخفض",
    cta: "← عرض لوحة التحكم الكاملة",
    unsubscribe: "إلغاء الاشتراك",
    sources: "المصادر: OMS · CDC · ECDC · ProMED",
  },
  id: {
    subject: "Briefing epidemiologi mingguan Anda",
    title: "Briefing Epidemiologi",
    subtitle: "Ringkasan mingguan",
    region: "Wilayah dipantau",
    noOutbreaks: "Tidak ada wabah aktif dilaporkan di wilayah Anda minggu ini. Kabar baik!",
    cases: "Kasus", deaths: "Kematian", risk: "Risiko",
    disease: "Penyakit", country: "Negara",
    active: "aktif",
    high: "Tinggi", medium: "Sedang", low: "Rendah",
    cta: "Lihat dasbor lengkap →",
    unsubscribe: "Berhenti berlangganan",
    sources: "Sumber: WHO · CDC · ECDC · ProMED",
  },
};

const REGION_LABELS: Record<string, Record<string, string>> = {
  fr: { allRegions: "Toutes les régions", africa: "Afrique", asia: "Asie", europe: "Europe", americas: "Amériques", oceania: "Océanie" },
  en: { allRegions: "All regions", africa: "Africa", asia: "Asia", europe: "Europe", americas: "Americas", oceania: "Oceania" },
  es: { allRegions: "Todas las regiones", africa: "África", asia: "Asia", europe: "Europa", americas: "Américas", oceania: "Oceanía" },
  ar: { allRegions: "جميع المناطق", africa: "أفريقيا", asia: "آسيا", europe: "أوروبا", americas: "الأمريكتان", oceania: "أوقيانوسيا" },
  id: { allRegions: "Semua wilayah", africa: "Afrika", asia: "Asia", europe: "Eropa", americas: "Amerika", oceania: "Oseania" },
};

function getLocalizedName(outbreak: Outbreak, locale: string, field: "disease" | "country"): string {
  if (field === "disease") {
    if (locale === "ar") return outbreak.disease_ar || outbreak.disease;
    if (locale !== "fr") return outbreak.disease_en || outbreak.disease;
    return outbreak.disease;
  }
  if (locale === "ar") return outbreak.country_ar || outbreak.country;
  if (locale !== "fr") return outbreak.country_en || outbreak.country;
  return outbreak.country;
}

export function buildDigestEmail(
  outbreaks: Outbreak[],
  region: string,
  locale: string,
  subscriptionId?: string
): { subject: string; html: string } {
  const l = LABELS[locale] || LABELS.fr;
  const regionLabel = REGION_LABELS[locale]?.[region] || region;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const weekStr = new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const unsubUrl = subscriptionId
    ? `https://healthwatch-global.com/api/unsubscribe?id=${encodeURIComponent(subscriptionId)}&locale=${locale}`
    : null;

  const outbreakRows = outbreaks.length === 0
    ? `<p style="color:#94a3b8;padding:20px 0;text-align:center;">${l.noOutbreaks}</p>`
    : outbreaks
        .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk_level] - { high: 0, medium: 1, low: 2 }[b.risk_level]))
        .map((o) => {
          const color = RISK_COLORS[o.risk_level] || "#6b7280";
          const riskLabel = l[o.risk_level as "high" | "medium" | "low"] || o.risk_level;
          const disease = getLocalizedName(o, locale, "disease");
          const country = getLocalizedName(o, locale, "country");
          return `
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:12px 8px;color:#f1f5f9;font-weight:600;">${disease}</td>
              <td style="padding:12px 8px;color:#94a3b8;">${country}</td>
              <td style="padding:12px 8px;color:#e2e8f0;">${o.cases.toLocaleString()}</td>
              <td style="padding:12px 8px;color:#fca5a5;">${o.deaths.toLocaleString()}</td>
              <td style="padding:12px 8px;">
                <span style="background:${color}22;color:${color};border:1px solid ${color}44;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:600;">
                  ${riskLabel}
                </span>
              </td>
            </tr>`;
        }).join("");

  const html = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px;direction:${dir};">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

    <!-- Header -->
    <div style="background:#dc2626;padding:28px 32px;">
      <h1 style="margin:0;font-size:20px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
      <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">${l.title} — ${l.subtitle}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${weekStr}</p>
      <h2 style="margin:0 0 4px;font-size:22px;color:#f1f5f9;">${l.title}</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
        ${l.region} : <strong style="color:#e2e8f0;">${regionLabel}</strong>
        &nbsp;·&nbsp; ${outbreaks.length} ${l.active}
      </p>

      ${outbreaks.length > 0 ? `
      <!-- Table -->
      <div style="overflow-x:auto;border-radius:10px;border:1px solid #334155;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#0f172a;">
          <thead>
            <tr style="background:#1e293b;">
              <th style="padding:10px 8px;text-align:${dir === "rtl" ? "right" : "left"};color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;">${l.disease}</th>
              <th style="padding:10px 8px;text-align:${dir === "rtl" ? "right" : "left"};color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;">${l.country}</th>
              <th style="padding:10px 8px;text-align:${dir === "rtl" ? "right" : "left"};color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;">${l.cases}</th>
              <th style="padding:10px 8px;text-align:${dir === "rtl" ? "right" : "left"};color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;">${l.deaths}</th>
              <th style="padding:10px 8px;text-align:${dir === "rtl" ? "right" : "left"};color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;">${l.risk}</th>
            </tr>
          </thead>
          <tbody>${outbreakRows}</tbody>
        </table>
      </div>
      ` : `<p style="color:#94a3b8;padding:20px 0;text-align:center;">${l.noOutbreaks}</p>`}

      <!-- CTA -->
      <div style="margin-top:28px;text-align:center;">
        <a href="https://healthwatch-global.com"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:14px;">
          ${l.cta}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 4px;font-size:11px;color:#475569;">${l.sources}</p>
      <p style="margin:0;font-size:11px;color:#475569;">
        ${unsubUrl
          ? `<a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">${l.unsubscribe}</a>`
          : l.unsubscribe
        }
      </p>
    </div>

  </div>
</body>
</html>`;

  return { subject: l.subject, html };
}
