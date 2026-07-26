// ─── Signup digest email ───────────────────────────────────────────────────
// Sent once, right after trial activation, alongside the regular per-event
// regional alert emails (lib/alert-emails.ts). Those only fire on outbreaks
// created/updated after the user enrolls — a foyer that's already active and
// stable at signup time never triggers one on its own, so a new trial saw as
// little as 9% of the outbreaks actually live in their regions (audit
// 2026-07-26, see project_regional_alerts_prefix_backlog_2026_07_25). This
// gives every new trial a one-time snapshot of what's already there.

import { getLocalizedDisease, getLocalizedCountry } from "./outbreaks";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface DigestOutbreak {
  disease: string;
  disease_en: string | null;
  disease_ar: string | null;
  country: string;
  country_en: string | null;
  country_ar: string | null;
  risk_level: "high" | "medium" | "low";
  cases: number | null;
}

const CONTENT: Record<string, {
  subject: (count: number) => string;
  headline: (count: number) => string;
  intro: string;
  more: (n: number) => string;
  futureNote: string;
  ctaLabel: string;
  closing: string;
  unsubNote: string;
  riskLabels: Record<string, string>;
}> = {
  fr: {
    subject: (n) => `🌍 ${n} foyers actifs déjà suivis dans vos régions`,
    headline: (n) => `${n} foyers épidémiques sont déjà actifs dans les régions que vous suivez.`,
    intro: "Voici un état des lieux au moment de votre inscription :",
    more: (n) => `+ ${n} autres foyers actifs, consultables dans votre tableau de bord.`,
    futureNote: "Vous recevrez un email dès qu'un nouveau foyer apparaît ou que l'un de ceux-ci s'aggrave — pas besoin de tout revoir ici à chaque fois.",
    ctaLabel: "Voir le tableau de bord complet →",
    closing: "Restez vigilants,\nL'équipe HealthWatch Global",
    unsubNote:
      "Vous recevez cet email car vous avez activé les alertes régionales dans votre compte HealthWatch Global. Gérez vos préférences dans votre compte.",
    riskLabels: { high: "Élevé 🔴", medium: "Modéré 🟡", low: "Faible 🟢" },
  },
  en: {
    subject: (n) => `🌍 ${n} active outbreaks already tracked in your regions`,
    headline: (n) => `${n} disease outbreaks are already active in the regions you're tracking.`,
    intro: "Here's the state of play at the moment you signed up:",
    more: (n) => `+ ${n} more active outbreaks, viewable in your dashboard.`,
    futureNote: "You'll get an email the moment a new outbreak appears or one of these gets worse — no need to revisit this list otherwise.",
    ctaLabel: "View full dashboard →",
    closing: "Stay vigilant,\nThe HealthWatch Global team",
    unsubNote:
      "You are receiving this email because you enabled regional alerts in your HealthWatch Global account. Manage your preferences from your account page.",
    riskLabels: { high: "High 🔴", medium: "Medium 🟡", low: "Low 🟢" },
  },
  es: {
    subject: (n) => `🌍 ${n} brotes activos ya monitoreados en sus regiones`,
    headline: (n) => `${n} brotes de enfermedades ya están activos en las regiones que sigue.`,
    intro: "Este es el estado actual en el momento de su inscripción:",
    more: (n) => `+ ${n} brotes activos más, disponibles en su panel.`,
    futureNote: "Recibirá un correo en cuanto aparezca un nuevo brote o alguno de estos empeore, no hace falta revisar esta lista de nuevo.",
    ctaLabel: "Ver el panel completo →",
    closing: "Permanezca alerta,\nEl equipo de HealthWatch Global",
    unsubNote:
      "Recibe este correo porque activó las alertas regionales en su cuenta de HealthWatch Global. Gestione sus preferencias desde su perfil.",
    riskLabels: { high: "Alto 🔴", medium: "Moderado 🟡", low: "Bajo 🟢" },
  },
  ar: {
    subject: (n) => `🌍 ${n} تفشيات نشطة تتم متابعتها بالفعل في مناطقك`,
    headline: (n) => `${n} تفشياً وبائياً نشطاً بالفعل في المناطق التي تتابعها.`,
    intro: "إليك الوضع الحالي لحظة تسجيلك:",
    more: (n) => `+ ${n} تفشياً نشطاً إضافياً، يمكن الاطلاع عليها في لوحة التحكم.`,
    futureNote: "ستتلقى بريداً إلكترونياً فور ظهور تفشٍّ جديد أو تفاقم أحد هذه التفشيات، لا حاجة لمراجعة هذه القائمة مجدداً.",
    ctaLabel: "← عرض لوحة التحكم الكاملة",
    closing: "ابقوا يقظين،\nفريق HealthWatch Global",
    unsubNote:
      "تتلقى هذا البريد الإلكتروني لأنك فعّلت التنبيهات الإقليمية في حسابك على HealthWatch Global. يمكنك إدارة تفضيلاتك من صفحة حسابك.",
    riskLabels: { high: "مرتفع 🔴", medium: "متوسط 🟡", low: "منخفض 🟢" },
  },
  id: {
    subject: (n) => `🌍 ${n} wabah aktif yang sudah dipantau di wilayah Anda`,
    headline: (n) => `${n} wabah penyakit sudah aktif di wilayah yang Anda pantau.`,
    intro: "Berikut kondisi terkini pada saat Anda mendaftar:",
    more: (n) => `+ ${n} wabah aktif lainnya, dapat dilihat di dasbor Anda.`,
    futureNote: "Anda akan menerima email begitu wabah baru muncul atau salah satu dari ini memburuk, tidak perlu meninjau ulang daftar ini.",
    ctaLabel: "Lihat dasbor lengkap →",
    closing: "Tetap waspada,\nTim HealthWatch Global",
    unsubNote:
      "Anda menerima email ini karena Anda mengaktifkan peringatan regional di akun HealthWatch Global Anda. Kelola preferensi Anda dari halaman akun.",
    riskLabels: { high: "Tinggi 🔴", medium: "Sedang 🟡", low: "Rendah 🟢" },
  },
};

