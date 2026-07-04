const CONTENT: Record<string, {
  subject: string;
  heading: string;
  intro: string;
  cta: string;
  expiry: string;
  ignore: string;
  team: string;
}> = {
  fr: {
    subject: "Réinitialisez votre mot de passe HealthWatch Global",
    heading: "Réinitialisation de mot de passe",
    intro: "Vous avez demandé à réinitialiser le mot de passe de votre compte HealthWatch Global. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
    cta: "Réinitialiser mon mot de passe →",
    expiry: "Ce lien expire dans 1 heure.",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé.",
    team: "L'équipe HealthWatch Global",
  },
  en: {
    subject: "Reset your HealthWatch Global password",
    heading: "Password reset",
    intro: "You requested a password reset for your HealthWatch Global account. Click the button below to choose a new password.",
    cta: "Reset my password →",
    expiry: "This link expires in 1 hour.",
    ignore: "If you didn't request this, just ignore this email — your password will stay unchanged.",
    team: "The HealthWatch Global Team",
  },
  es: {
    subject: "Restablezca su contraseña de HealthWatch Global",
    heading: "Restablecimiento de contraseña",
    intro: "Solicitó restablecer la contraseña de su cuenta de HealthWatch Global. Haga clic en el botón de abajo para elegir una nueva contraseña.",
    cta: "Restablecer mi contraseña →",
    expiry: "Este enlace caduca en 1 hora.",
    ignore: "Si no ha solicitado esto, ignore este correo — su contraseña no cambiará.",
    team: "El equipo de HealthWatch Global",
  },
  ar: {
    subject: "إعادة تعيين كلمة مرور HealthWatch Global",
    heading: "إعادة تعيين كلمة المرور",
    intro: "لقد طلبت إعادة تعيين كلمة مرور حسابك في HealthWatch Global. انقر على الزر أدناه لاختيار كلمة مرور جديدة.",
    cta: "← إعادة تعيين كلمة المرور",
    expiry: "تنتهي صلاحية هذا الرابط خلال ساعة واحدة.",
    ignore: "إذا لم تطلب ذلك، تجاهل هذا البريد الإلكتروني فحسب — ستبقى كلمة مرورك دون تغيير.",
    team: "فريق HealthWatch Global",
  },
  id: {
    subject: "Atur ulang kata sandi HealthWatch Global Anda",
    heading: "Atur ulang kata sandi",
    intro: "Anda meminta untuk mengatur ulang kata sandi akun HealthWatch Global Anda. Klik tombol di bawah untuk memilih kata sandi baru.",
    cta: "Atur ulang kata sandi saya →",
    expiry: "Tautan ini berlaku selama 1 jam.",
    ignore: "Jika Anda tidak meminta ini, abaikan saja email ini — kata sandi Anda tidak akan berubah.",
    team: "Tim HealthWatch Global",
  },
};

export function buildResetPasswordEmail(locale: string, actionLink: string): { subject: string; html: string } {
  const c = CONTENT[locale] ?? CONTENT.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px;direction:${dir};">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

    <!-- Header -->
    <div style="background:#dc2626;padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">
      <p style="font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 8px;">${c.heading}</p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">${c.intro}</p>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${actionLink}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;">
          ${c.cta}
        </a>
      </div>

      <p style="color:#64748b;font-size:13px;text-align:center;margin:0 0 4px;">${c.expiry}</p>
      <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">${c.ignore}</p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0;font-size:13px;color:#e2e8f0;font-weight:600;">${c.team}</p>
    </div>

  </div>
</body>
</html>`;

  return { subject: c.subject, html };
}
