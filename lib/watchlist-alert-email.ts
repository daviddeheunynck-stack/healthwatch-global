// Watchlist change alert — sent when cases/deaths update for a starred outbreak

import { getResponseGuidance, RESPONSE_ACTIONS } from "./response-guidance";

const APP_URL = "https://healthwatch-global.com";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TIER_LABELS: Record<string, Record<string, string>> = {
  immediate: { fr: "IMMÉDIAT · NOTIFIABLE RSI", en: "IMMEDIATE · IHR NOTIFIABLE", es: "INMEDIATO · NOTIFICABLE RSI", ar: "فوري · إخطار إلزامي", id: "SEGERA · WAJIB LAPOR IHR" },
  rapid:     { fr: "RÉPONSE RAPIDE", en: "RAPID RESPONSE", es: "RESPUESTA RÁPIDA", ar: "استجابة سريعة", id: "RESPONS CEPAT" },
  monitor:   { fr: "SURVEILLANCE", en: "MONITORING", es: "VIGILANCIA", ar: "مراقبة", id: "PEMANTAUAN" },
};

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  immediate: { bg: "#4c0519", border: "#dc2626", text: "#fda4af" },
  rapid:     { bg: "#422006", border: "#d97706", text: "#fde68a" },
  monitor:   { bg: "#1e293b", border: "#475569", text: "#94a3b8" },
};

const COPY: Record<string, {
  subject:   (disease: string, country: string) => string;
  headline:  string;
  newCases:  string;
  newDeaths: string;
  cfr:       string;
  date:      string;
  source:    string;
  cta:       string;
  noData:    string;
  unsubNote: string;
}> = {
  fr: {
    subject:   (d, c) => `[HealthWatch] Mise à jour : ${d} — ${c}`,
    headline:  "Un foyer que vous surveillez a été mis à jour.",
    newCases:  "Cas confirmés",
    newDeaths: "Décès",
    cfr:       "Taux de létalité",
    date:      "Date du rapport",
    source:    "Bulletin OMS",
    cta:       "Voir le tableau de bord →",
    noData:    "N/D",
    unsubNote: "Vous recevez cet email car vous suivez ce foyer sur healthwatch-global.com.",
  },
  en: {
    subject:   (d, c) => `⭐ Update: ${d} — ${c}`,
    headline:  "An outbreak you're watching has been updated.",
    newCases:  "Confirmed cases",
    newDeaths: "Deaths",
    cfr:       "Case fatality rate",
    date:      "Report date",
    source:    "WHO bulletin",
    cta:       "View dashboard →",
    noData:    "N/A",
    unsubNote: "You receive this email because you're watching this outbreak on healthwatch-global.com.",
  },
  es: {
    subject:   (d, c) => `⭐ Actualización: ${d} — ${c}`,
    headline:  "Un brote que está siguiendo ha sido actualizado.",
    newCases:  "Casos confirmados",
    newDeaths: "Fallecidos",
    cfr:       "Tasa de letalidad",
    date:      "Fecha del informe",
    source:    "Boletín OMS",
    cta:       "Ver el panel →",
    noData:    "N/D",
    unsubNote: "Recibe este correo porque sigue este brote en healthwatch-global.com.",
  },
  ar: {
    subject:   (d, c) => `⭐ تحديث: ${d} — ${c}`,
    headline:  "تم تحديث تفشٍّ تتابعه.",
    newCases:  "الحالات المؤكدة",
    newDeaths: "الوفيات",
    cfr:       "معدل الوفيات",
    date:      "تاريخ التقرير",
    source:    "نشرة OMS",
    cta:       "← عرض لوحة التحكم",
    noData:    "غ/م",
    unsubNote: "تتلقى هذا البريد لأنك تتابع هذا التفشي على healthwatch-global.com.",
  },
  id: {
    subject:   (d, c) => `⭐ Pembaruan: ${d} — ${c}`,
    headline:  "Wabah yang Anda pantau telah diperbarui.",
    newCases:  "Kasus terkonfirmasi",
    newDeaths: "Kematian",
    cfr:       "Tingkat kematian kasus",
    date:      "Tanggal laporan",
    source:    "Buletin WHO",
    cta:       "Lihat dasbor →",
    noData:    "T/S",
    unsubNote: "Anda menerima email ini karena memantau wabah ini di healthwatch-global.com.",
  },
};

export interface WatchlistOutbreak {
  id: string;
  disease_en: string;
  disease: string;
  country_en: string;
  country: string;
  cases: number;
  deaths: number | null;
  risk_level: string;
  date: string;
  source: string;
  is_pheic: boolean;
  prevCases: number;
  prevDeaths: number;
}