const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const RISK_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

export function buildSignupDigestEmail(
  locale: string,
  topOutbreaks: DigestOutbreak[],
  totalCount: number,
  dashboardUrl: string,
  unsubUrl?: string
): { subject: string; html: string } {
  const c = CONTENT[locale] ?? CONTENT.en;
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");
  const sorted = [...topOutbreaks].sort(
    (a, b) => (RISK_RANK[b.risk_level] ?? 0) - (RISK_RANK[a.risk_level] ?? 0)
  );
  const remaining = totalCount - sorted.length;

  const rows = sorted
    .map((o) => {
      const disease = getLocalizedDisease(o, locale);
      const country = getLocalizedCountry(o, locale);
      const color = RISK_COLOR[o.risk_level] ?? "#6b7280";
      const riskLabel = c.riskLabels[o.risk_level] ?? o.risk_level;
      return `<tr style="border-bottom:1px solid #374151">
        <td style="padding:10px 8px;color:#ffffff;font-weight:600">${esc(disease)}</td>
        <td style="padding:10px 8px;color:#9ca3af">${esc(country)}</td>
        <td style="padding:10px 8px;color:#e5e7eb;text-align:${locale === "ar" ? "left" : "right"}">${
        o.cases != null ? o.cases.toLocaleString(numLocale) : "—"
      }</td>
        <td style="padding:10px 8px;text-align:${locale === "ar" ? "left" : "right"}">
          <span style="color:${color};font-weight:600;font-size:12px">${riskLabel}</span>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111827;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:40px auto;padding:0 16px">

    <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <div style="width:40px;height:40px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px">🌍</div>
        <span style="color:#9ca3af;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase">HealthWatch Global</span>
      </div>

      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px">${c.headline(totalCount)}</h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">${c.intro}</p>

      <div style="overflow-x:auto;border:1px solid #374151;border-radius:12px;margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tbody>${rows}</tbody>
        </table>
      </div>

      ${remaining > 0 ? `<p style="color:#9ca3af;font-size:13px;margin:0 0 24px">${c.more(remaining)}</p>` : `<div style="margin-bottom:24px"></div>`}

      <a href="${dashboardUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;margin-bottom:20px">
        ${c.ctaLabel}
      </a>

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;padding-top:16px;border-top:1px solid #374151">
        ${c.futureNote}
      </p>
    </div>

    <p style="color:#4b5563;font-size:12px;line-height:1.6;text-align:center;margin:0">
      ${c.unsubNote}${unsubUrl ? ` <a href="${unsubUrl}" style="color:#4b5563;text-decoration:underline">${locale === "fr" ? "Gérer mes alertes" : locale === "es" ? "Gestionar alertas" : locale === "ar" ? "إدارة التنبيهات" : locale === "id" ? "Kelola peringatan" : "Manage alerts"}</a>` : ""}
    </p>
  </div>
</body>
</html>`;

  return { subject: c.subject(totalCount), html };
}
