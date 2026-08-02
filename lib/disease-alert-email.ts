// Disease-specific alert email — sent when a tracked pathogen is detected anywhere

import { getResponseGuidance, RESPONSE_ACTIONS } from "./response-guidance";
import { signUnsubscribeToken } from "./unsubscribe-token";

const APP_URL = "https://healthwatch-global.com";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TIER_LABELS: Record<string, Record<string, string>> = {
  immediate: { fr: "IMMÉDIAT · NOTIFIABLE RSI", en: "IMMEDIATE · IHR NOTIFIABLE", es: "INMEDIATO · NOTIFICABLE RSI", ar: "فوري · إخطار إلزامي", id: "SEGERA · WAJIB LAPOR IHR" },
  rapid:     { fr: "RÉPONSE RAPIDE", en: "RAPID RESPONSE", es: "RESPUESTA RÁPIDA", ar: "استجابة سريعة", id: "RESPONS CEPAT" },
  monitor:   { fr: "SURVEILLANCE", en: "MONITORING", es: "VIGILANCIA", ar: "مراقبة", id: "PEMANTAUAN" },
};

// Light-theme tier colors (Outlook-safe)
const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  immediate: { bg: "#fff1f2", border: "#dc2626", text: "#991b1b" },
  rapid:     { bg: "#fffbeb", border: "#d97706", text: "#92400e" },
  monitor:   { bg: "#f8fafc", border: "#64748b", text: "#475569" },
};

const RISK_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  high:   { bg: "#fff1f2", border: "#fca5a5", color: "#dc2626" },
  medium: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
  low:    { bg: "#f0fdf4", border: "#86efac", color: "#16a34a" },
};

