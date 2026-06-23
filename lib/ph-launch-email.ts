const PH_URL = "https://www.producthunt.com/products/healthwatch-global";
const DEMO_URL = "https://healthwatch-global.com/en?demo=1&utm_source=email&utm_medium=launch_blast&utm_campaign=ph_launch_2026";

const COPY: Record<string, {
  subject: string;
  headline: string;
  body: string;
  voteCta: string;
  dashCta: string;
  closing: string;
  unsub: string;
}> = {
  en: {
    subject: "HealthWatch Global is live on Product Hunt today 🚀",
    headline: "We're live on Product Hunt",
    body: `Today we officially launched HealthWatch Global on Product Hunt.

If you've found the platform useful for tracking outbreaks, your upvote today would mean a great deal to us — it's what determines our ranking in the first hours of launch.

What's new since you signed up:
• Dashboard now accessible without an account
• Team plan — 5 seats for €149/month
• Available in 5 languages: EN, FR, ES, AR, ID
• CFR calculated automatically from WHO, ECDC, PAHO & Africa CDC

Thank you for being one of our first users.`,
    voteCta: "Upvote on Product Hunt →",
    dashCta: "Explore the dashboard →",
    closing: "Thank you,<br>David<br>HealthWatch Global",
    unsub: "You're receiving this because you have an account on healthwatch-global.com.",
  },
  fr: {
    subject: "HealthWatch Global est live sur Product Hunt aujourd'hui 🚀",
    headline: "Nous sommes live sur Product Hunt",
    body: `Aujourd'hui, HealthWatch Global lance officiellement sur Product Hunt.

Si vous avez trouvé la plateforme utile pour suivre les foyers épidémiques, votre vote aujourd'hui nous aide énormément — c'est lui qui détermine notre classement dans les premières heures.

Ce qui a changé depuis votre inscription :
• Dashboard accessible sans compte
• Plan Team — 5 sièges à 149 €/mois
• 5 langues : EN, FR, ES, AR, ID
• Taux de létalité calculé automatiquement depuis OMS, ECDC, PAHO et Africa CDC

Merci d'avoir été parmi nos premiers utilisateurs.`,
    voteCta: "Voter sur Product Hunt →",
    dashCta: "Explorer le tableau de bord →",
    closing: "Merci,<br>David<br>HealthWatch Global",
    unsub: "Vous recevez cet email car vous avez un compte sur healthwatch-global.com.",
  },
  es: {
    subject: "HealthWatch Global ya está en Product Hunt 🚀",
    headline: "Estamos en Product Hunt",
    body: `Hoy lanzamos oficialmente HealthWatch Global en Product Hunt.

Si has encontrado útil la plataforma para seguir los brotes, tu voto hoy significaría mucho para nosotros — es lo que determina nuestro ranking en las primeras horas.

Novedades desde que te registraste:
• Panel accesible sin cuenta
• Plan Team — 5 puestos por €149/mes
• Disponible en 5 idiomas: EN, FR, ES, AR, ID
• TLF calculado automáticamente desde OMS, ECDC, PAHO y Africa CDC

Gracias por ser uno de nuestros primeros usuarios.`,
    voteCta: "Votar en Product Hunt →",
    dashCta: "Explorar el panel →",
    closing: "Gracias,<br>David<br>HealthWatch Global",
    unsub: "Recibes este email porque tienes una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "HealthWatch Global متاح الآن على Product Hunt 🚀",
    headline: "نحن مباشر على Product Hunt",
    body: `اليوم أطلقنا رسمياً HealthWatch Global على Product Hunt.

إذا وجدت المنصة مفيدة لتتبع تفشيات الأمراض، فإن تصويتك اليوم سيعني لنا الكثير — إذ يحدد ترتيبنا في الساعات الأولى من الإطلاق.

الجديد منذ تسجيلك:
• لوحة التحكم متاحة بدون حساب
• خطة Team — 5 مقاعد بـ €149 شهرياً
• 5 لغات: EN, FR, ES, AR, ID
• معدل إماتة الحالات محسوب تلقائياً من WHO وECDC وPAHO وAfrica CDC

شكراً لكونك من أوائل مستخدمينا.`,
    voteCta: "صوّت على Product Hunt ←",
    dashCta: "استكشف لوحة التحكم ←",
    closing: "شكراً،<br>David<br>HealthWatch Global",
    unsub: "تتلقى هذا البريد لأن لديك حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "HealthWatch Global kini live di Product Hunt 🚀",
    headline: "Kami live di Product Hunt",
    body: `Hari ini kami resmi meluncurkan HealthWatch Global di Product Hunt.

Jika kamu merasa platform ini berguna untuk memantau wabah, suaramu hari ini sangat berarti bagi kami — itu yang menentukan peringkat kami di jam-jam pertama peluncuran.

Yang baru sejak kamu mendaftar:
• Dashboard bisa diakses tanpa akun
• Paket Team — 5 kursi seharga €149/bulan
• Tersedia dalam 5 bahasa: EN, FR, ES, AR, ID
• CFR dihitung otomatis dari WHO, ECDC, PAHO & Africa CDC

Terima kasih telah menjadi salah satu pengguna pertama kami.`,
    voteCta: "Dukung di Product Hunt →",
    dashCta: "Jelajahi dasbor →",
    closing: "Terima kasih,<br>David<br>HealthWatch Global",
    unsub: "Kamu menerima email ini karena memiliki akun di healthwatch-global.com.",
  },
};

