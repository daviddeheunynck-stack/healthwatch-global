// Disease-specific alert email — sent when a tracked pathogen is detected anywhere

const APP_URL = "https://healthwatch-global.com";

const COPY: Record<string, {
  subject:    (disease: string) => string;
  headline:   (disease: string, country: string) => string;
  intro:      string;
  cases:      string;
  deaths:     string;
  cfr:        string;
  date:       string;
  source:     string;
  cta:        string;
  noData:     string;
  corroborated: string;
  unsubNote:  string;
}> = {
  fr: {
    subject:      (d) => `🔴 Alerte maladie : ${d} détecté`,
    headline:     (d, c) => `${d} — ${c}`,
    intro:        "Un foyer a été détecté pour une maladie que vous surveillez.",
    cases:        "Cas confirmés",
    deaths:       "Décès",
    cfr:          "Taux de létalité",
    date:         "Date du rapport",
    source:       "Source OMS",
    cta:          "Voir le tableau de bord →",
    noData:       "N/D",
    corroborated: "✓ Confirmé par WHO + ProMED",
    unsubNote:    "Vous recevez cet email car vous surveillez cette maladie sur healthwatch-global.com.",
  },
  en: {
    subject:      (d) => `🔴 Disease alert: ${d} detected`,
    headline:     (d, c) => `${d} — ${c}`,
    intro:        "An outbreak was detected for a disease you are monitoring.",
    cases:        "Confirmed cases",
    deaths:       "Deaths",
    cfr:          "Case fatality rate",
    date:         "Report date",
    source:       "WHO source",
    cta:          "View dashboard →",
    noData:       "N/A",
    corroborated: "✓ Confirmed by WHO + ProMED",
    unsubNote:    "You receive this email because you're monitoring this disease on healthwatch-global.com.",
  },
  es: {
    subject:      (d) => `🔴 Alerta de enfermedad: ${d} detectado`,
    headline:     (d, c) => `${d} — ${c}`,
    intro:        "Se detectó un brote de una enfermedad que está monitoreando.",
    cases:        "Casos confirmados",
    deaths:       "Fallecidos",
    cfr:          "Tasa de letalidad",
    date:         "Fecha del informe",
    source:       "Fuente OMS",
    cta:          "Ver el panel →",
    noData:       "N/D",
    corroborated: "✓ Confirmado por WHO + ProMED",
    unsubNote:    "Recibe este correo porque monitorea esta enfermedad en healthwatch-global.com.",
  },
  ar: {
    subject:      (d) => `🔴 تنبيه مرض: تم اكتشاف ${d}`,
    headline:     (d, c) => `${d} — ${c}`,
    intro:        "تم اكتشاف تفشٍّ لمرض تراقبه.",
    cases:        "الحالات المؤكدة",
    deaths:       "الوفيات",
    cfr:          "معدل الوفيات",
    date:         "تاريخ التقرير",
    source:       "مصدر OMS",
    cta:          "← عرض لوحة التحكم",
    noData:       "غ/م",
    corroborated: "✓ مؤكد من WHO + ProMED",
    unsubNote:    "تتلقى هذا البريد لأنك تراقب هذا المرض على healthwatch-global.com.",
  },
  id: {
    subject:      (d) => `🔴 Peringatan penyakit: ${d} terdeteksi`,
    headline:     (d, c) => `${d} — ${c}`,
    intro:        "Wabah terdeteksi untuk penyakit yang Anda pantau.",
    cases:        "Kasus terkonfirmasi",
    deaths:       "Kematian",
    cfr:          "Tingkat kematian kasus",
    date:         "Tanggal laporan",
    source:       "Sumber WHO",
    cta:          "Lihat dasbor →",
    noData:       "T/S",
    corroborated: "✓ Dikonfirmasi oleh WHO + ProMED",
    unsubNote:    "Anda menerima email ini karena memantau penyakit ini di healthwatch-global.com.",
  },
};