const COPY: Record<string, {
  subject:         (disease: string) => string;
  preheader:       (disease: string, country: string) => string;
  cases:           string;
  deaths:          string;
  cfr:             string;
  date:            string;
  source:          string;
  cta:             string;
  noData:          string;
  unsubNote:       string;
  daysAgoToday:    string;
  daysAgoYesterday: string;
  daysAgoN:        (n: number) => string;
  digestSubject:   (count: number) => string;
  digestHeadline:  (count: number) => string;
  digestUnsubNote: string;
  itemLinkLabel:   string;
  overflowNote:    (count: number) => string;
}> = {
  fr: {
    subject:         (d) => `🔴 Alerte maladie : ${d} détecté`,
    preheader:       (d, c) => `Foyer actif — ${d} · ${c}`,
    cases:           "Cas confirmés",
    deaths:          "Décès",
    cfr:             "Létalité",
    date:            "Date du rapport",
    source:          "Source OMS",
    cta:             "Voir le tableau de bord →",
    noData:          "N/D",
    unsubNote:       "Vous recevez cet email car vous surveillez cette maladie sur healthwatch-global.com.",
    daysAgoToday:    "aujourd'hui",
    daysAgoYesterday: "hier",
    daysAgoN:        (n) => `il y a ${n}j`,
    digestSubject:   (n) => `🔴 ${n} alertes maladies détectées`,
    digestHeadline:  (n) => `${n} maladies que vous surveillez ont un foyer actif :`,
    digestUnsubNote: "Vous recevez cet email car vous surveillez ces maladies sur healthwatch-global.com. Gérez vos alertes dans votre compte.",
    itemLinkLabel:   "Détails →",
    overflowNote:    (n) => `+ ${n} autres alertes maladies — consultez le tableau de bord complet.`,
  },
  en: {
    subject:         (d) => `🔴 Disease alert: ${d} detected`,
    preheader:       (d, c) => `Active outbreak — ${d} · ${c}`,
    cases:           "Confirmed cases",
    deaths:          "Deaths",
    cfr:             "Case fatality rate",
    date:            "Report date",
    source:          "WHO source",
    cta:             "View outbreak →",
    noData:          "N/A",
    unsubNote:       "You receive this email because you're monitoring this disease on healthwatch-global.com.",
    daysAgoToday:    "today",
    daysAgoYesterday: "yesterday",
    daysAgoN:        (n) => `${n}d ago`,
    digestSubject:   (n) => `🔴 ${n} disease alerts detected`,
    digestHeadline:  (n) => `${n} diseases you're monitoring have an active outbreak:`,
    digestUnsubNote: "You receive this email because you're monitoring these diseases on healthwatch-global.com. Manage your alerts from your account.",
    itemLinkLabel:   "Details →",
    overflowNote:    (n) => `+ ${n} more disease alerts — see the full dashboard.`,
  },
  es: {
    subject:         (d) => `🔴 Alerta de enfermedad: ${d} detectado`,
    preheader:       (d, c) => `Brote activo — ${d} · ${c}`,
    cases:           "Casos confirmados",
    deaths:          "Fallecidos",
    cfr:             "Tasa de letalidad",
    date:            "Fecha del informe",
    source:          "Fuente OMS",
    cta:             "Ver brote →",
    noData:          "N/D",
    unsubNote:       "Recibe este correo porque monitorea esta enfermedad en healthwatch-global.com.",
    daysAgoToday:    "hoy",
    daysAgoYesterday: "ayer",
    daysAgoN:        (n) => `hace ${n}d`,
    digestSubject:   (n) => `🔴 ${n} alertas de enfermedades detectadas`,
    digestHeadline:  (n) => `${n} enfermedades que monitoreas tienen un brote activo:`,
    digestUnsubNote: "Recibe este correo porque monitorea estas enfermedades en healthwatch-global.com. Gestiona tus alertas desde tu cuenta.",
    itemLinkLabel:   "Detalles →",
    overflowNote:    (n) => `+ ${n} alertas de enfermedades más — consulta el panel completo.`,
  },
  ar: {
    subject:         (d) => `🔴 تنبيه مرض: تم اكتشاف ${d}`,
    preheader:       (d, c) => `تفشٍّ نشط — ${d} · ${c}`,
    cases:           "الحالات المؤكدة",
    deaths:          "الوفيات",
    cfr:             "معدل الوفيات",
    date:            "تاريخ التقرير",
    source:          "مصدر OMS",
    cta:             "← عرض التفشي",
    noData:          "غ/م",
    unsubNote:       "تتلقى هذا البريد لأنك تراقب هذا المرض على healthwatch-global.com.",
    daysAgoToday:    "اليوم",
    daysAgoYesterday: "أمس",
    daysAgoN:        (n) => `منذ ${n} أيام`,
    digestSubject:   (n) => `🔴 ${n} تنبيهات أمراض تم اكتشافها`,
    digestHeadline:  (n) => `${n} أمراض تراقبها لديها تفشٍّ نشط:`,
    digestUnsubNote: "تتلقى هذا البريد لأنك تراقب هذه الأمراض على healthwatch-global.com. أدر تنبيهاتك من حسابك.",
    itemLinkLabel:   "← التفاصيل",
    overflowNote:    (n) => `+ ${n} تنبيهات أمراض أخرى — راجع لوحة التحكم الكاملة.`,
  },
  id: {
    subject:         (d) => `🔴 Peringatan penyakit: ${d} terdeteksi`,
    preheader:       (d, c) => `Wabah aktif — ${d} · ${c}`,
    cases:           "Kasus terkonfirmasi",
    deaths:          "Kematian",
    cfr:             "Tingkat kematian kasus",
    date:            "Tanggal laporan",
    source:          "Sumber WHO",
    cta:             "Lihat wabah →",
    noData:          "T/S",
    unsubNote:       "Anda menerima email ini karena memantau penyakit ini di healthwatch-global.com.",
    daysAgoToday:    "hari ini",
    daysAgoYesterday: "kemarin",
    daysAgoN:        (n) => `${n}h lalu`,
    digestSubject:   (n) => `🔴 ${n} peringatan penyakit terdeteksi`,
    digestHeadline:  (n) => `${n} penyakit yang Anda pantau memiliki wabah aktif:`,
    digestUnsubNote: "Anda menerima email ini karena memantau penyakit-penyakit ini di healthwatch-global.com. Kelola peringatan Anda dari akun Anda.",
    itemLinkLabel:   "Detail →",
    overflowNote:    (n) => `+ ${n} peringatan penyakit lainnya — lihat dasbor lengkap.`,
  },
};

export interface DiseaseAlertOutbreak {
  id:           string;
  disease_en:   string;
  disease:      string;
  country_en:   string;
  country:      string;
  cases:        number;
  deaths:       number | null;
  risk_level:   string;
  date:         string;
  source:       string;
}