function buildHtml(c: typeof COPY.en, locale: string): string {
  const isRtl = locale === "ar";
  const dir   = isRtl ? "rtl" : "ltr";
  const listPad = isRtl ? "padding-right:20px;padding-left:0" : "padding-left:20px";

  const bodyHtml = c.body
    .split("\n\n")
    .map((para) => {
      const lines = para.split("\n");
      if (lines.every((l) => l.startsWith("•"))) {
        return `<ul style="margin:0 0 16px;${listPad};color:#9ca3af;font-size:15px;line-height:1.7;">${
          lines.map((l) => `<li style="margin-bottom:4px;">${l.replace(/^•\s*/, "")}</li>`).join("")
        }</ul>`;
      }
      return `<p style="margin:0 0 16px;color:#d1d5db;font-size:15px;line-height:1.7;">${lines.join("<br>")}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030712;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:32px;">
          <span style="font-size:18px;font-weight:700;color:#f9fafb;letter-spacing:-0.3px;">
            HealthWatch Global
          </span>
        </td></tr>

        <!-- PH badge -->
        <tr><td style="padding-bottom:24px;">
          <span style="display:inline-flex;align-items:center;gap:8px;background:#ff61541a;color:#ff6154;font-size:13px;font-weight:600;padding:6px 14px;border-radius:999px;border:1px solid #ff615433;">
            🚀 ${c.headline}
          </span>
        </td></tr>

        <!-- Body -->
        <tr><td>${bodyHtml}</td></tr>

        <!-- Primary CTA -->
        <tr><td style="padding:8px 0 16px;">
          <a href="${PH_URL}" style="display:inline-block;background:#ff6154;color:#ffffff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;">
            ${c.voteCta}
          </a>
        </td></tr>

        <!-- Secondary CTA -->
        <tr><td style="padding-bottom:40px;">
          <a href="${DEMO_URL}" style="display:inline-block;background:#1e3a5f;color:#93c5fd;font-size:14px;font-weight:500;padding:12px 24px;border-radius:10px;text-decoration:none;border:1px solid #1e40af;">
            ${c.dashCta}
          </a>
        </td></tr>

        <!-- Divider -->
        <tr><td style="border-top:1px solid #1f2937;padding-top:24px;padding-bottom:16px;">
          <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">${c.closing}</p>
        </td></tr>

        <!-- Unsub -->
        <tr><td>
          <p style="margin:0;font-size:12px;color:#4b5563;">${c.unsub}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildPHLaunchEmail(locale: string): { subject: string; html: string } {
  const c = COPY[locale] ?? COPY.en;
  return { subject: c.subject, html: buildHtml(c, locale) };
}
