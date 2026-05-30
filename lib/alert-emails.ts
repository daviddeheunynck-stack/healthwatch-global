// ─── Regional outbreak alert email ────────────────────────────────────────────
// Sent when a new outbreak is detected in a region the user subscribed to.

interface OutbreakData {
  disease: string;
  country: string;
  risk_level: "high" | "medium" | "low";
  date: string;
  cases?: number;
  deaths?: number;
}

const CONTENT: Record<string, {
  subject: (region: string, disease: string) => string;
  headline: (region: string) => string;
  intro: string;
  riskLabel: string;
  dateLabel: string;
  casesLabel: string;
  deathsLabel: string;
  ctaLabel: string;
  closing: string;
  unsubNote: string;
  riskLabels: Record<string, string>;
}> = {
  fr: {
    subject: (region, disease) =>
      `🚨 Nouveau foyer détecté en ${region} — ${disease}`,
    headline: (region) =>
      `Un nouveau foyer épidémique vient d'être signalé en ${region}.`,
    intro: "Voici les informations disponibles à ce stade :",
    riskLabel: "Niveau de risque",
    dateLabel: "Date",
    casesLabel: "Cas confirmés",
    deathsLabel: "Décès",
    ctaLabel: "Voir le tableau de bord →",
    closing: "Restez vigilants,\nL'équipe HealthWatch Global",
    unsubNote:
      "Vous recevez cet email car vous avez activé les alertes régionales dans votre compte HealthWatch Global. Gérez vos préférences dans votre compte.",
    riskLabels: { high: "Élevé 🔴", medium: "Modéré 🟡", low: "Faible 🟢" },
  },
  en: {
    subject: (region, disease) =>
      `🚨 New outbreak detected in ${region} — ${disease}`,
    headline: (region) =>
      `A new disease outbreak has just been reported in ${region}.`,
    intro: "Here is the information available at this stage:",
    riskLabel: "Risk level",
    dateLabel: "Date",
    casesLabel: "Confirmed cases",
    deathsLabel: "Deaths",
    ctaLabel: "View dashboard →",
    closing: "Stay vigilant,\nThe HealthWatch Global team",
    unsubNote:
      "You are receiving this email because you enabled regional alerts in your HealthWatch Global account. Manage your preferences from your account page.",
    riskLabels: { high: "High 🔴", medium: "Medium 🟡", low: "Low 🟢" },
  },
  es: {
    subject: (region, disease) =>
      `🚨 Nuevo brote detectado en ${region} — ${disease}`,
    headline: (region) =>
      `Se acaba de notificar un nuevo brote de enfermedad en ${region}.`,
    intro: "Esta es la información disponible en este momento:",
    riskLabel: "Nivel de riesgo",
    dateLabel: "Fecha",
    casesLabel: "Casos confirmados",
    deathsLabel: "Fallecidos",
    ctaLabel: "Ver panel →",
    closing: "Permanezca alerta,\nEl equipo de HealthWatch Global",
    unsubNote:
      "Recibes este correo porque activaste las alertas regionales en tu cuenta de HealthWatch Global. Gestiona tus preferencias desde tu perfil.",
    riskLabels: { high: "Alto 🔴", medium: "Moderado 🟡", low: "Bajo 🟢" },
  },
  ar: {
    subject: (region, disease) =>
      `🚨 تفشٍّ جديد رُصد في ${region} — ${disease}`,
    headline: (region) =>
      `تم الإبلاغ للتو عن تفشٍّ جديد في ${region}.`,
    intro: "فيما يلي المعلومات المتاحة في هذه المرحلة:",
    riskLabel: "مستوى الخطر",
    dateLabel: "التاريخ",
    casesLabel: "الحالات المؤكدة",
    deathsLabel: "الوفيات",
    ctaLabel: "← عرض لوحة التحكم",
    closing: "ابقوا يقظين،\nفريق HealthWatch Global",
    unsubNote:
      "تتلقى هذا البريد الإلكتروني لأنك فعّلت التنبيهات الإقليمية في حسابك على HealthWatch Global. يمكنك إدارة تفضيلاتك من صفحة حسابك.",
    riskLabels: { high: "مرتفع 🔴", medium: "متوسط 🟡", low: "منخفض 🟢" },
  },
  id: {
    subject: (region, disease) =>
      `🚨 Wabah baru terdeteksi di ${region} — ${disease}`,
    headline: (region) =>
      `Wabah penyakit baru baru saja dilaporkan di ${region}.`,
    intro: "Berikut informasi yang tersedia saat ini:",
    riskLabel: "Tingkat risiko",
    dateLabel: "Tanggal",
    casesLabel: "Kasus terkonfirmasi",
    deathsLabel: "Kematian",
    ctaLabel: "Lihat dasbor →",
    closing: "Tetap waspada,\nTim HealthWatch Global",
    unsubNote:
      "Anda menerima email ini karena Anda mengaktifkan peringatan regional di akun HealthWatch Global Anda. Kelola preferensi Anda dari halaman akun.",
    riskLabels: { high: "Tinggi 🔴", medium: "Sedang 🟡", low: "Rendah 🟢" },
  },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

export function buildOutbreakAlertEmail(
  locale: string,
  regionLabel: string,
  outbreak: OutbreakData,
  dashboardUrl: string
): { subject: string; html: string } {
  const c = CONTENT[locale] ?? CONTENT.en;

  const riskColor =
    outbreak.risk_level === "high"
      ? "#ef4444"
      : outbreak.risk_level === "medium"
      ? "#f59e0b"
      : "#22c55e";

  const rows = [
    `<tr><td style="color:#9ca3af;padding:6px 0;width:160px">${c.riskLabel}</td>
     <td style="color:${riskColor};font-weight:600">${c.riskLabels[outbreak.risk_level]}</td></tr>`,
    `<tr><td style="color:#9ca3af;padding:6px 0">${c.dateLabel}</td>
     <td style="color:#e5e7eb">${outbreak.date}</td></tr>`,
    ...(outbreak.cases !== undefined
      ? [`<tr><td style="color:#9ca3af;padding:6px 0">${c.casesLabel}</td>
         <td style="color:#e5e7eb">${outbreak.cases.toLocaleString()}</td></tr>`]
      : []),
    ...(outbreak.deaths !== undefined
      ? [`<tr><td style="color:#9ca3af;padding:6px 0">${c.deathsLabel}</td>
         <td style="color:#e5e7eb">${outbreak.deaths.toLocaleString()}</td></tr>`]
      : []),
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111827;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">

    <!-- Header -->
    <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <div style="width:40px;height:40px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px">🌍</div>
        <span style="color:#9ca3af;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase">HealthWatch Global</span>
      </div>

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px">${c.headline(regionLabel)}</h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">${c.intro}</p>

      <!-- Outbreak card -->
      <div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#ffffff;font-size:17px;font-weight:700;margin:0 0 4px">${outbreak.disease}</p>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 16px">${outbreak.country}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tbody>${rows}</tbody>
        </table>
      </div>

      <!-- CTA -->
      <a href="${dashboardUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">
        ${c.ctaLabel}
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;margin:0">
      ${c.unsubNote}
    </p>
  </div>
</body>
</html>`;

  return {
    subject: c.subject(regionLabel, outbreak.disease),
    html,
  };
}
