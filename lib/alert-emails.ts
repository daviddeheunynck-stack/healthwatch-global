// ─── Regional outbreak alert email ────────────────────────────────────────────
// Sent when a new outbreak is detected in a region the user subscribed to.

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface OutbreakData {
  disease: string;
  country: string;
  risk_level: "high" | "medium" | "low";
  date: string;
  cases?: number | null;
  deaths?: number | null;
}

const CONTENT: Record<string, {
  subject: (region: string, disease: string) => string;
  headline: (region: string) => string;
  subjectUpdate: (region: string, disease: string) => string;
  headlineUpdate: (region: string) => string;
  intro: string;
  riskLabel: string;
  dateLabel: string;
  casesLabel: string;
  deathsLabel: string;
  ctaLabel: string;
  closing: string;
  unsubNote: string;
  riskLabels: Record<string, string>;
  digestSubject: (count: number) => string;
  digestHeadline: (count: number) => string;
  newBadge: string;
  updateBadge: string;
  itemLinkLabel: string;
}> = {
  fr: {
    subject: (region, disease) =>
      `🚨 Foyer épidémique en ${region} — ${disease}`,
    headline: (region) =>
      `Un foyer épidémique a été signalé en ${region}.`,
    subjectUpdate: (region, disease) =>
      `⚠️ Mise à jour : ${disease} s'aggrave en ${region}`,
    headlineUpdate: (region) =>
      `Un foyer que vous suivez en ${region} vient de s'aggraver.`,
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
    digestSubject: (count) => `🚨 ${count} alertes de foyers épidémiques`,
    digestHeadline: (count) => `${count} foyers actifs dans vos régions suivies :`,
    newBadge: "Nouveau",
    updateBadge: "Mise à jour",
    itemLinkLabel: "Détails →",
  },
  en: {
    subject: (region, disease) =>
      `🚨 Outbreak alert in ${region} — ${disease}`,
    headline: (region) =>
      `A disease outbreak has been reported in ${region}.`,
    subjectUpdate: (region, disease) =>
      `⚠️ Update: ${disease} is worsening in ${region}`,
    headlineUpdate: (region) =>
      `An outbreak you're tracking in ${region} has just gotten worse.`,
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
    digestSubject: (count) => `🚨 ${count} outbreak alerts in your regions`,
    digestHeadline: (count) => `${count} active outbreaks in your tracked regions:`,
    newBadge: "New",
    updateBadge: "Update",
    itemLinkLabel: "Details →",
  },
  es: {
    subject: (region, disease) =>
      `🚨 Alerta de brote en ${region} — ${disease}`,
    headline: (region) =>
      `Se ha notificado un brote de enfermedad en ${region}.`,
    subjectUpdate: (region, disease) =>
      `⚠️ Actualización: ${disease} empeora en ${region}`,
    headlineUpdate: (region) =>
      `Un brote que estás siguiendo en ${region} acaba de empeorar.`,
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
    digestSubject: (count) => `🚨 ${count} alertas de brotes en tus regiones`,
    digestHeadline: (count) => `${count} brotes activos en tus regiones seguidas:`,
    newBadge: "Nuevo",
    updateBadge: "Actualización",
    itemLinkLabel: "Detalles →",
  },
  ar: {
    subject: (region, disease) =>
      `🚨 تنبيه تفشٍّ في ${region} — ${disease}`,
    headline: (region) =>
      `تم الإبلاغ عن تفشٍّ في ${region}.`,
    subjectUpdate: (region, disease) =>
      `⚠️ تحديث: تفاقم ${disease} في ${region}`,
    headlineUpdate: (region) =>
      `تفشٍّ تتابعه في ${region} تفاقم للتو.`,
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
    digestSubject: (count) => `🚨 ${count} تنبيهات تفشٍّ في مناطقك`,
    digestHeadline: (count) => `${count} حالات تفشٍّ نشطة في مناطقك المتابَعة:`,
    newBadge: "جديد",
    updateBadge: "تحديث",
    itemLinkLabel: "← التفاصيل",
  },
  id: {
    subject: (region, disease) =>
      `🚨 Peringatan wabah di ${region} — ${disease}`,
    headline: (region) =>
      `Wabah penyakit telah dilaporkan di ${region}.`,
    subjectUpdate: (region, disease) =>
      `⚠️ Pembaruan: ${disease} memburuk di ${region}`,
    headlineUpdate: (region) =>
      `Wabah yang Anda pantau di ${region} baru saja memburuk.`,
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
    digestSubject: (count) => `🚨 ${count} peringatan wabah di wilayah Anda`,
    digestHeadline: (count) => `${count} wabah aktif di wilayah yang Anda pantau:`,
    newBadge: "Baru",
    updateBadge: "Pembaruan",
    itemLinkLabel: "Detail →",
  },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

export function buildOutbreakAlertEmail(
  locale: string,
  regionLabel: string,
  outbreak: OutbreakData,
  dashboardUrl: string,
  outbreakUrl?: string,
  unsubUrl?: string,
  kind: "new" | "update" = "new"
): { subject: string; html: string } {
  const c = CONTENT[locale] ?? CONTENT.en;
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");

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
    ...(outbreak.cases != null
      ? [`<tr><td style="color:#9ca3af;padding:6px 0">${c.casesLabel}</td>
         <td style="color:#e5e7eb">${outbreak.cases.toLocaleString(numLocale)}</td></tr>`]
      : []),
    ...(outbreak.deaths != null
      ? [`<tr><td style="color:#9ca3af;padding:6px 0">${c.deathsLabel}</td>
         <td style="color:#e5e7eb">${outbreak.deaths.toLocaleString(numLocale)}</td></tr>`]
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

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px">${kind === "new" ? c.headline(regionLabel) : c.headlineUpdate(regionLabel)}</h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">${c.intro}</p>

      <!-- Outbreak card -->
      <div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#ffffff;font-size:17px;font-weight:700;margin:0 0 4px">${esc(outbreak.disease)}</p>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 16px">${esc(outbreak.country)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tbody>${rows}</tbody>
        </table>
      </div>

      <!-- CTA -->
      <a href="${outbreakUrl ?? dashboardUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">
        ${c.ctaLabel}
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;margin:0">
      ${c.unsubNote}${unsubUrl ? ` <a href="${unsubUrl}" style="color:#4b5563;text-decoration:underline">${locale === "fr" ? "Gérer mes alertes" : locale === "es" ? "Gestionar alertas" : locale === "ar" ? "إدارة التنبيهات" : locale === "id" ? "Kelola peringatan" : "Manage alerts"}</a>` : ""}
    </p>
  </div>
</body>
</html>`;

  return {
    subject: kind === "new" ? c.subject(regionLabel, outbreak.disease) : c.subjectUpdate(regionLabel, outbreak.disease),
    html,
  };
}

// ─── Digest email (multiple outbreaks in one send) ────────────────────────────
// Sent instead of buildOutbreakAlertEmail whenever more than one outbreak
// qualifies for the same user in the same cron run — a single new signup can
// match every outbreak the daily sync just touched across all 5 regions
// (measured up to 97 in one run), and firing that many individual emails is
// what drove at least one real trial user to unsubscribe within 36h. One
// email per user per run, listing every qualifying outbreak, instead of one
// email per (user, outbreak) pair.

export interface DigestItem {
  regionLabel: string;
  disease: string;
  country: string;
  risk_level: "high" | "medium" | "low";
  date: string;
  cases?: number | null;
  deaths?: number | null;
  outbreakUrl: string;
  reason: "new" | "escalated" | "surge";
}

export function buildOutbreakDigestEmail(
  locale: string,
  items: DigestItem[],
  dashboardUrl: string,
  unsubUrl?: string
): { subject: string; html: string } {
  const c = CONTENT[locale] ?? CONTENT.en;
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");

  const cards = items
    .map((item) => {
      const riskColor =
        item.risk_level === "high" ? "#ef4444" : item.risk_level === "medium" ? "#f59e0b" : "#22c55e";
      const badgeLabel = item.reason === "new" ? c.newBadge : c.updateBadge;
      const badgeColor = item.reason === "new" ? "#dc2626" : "#f59e0b";
      const meta = [
        `${c.riskLabel}: ${c.riskLabels[item.risk_level]}`,
        `${c.dateLabel}: ${item.date}`,
        ...(item.cases != null ? [`${c.casesLabel}: ${item.cases.toLocaleString(numLocale)}`] : []),
        ...(item.deaths != null ? [`${c.deathsLabel}: ${item.deaths.toLocaleString(numLocale)}`] : []),
      ].join(" · ");

      return `<div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:16px 20px;margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
          <p style="color:#ffffff;font-size:15px;font-weight:700;margin:0">${esc(item.disease)}</p>
          <span style="color:${badgeColor};font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap">${badgeLabel}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 8px">${esc(item.country)} · ${esc(item.regionLabel)}</p>
        <p style="color:${riskColor};font-size:12px;margin:0 0 10px">${meta}</p>
        <a href="${item.outbreakUrl}" style="color:#f87171;font-size:13px;font-weight:600;text-decoration:none">${c.itemLinkLabel}</a>
      </div>`;
    })
    .join("");

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

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 24px">${c.digestHeadline(items.length)}</h1>

      ${cards}

      <!-- CTA -->
      <a href="${dashboardUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:4px">
        ${c.ctaLabel}
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;margin:0">
      ${c.unsubNote}${unsubUrl ? ` <a href="${unsubUrl}" style="color:#4b5563;text-decoration:underline">${locale === "fr" ? "Gérer mes alertes" : locale === "es" ? "Gestionar alertas" : locale === "ar" ? "إدارة التنبيهات" : locale === "id" ? "Kelola peringatan" : "Manage alerts"}</a>` : ""}
    </p>
  </div>
</body>
</html>`;

  return { subject: c.digestSubject(items.length), html };
}