export function buildDiseaseAlertEmail(
  outbreak: DiseaseAlertOutbreak,
  locale: string,
  userId: string,
  diseaseSlug: string
): { subject: string; html: string } {
  const c        = COPY[locale] ?? COPY.en;
  const isRtl    = locale === "ar";
  const dir      = isRtl ? "rtl" : "ltr";
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");

  const disease  = esc(outbreak.disease  || outbreak.disease_en  || "");
  const country  = esc(outbreak.country  || outbreak.country_en  || "");

  const hasData  = outbreak.cases > 0;
  const cfr      = hasData && outbreak.deaths !== null ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) + "%" : c.noData;
  const casesStr = hasData ? outbreak.cases.toLocaleString(numLocale)  : c.noData;
  const deathStr = hasData && outbreak.deaths !== null ? outbreak.deaths.toLocaleString(numLocale) : c.noData;

  const daysAgo    = outbreak.date
    ? Math.floor((Date.now() - new Date(outbreak.date).getTime()) / 86_400_000)
    : null;
  const ageLabel   = daysAgo === null ? "" : daysAgo === 0 ? c.daysAgoToday : daysAgo === 1 ? c.daysAgoYesterday : c.daysAgoN(daysAgo);
  const ageColor   = daysAgo === null ? "#94a3b8" : daysAgo <= 7 ? "#16a34a" : daysAgo <= 21 ? "#b45309" : "#dc2626";

  // Was previously named `subscriptionId` and pointed at /api/unsubscribe,
  // which operates on the unrelated `subscriptions` table (the free
  // newsletter list) — this is a profiles.id, and disease-specific alerts are
  // gated by `user_alert_diseases`, so that link matched zero rows every
  // time: the button showed a friendly "unsubscribed" page while doing
  // nothing. Fixed 2026-07-30 (see /api/unsubscribe-disease).
  const unsubUrl   = `${APP_URL}/api/unsubscribe-disease?id=${encodeURIComponent(userId)}&token=${signUnsubscribeToken(userId)}&disease=${encodeURIComponent(outbreak.disease_en || outbreak.disease)}&locale=${locale}`;
  const diseaseUrl = `${APP_URL}/${locale}/disease/${diseaseSlug}`;

  const rs         = RISK_STYLE[outbreak.risk_level] ?? RISK_STYLE.medium;
  const guidance   = getResponseGuidance(outbreak.disease_en || outbreak.disease);
  const tc         = TIER_COLORS[guidance.tier];
  const tierLabel  = TIER_LABELS[guidance.tier]?.[locale] ?? TIER_LABELS[guidance.tier].en;
  const firstAction = (RESPONSE_ACTIONS[guidance.tier][locale] ?? RESPONSE_ACTIONS[guidance.tier].en)[0];
  const showAction = guidance.tier !== "monitor";

  const subject    = c.subject(outbreak.disease || outbreak.disease_en);
  const preheader  = c.preheader(outbreak.disease || outbreak.disease_en, outbreak.country || outbreak.country_en);

  const sourceLabel = outbreak.source
    ? outbreak.source.replace(/^https?:\/\//, "").replace(/\/.*$/, "") + " →"
    : "";

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#dc2626;padding:16px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">HealthWatch Global</td>
      <td align="right" style="color:#fca5a5;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Disease Alert</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:28px 24px;border:1px solid #e2e8f0;border-top:0;">

    <!-- Disease headline -->
    <p style="margin:0 0 2px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;font-family:Arial,Helvetica,sans-serif;">${disease}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">${country}</p>

    <!-- Risk badge (table-based, Outlook-safe) -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
      <tr><td style="background:${rs.bg};border:1px solid ${rs.border};padding:4px 12px;">
        <span style="color:${rs.color};font-size:11px;font-weight:700;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${esc(outbreak.risk_level.toUpperCase())}</span>
      </td></tr>
    </table>

    <!-- IHR tier bar -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="background:${tc.bg};border-left:3px solid ${tc.border};padding:10px 14px;">
        <div style="color:${tc.text};font-size:10px;font-weight:700;letter-spacing:0.5px;margin-bottom:${showAction ? "6px" : "0"};font-family:Arial,Helvetica,sans-serif;">${tierLabel}</div>
        ${showAction ? `<div style="color:${tc.text};font-size:12px;font-family:Arial,Helvetica,sans-serif;">&#9658; ${firstAction}</div>` : ""}
      </td></tr>
    </table>

    <!-- Stats row -->
    <table width="100%" cellpadding="0" cellspacing="6" style="margin-bottom:20px;">
      <tr>
        <td width="33%" style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px 8px;text-align:center;">
          <div style="color:#2563eb;font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:6px;font-family:Arial,Helvetica,sans-serif;">${c.cases}</div>
          <div style="color:#0f172a;font-size:20px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${casesStr}</div>
        </td>
        <td width="33%" style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px 8px;text-align:center;">
          <div style="color:#dc2626;font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:6px;font-family:Arial,Helvetica,sans-serif;">${c.deaths}</div>
          <div style="color:#dc2626;font-size:20px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${deathStr}</div>
        </td>
        <td width="33%" style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px 8px;text-align:center;">
          <div style="color:#b45309;font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:6px;font-family:Arial,Helvetica,sans-serif;">${c.cfr}</div>
          <div style="color:#b45309;font-size:20px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${cfr}</div>
        </td>
      </tr>
    </table>

    <!-- Date + Source -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-top:1px solid #f1f5f9;">
      <tr><td style="color:#94a3b8;font-size:12px;padding:12px 0 3px;font-family:Arial,Helvetica,sans-serif;">
        ${c.date} : <span style="color:#475569;">${esc(outbreak.date ?? "")}</span>${ageLabel ? ` <span style="color:${ageColor};font-weight:700;">(${ageLabel})</span>` : ""}
      </td></tr>
      ${outbreak.source ? `<tr><td style="color:#94a3b8;font-size:12px;padding:3px 0;font-family:Arial,Helvetica,sans-serif;">${c.source} : <a href="${esc(outbreak.source)}" style="color:#dc2626;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${esc(sourceLabel)}</a></td></tr>` : ""}
    </table>

    <!-- CTA (table-based for Outlook) -->
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#dc2626;padding:12px 28px;">
        <a href="${diseaseUrl}" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${c.cta}</a>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 0;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">${c.unsubNote}</p>
    <a href="${unsubUrl}" style="color:#94a3b8;font-size:11px;font-family:Arial,Helvetica,sans-serif;">Unsubscribe</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

// ─── Digest email (multiple disease alerts in one send) ───────────────────────
// Sent instead of buildDiseaseAlertEmail whenever more than one outbreak
// qualifies for the same user's disease subscriptions in the same cron run —
// same fix and same reasoning as buildOutbreakDigestEmail in lib/alert-emails.ts
// for regional-alerts (2026-08-02). One email per user per run; capped at
// MAX_DIGEST_ITEMS_PER_EMAIL (see app/api/cron/disease-alerts/route.ts) with
// the rest summarized rather than dropped.
//
// Unlike the single-outbreak email, this has no one-click unsubscribe link:
// buildDiseaseAlertEmail's token unsubscribes from ONE disease, but a digest
// spans however many diseases matched this run — pointing that link at any
// single one of them would silently unsubscribe the user from diseases they
// didn't ask to stop tracking. Points to the account page instead.

export interface DiseaseDigestItem {
  disease: string;
  country: string;
  risk_level: string;
  cases: number;
  deaths: number | null;
  date: string;
  diseaseUrl: string;
}

export function buildDiseaseAlertDigestEmail(
  locale: string,
  items: DiseaseDigestItem[],
  accountUrl: string,
  overflowCount = 0
): { subject: string; html: string } {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");
  const totalCount = items.length + overflowCount;

  const rows = items
    .map((item) => {
      const rs = RISK_STYLE[item.risk_level] ?? RISK_STYLE.medium;
      const hasData = item.cases > 0;
      const casesStr = hasData ? item.cases.toLocaleString(numLocale) : c.noData;
      const deathStr = hasData && item.deaths !== null ? item.deaths.toLocaleString(numLocale) : c.noData;
      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:15px;font-weight:700;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">${esc(item.disease)}</td>
              <td align="right"><span style="background:${rs.bg};border:1px solid ${rs.border};color:${rs.color};font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 8px;font-family:Arial,Helvetica,sans-serif;">${esc(item.risk_level.toUpperCase())}</span></td>
            </tr>
          </table>
          <p style="margin:2px 0 6px;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">${esc(item.country)}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#475569;font-family:Arial,Helvetica,sans-serif;">${c.cases}: ${casesStr} · ${c.deaths}: ${deathStr} · ${esc(item.date)}</p>
          <a href="${item.diseaseUrl}" style="color:#dc2626;font-size:13px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${c.itemLinkLabel}</a>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.digestSubject(totalCount)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#dc2626;padding:16px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">HealthWatch Global</td>
      <td align="right" style="color:#fca5a5;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Disease Alert</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:28px 24px;border:1px solid #e2e8f0;border-top:0;">

    <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;line-height:1.3;font-family:Arial,Helvetica,sans-serif;">${c.digestHeadline(totalCount)}</p>

    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>

    ${overflowCount > 0
      ? `<p style="margin:14px 0 0;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">${c.overflowNote(overflowCount)}</p>`
      : ""}

    <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr><td style="background:#dc2626;padding:12px 28px;">
        <a href="${accountUrl}" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${c.cta}</a>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 0;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;font-family:Arial,Helvetica,sans-serif;">${c.digestUnsubNote}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: c.digestSubject(totalCount), html };
}