export interface DiseaseAlertOutbreak {
  id:           string;
  disease_en:   string;
  disease:      string;  // localized
  country_en:   string;
  country:      string;  // localized
  cases:        number;
  deaths:       number;
  risk_level:   string;
  date:         string;
  source:       string;
  corroborated: boolean;
}

export function buildDiseaseAlertEmail(
  outbreak: DiseaseAlertOutbreak,
  locale: string,
  subscriptionId: string
): { subject: string; html: string } {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const dir   = isRtl ? "rtl" : "ltr";

  const hasData    = outbreak.cases > 0;
  const cfr        = hasData ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) + "%" : c.noData;
  const unsubUrl   = `${APP_URL}/api/unsubscribe?id=${encodeURIComponent(subscriptionId)}&locale=${locale}`;
  const dashUrl    = `${APP_URL}/${locale}`;

  const RISK_COLOR: Record<string, string> = {
    high:   "#dc2626",
    medium: "#d97706",
    low:    "#16a34a",
  };
  const riskColor = RISK_COLOR[outbreak.risk_level] ?? "#6b7280";

  const subject = c.subject(outbreak.disease || outbreak.disease_en);

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#dc2626;border-radius:12px 12px 0 0;padding:20px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="color:white;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;opacity:.8;">HealthWatch Global · Disease Alert</td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#1e293b;border-radius:0 0 12px 12px;padding:28px;">

    <!-- Disease + country headline -->
    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:white;line-height:1.3;">
      ${c.headline(outbreak.disease || outbreak.disease_en, outbreak.country || outbreak.country_en)}
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;">${c.intro}</p>

    <!-- Risk badge -->
    <div style="display:inline-block;background:${riskColor}20;border:1px solid ${riskColor}50;border-radius:999px;padding:4px 12px;margin-bottom:20px;">
      <span style="color:${riskColor};font-size:12px;font-weight:700;text-transform:uppercase;">${outbreak.risk_level.toUpperCase()}</span>
    </div>

    ${outbreak.corroborated ? `
    <div style="background:#1e3a5f;border:1px solid #1d4ed8;border-radius:8px;padding:10px 14px;margin-bottom:20px;">
      <span style="color:#93c5fd;font-size:12px;">${c.corroborated}</span>
    </div>` : ""}

    <!-- Stats row -->
    <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:20px;">
      <tr>
        <td width="33%" style="background:#0f172a;border-radius:8px;padding:14px;text-align:center;">
          <div style="color:#60a5fa;font-size:11px;margin-bottom:6px;">${c.cases}</div>
          <div style="color:white;font-size:20px;font-weight:800;">${hasData ? outbreak.cases.toLocaleString() : c.noData}</div>
        </td>
        <td width="33%" style="background:#0f172a;border-radius:8px;padding:14px;text-align:center;">
          <div style="color:#f87171;font-size:11px;margin-bottom:6px;">${c.deaths}</div>
          <div style="color:#f87171;font-size:20px;font-weight:800;">${hasData ? outbreak.deaths.toLocaleString() : c.noData}</div>
        </td>
        <td width="33%" style="background:#0f172a;border-radius:8px;padding:14px;text-align:center;">
          <div style="color:#fbbf24;font-size:11px;margin-bottom:6px;">${c.cfr}</div>
          <div style="color:#fbbf24;font-size:20px;font-weight:800;">${cfr}</div>
        </td>
      </tr>
    </table>

    <!-- Date + Source -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="color:#64748b;font-size:12px;padding:4px 0;">${c.date} : <span style="color:#94a3b8;">${outbreak.date}</span></td>
      </tr>
      ${outbreak.source ? `<tr><td style="color:#64748b;font-size:12px;padding:4px 0;">${c.source} : <a href="${outbreak.source}" style="color:#ef4444;">${outbreak.source.replace("https://", "")}</a></td></tr>` : ""}
    </table>

    <!-- CTA -->
    <a href="${dashUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">${c.cta}</a>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 0;text-align:center;">
    <p style="color:#475569;font-size:11px;margin:0 0 8px;">${c.unsubNote}</p>
    <a href="${unsubUrl}" style="color:#475569;font-size:11px;">Unsubscribe</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}
