const CONTENT: Record<string, {
  subject:   (teamName: string) => string;
  greeting:  string;
  intro:     (inviterEmail: string, teamName: string) => string;
  ctaLabel:  string;
  expiry:    string;
  closing:   string;
  team:      string;
  unsubNote: string;
}> = {
  fr: {
    subject:   (t) => `Invitation à rejoindre l'équipe "${t}" sur HealthWatch Global`,
    greeting:  "Bonjour,",
    intro:     (inv, t) => `${inv} vous invite à rejoindre l'équipe "<strong>${t}</strong>" sur HealthWatch Global — surveillance épidémique mondiale en temps réel.`,
    ctaLabel:  "Accepter l'invitation →",
    expiry:    "Ce lien est valable 7 jours.",
    closing:   "À bientôt,",
    team:      "L'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez été invité(e) à rejoindre une équipe sur healthwatch-global.com.",
  },
  en: {
    subject:   (t) => `Invitation to join team "${t}" on HealthWatch Global`,
    greeting:  "Hello,",
    intro:     (inv, t) => `${inv} has invited you to join the team "<strong>${t}</strong>" on HealthWatch Global — real-time global epidemic surveillance.`,
    ctaLabel:  "Accept invitation →",
    expiry:    "This link is valid for 7 days.",
    closing:   "See you soon,",
    team:      "The HealthWatch Global Team",
    unsubNote: "You received this email because you were invited to join a team on healthwatch-global.com.",
  },
  es: {
    subject:   (t) => `Invitación para unirse al equipo "${t}" en HealthWatch Global`,
    greeting:  "Hola,",
    intro:     (inv, t) => `${inv} le invita a unirse al equipo "<strong>${t}</strong>" en HealthWatch Global — vigilancia epidémica global en tiempo real.`,
    ctaLabel:  "Aceptar invitación →",
    expiry:    "Este enlace es válido durante 7 días.",
    closing:   "Hasta pronto,",
    team:      "El equipo de HealthWatch Global",
    unsubNote: "Recibió este correo porque fue invitado(a) a unirse a un equipo en healthwatch-global.com.",
  },
  ar: {
    subject:   (t) => `دعوة للانضمام إلى فريق "${t}" على HealthWatch Global`,
    greeting:  "مرحباً،",
    intro:     (inv, t) => `دعاك ${inv} للانضمام إلى فريق "<strong>${t}</strong>" على HealthWatch Global — مراقبة الأوبئة العالمية في الوقت الفعلي.`,
    ctaLabel:  "← قبول الدعوة",
    expiry:    "هذا الرابط صالح لمدة 7 أيام.",
    closing:   "مع التحية،",
    team:      "فريق HealthWatch Global",
    unsubNote: "تلقيت هذا البريد الإلكتروني لأنك دُعيت للانضمام إلى فريق على healthwatch-global.com.",
  },
  id: {
    subject:   (t) => `Undangan bergabung dengan tim "${t}" di HealthWatch Global`,
    greeting:  "Halo,",
    intro:     (inv, t) => `${inv} mengundang Anda untuk bergabung dengan tim "<strong>${t}</strong>" di HealthWatch Global — pemantauan epidemi global secara real-time.`,
    ctaLabel:  "Terima undangan →",
    expiry:    "Tautan ini berlaku selama 7 hari.",
    closing:   "Sampai jumpa,",
    team:      "Tim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena diundang bergabung dengan tim di healthwatch-global.com.",
  },
};

export function buildTeamInviteEmail(
  inviterEmail: string,
  teamName:     string,
  acceptUrl:    string,
  locale:       string
): { subject: string; html: string } {
  const c   = CONTENT[locale] ?? CONTENT.en;
  const dir = locale === "ar" ? "rtl" : "ltr";

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px;direction:${dir};">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

    <!-- Header -->
    <div style="background:#d97706;padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
      <p style="margin:6px 0 0;color:#fef3c7;font-size:13px;">Global Epidemic Surveillance — Team Invite</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">
      <p style="font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 8px;">${c.greeting}</p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 32px;">${c.intro(inviterEmail, teamName)}</p>

      <!-- Feature highlight -->
      <div style="background:#0f172a;border-radius:12px;padding:18px 20px;border-left:3px solid #d97706;margin-bottom:32px;">
        <p style="margin:0 0 6px;font-weight:700;color:#f1f5f9;font-size:14px;">👥 ${teamName}</p>
        <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
          WHO DON · ECDC · PAHO · Africa CDC — 4× daily sync · IHR response tiers · PDF reports · CSV export
        </p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${acceptUrl}"
           style="display:inline-block;background:#d97706;color:white;text-decoration:none;
                  padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>

      <p style="text-align:center;color:#64748b;font-size:12px;margin:0;">${c.expiry}</p>
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

  return { subject: c.subject(teamName), html };
}