export function buildWatchlistAlertEmail(
  outbreak: WatchlistOutbreak,
  locale: string,
  _userId: string
): { subject: string; html: string } {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const dir   = isRtl ? "rtl" : "ltr";
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");

  const hasData    = outbreak.cases > 0;
  const cfr        = hasData && outbreak.deaths !== null ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) + "%" : c.noData;
  const dashUrl    = `${APP_URL}/${locale}`;

  const RISK_COLOR: Record<string, string> = {
    high: "#dc2626", medium: "#d97706", low: "#16a34a",
  };
  const color = RISK_COLOR[outbreak.risk_level] ?? "#6b7280";

  // Delta indicators
  const caseDelta  = outbreak.cases  - outbreak.prevCases;
  const deathDelta = outbreak.deaths !== null ? outbreak.deaths - outbreak.prevDeaths : 0;
  const caseSign   = caseDelta  > 0 ? "+" : "";
  const deathSign  = deathDelta > 0 ? "+" : "";

  const guidance    = getResponseGuidance(outbreak.disease_en || outbreak.disease);
  const tc          = TIER_COLORS[guidance.tier];
  const tierLabel   = TIER_LABELS[guidance.tier]?.[locale] ?? TIER_LABELS[guidance.tier].en;
  const firstAction = (RESPONSE_ACTIONS[guidance.tier][locale] ?? RESPONSE_ACTIONS[guidance.tier].en)[0];
  const showAction  = guidance.tier !== "monitor";

  const subject = c.subject(outbreak.disease || outbreak.disease_en, outbreak.country || outbreak.country_en);

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:12px 12px 0 0;padding:20px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#fbbf24;font-size:13px;font-weight:600;">⭐ HealthWatch Global · Watchlist</td>
      <td style="text-align:right;color:#475569;font-size:12px;">${outbreak.date}</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#1e293b;border:1px solid #334155;border-top:none;border-radius:0 0 12px 12px;padding:28px;">

    <div style="border-left:4px solid ${color};padding-left:16px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:white;">
        ${esc(outbreak.disease || outbreak.disease_en || "")}
      </p>
      <p style="margin:0;font-size:15px;color:#94a3b8;">
        📍 ${esc(outbreak.country || outbreak.country_en || "")}
        ${outbreak.is_pheic ? ' &nbsp;<span style="background:#581c87;color:#d8b4fe;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;">🚨 PHEIC</span>' : ""}
      </p>
    </div>

    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;">${c.headline}</p>

    <!-- Stats -->
    <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        <td width="33%" style="background:#0f172a;border-radius:8px;padding:14px;text-align:center;">
          <div style="color:#60a5fa;font-size:11px;margin-bottom:6px;">${c.newCases}</div>
          <div style="color:white;font-size:22px;font-weight:800;">
            ${hasData ? outbreak.cases.toLocaleString(numLocale) : c.noData}
          </div>
          ${caseDelta !== 0 ? `<div style="color:${caseDelta > 0 ? "#f87171" : "#4ade80"};font-size:12px;margin-top:4px;">${caseSign}${caseDelta.toLocaleString(numLocale)}</div>` : ""}
        </td>
        <td width="33%" style="background:#0f172a;border-radius:8px;padding:14px;text-align:center;">
          <div style="color:#f87171;font-size:11px;margin-bottom:6px;">${c.newDeaths}</div>
          <div style="color:#f87171;font-size:22px;font-weight:800;">
            ${hasData && outbreak.deaths !== null ? outbreak.deaths.toLocaleString(numLocale) : c.noData}
          </div>
          ${deathDelta !== 0 ? `<div style="color:${deathDelta > 0 ? "#f87171" : "#4ade80"};font-size:12px;margin-top:4px;">${deathSign}${deathDelta.toLocaleString(numLocale)}</div>` : ""}
        </td>
        <td width="33%" style="background:#0f172a;border-radius:8px;padding:14px;text-align:center;">
          <div style="color:#fbbf24;font-size:11px;margin-bottom:6px;">${c.cfr}</div>
          <div style="color:#fbbf24;font-size:22px;font-weight:800;">${cfr}</div>
        </td>
      </tr>
    </table>

    <!-- IHR tier + action -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="background:${tc.bg};border-left:3px solid ${tc.border};border-radius:0 6px 6px 0;padding:10px 14px;">
        <div style="color:${tc.text};font-size:10px;font-weight:700;letter-spacing:0.5px;margin-bottom:${showAction ? "6px" : "0"};">${tierLabel}</div>
        ${showAction ? `<div style="color:${tc.text};font-size:12px;opacity:0.9;">▶ ${firstAction}</div>` : ""}
      </td></tr>
    </table>

    <!-- Source -->
    ${outbreak.source ? `<p style="color:#475569;font-size:12px;margin-bottom:20px;">${c.source} : <a href="${outbreak.source}" style="color:#ef4444;">${outbreak.source.replace("https://", "")}</a></p>` : ""}

    <!-- CTA -->
    <a href="${dashUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">${c.cta}</a>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 0;text-align:center;">
    <p style="color:#475569;font-size:11px;margin:0;">${c.unsubNote}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}
