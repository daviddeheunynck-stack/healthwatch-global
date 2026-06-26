import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const APP_URL = "https://healthwatch-global.com";

async function sendEmail(
  to: string,
  toName: string,
  subject: string,
  html: string,
  replyTo?: { email: string; name: string }
) {
  const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");
  const body: Record<string, unknown> = {
    sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent: html,
  };
  if (replyTo) body.replyTo = replyTo;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

function buildConfirmationEmail(name: string, locale: string): string {
  const COPY: Record<string, { heading: string; body: string; cta: string; note: string }> = {
    fr: {
      heading: "Votre accès Pilot est activé",
      body: `Bonjour ${esc(name)},<br><br>Votre demande a été approuvée. Votre compte bénéficie maintenant d'un accès Pro complet pendant <strong>35 jours</strong> — sans carte bancaire requise.`,
      cta: "Accéder à mon tableau de bord →",
      note: "L'accès Pilot inclut toutes les fonctionnalités Pro : alertes régionales, alertes maladies, exports et intégrations Slack/Teams.",
    },
    en: {
      heading: "Your Pilot access is now active",
      body: `Hello ${esc(name)},<br><br>Your application has been approved. Your account now has full Pro access for <strong>35 days</strong> — no credit card required.`,
      cta: "Go to my dashboard →",
      note: "Pilot access includes all Pro features: regional alerts, disease alerts, exports, and Slack/Teams integrations.",
    },
    es: {
      heading: "Tu acceso Pilot está activo",
      body: `Hola ${esc(name)},<br><br>Tu solicitud ha sido aprobada. Tu cuenta tiene ahora acceso Pro completo durante <strong>35 días</strong>, sin tarjeta de crédito.`,
      cta: "Ir a mi panel →",
      note: "El acceso Pilot incluye todas las funciones Pro: alertas regionales, alertas de enfermedades, exportaciones e integraciones.",
    },
    ar: {
      heading: "تم تفعيل وصولك للبرنامج التجريبي",
      body: `مرحباً ${esc(name)}،<br><br>تمت الموافقة على طلبك. يتمتع حسابك الآن بإمكانية وصول Pro كاملة لمدة <strong>35 يوماً</strong> — دون بطاقة ائتمان.`,
      cta: "← الانتقال إلى لوحتي",
      note: "يشمل وصول البرنامج التجريبي جميع ميزات Pro: التنبيهات الإقليمية والأمراض والتصديرات والتكاملات.",
    },
    id: {
      heading: "Akses Pilot Anda sudah aktif",
      body: `Halo ${esc(name)},<br><br>Permohonan Anda telah disetujui. Akun Anda sekarang memiliki akses Pro penuh selama <strong>35 hari</strong> — tanpa kartu kredit.`,
      cta: "Buka dasbor saya →",
      note: "Akses Pilot mencakup semua fitur Pro: peringatan regional, peringatan penyakit, ekspor, dan integrasi Slack/Teams.",
    },
  };

  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const dashUrl = `${APP_URL}/${locale}`;

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#dc2626;padding:16px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">HealthWatch Global</td>
      <td align="right" style="color:#fca5a5;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Pilot Programme</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#1e293b;padding:28px 24px;border:1px solid #334155;border-top:0;">
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">${c.heading}</p>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">${c.body}</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:#dc2626;padding:12px 28px;">
        <a href="${dashUrl}" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${c.cta}</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${c.note}</p>
  </td></tr>
  <tr><td style="padding:16px 0;text-align:center;">
    <p style="color:#334155;font-size:11px;margin:0;font-family:Arial,Helvetica,sans-serif;">healthwatch-global.com</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildSignupPromptEmail(name: string, locale: string): string {
  const COPY: Record<string, { heading: string; body: string; cta: string; note: string }> = {
    fr: {
      heading: "Créez votre compte pour activer votre accès",
      body: `Bonjour ${esc(name)},<br><br>Nous avons bien reçu votre demande Pilot — mais aucun compte n'est associé à cette adresse email.<br><br>Créez votre compte gratuitement, puis répondez à cet email : nous activerons votre accès de <strong>35 jours</strong> immédiatement.`,
      cta: "Créer mon compte →",
      note: "L'inscription est gratuite et ne nécessite pas de carte bancaire.",
    },
    en: {
      heading: "Create your account to activate access",
      body: `Hello ${esc(name)},<br><br>We received your Pilot application — but no account is linked to this email address.<br><br>Create a free account, then reply to this email: we'll activate your <strong>35-day</strong> access immediately.`,
      cta: "Create my account →",
      note: "Registration is free and requires no credit card.",
    },
    es: {
      heading: "Crea tu cuenta para activar el acceso",
      body: `Hola ${esc(name)},<br><br>Recibimos tu solicitud Pilot, pero no encontramos ninguna cuenta vinculada a este correo.<br><br>Crea una cuenta gratuita y luego responde a este email: activaremos tu acceso de <strong>35 días</strong> de inmediato.`,
      cta: "Crear mi cuenta →",
      note: "El registro es gratuito y no requiere tarjeta de crédito.",
    },
    ar: {
      heading: "أنشئ حسابك لتفعيل وصولك",
      body: `مرحباً ${esc(name)}،<br><br>تلقينا طلبك للبرنامج التجريبي، لكننا لم نجد حساباً مرتبطاً بهذا البريد الإلكتروني.<br><br>أنشئ حساباً مجانياً ثم رد على هذا البريد: سنفعّل وصولك لمدة <strong>35 يوماً</strong> فوراً.`,
      cta: "← إنشاء حسابي",
      note: "التسجيل مجاني ولا يتطلب بطاقة ائتمان.",
    },
    id: {
      heading: "Buat akun untuk mengaktifkan akses",
      body: `Halo ${esc(name)},<br><br>Kami menerima permohonan Pilot Anda — tetapi tidak ada akun yang terhubung ke email ini.<br><br>Buat akun gratis, lalu balas email ini: kami akan mengaktifkan akses <strong>35 hari</strong> Anda segera.`,
      cta: "Buat akun saya →",
      note: "Pendaftaran gratis dan tidak memerlukan kartu kredit.",
    },
  };

  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const signupUrl = `${APP_URL}/${locale}/signup`;

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#dc2626;padding:16px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">HealthWatch Global</td>
      <td align="right" style="color:#fca5a5;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Pilot Programme</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#1e293b;padding:28px 24px;border:1px solid #334155;border-top:0;">
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">${c.heading}</p>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">${c.body}</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:#dc2626;padding:12px 28px;">
        <a href="${signupUrl}" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${c.cta}</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${c.note}</p>
  </td></tr>
  <tr><td style="padding:16px 0;text-align:center;">
    <p style="color:#334155;font-size:11px;margin:0;font-family:Arial,Helvetica,sans-serif;">healthwatch-global.com</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildDavidNotification(
  name: string,
  organization: string,
  email: string,
  role: string,
  teamSize: string,
  useCase: string,
  activated: boolean
): string {
  const statusBadge = activated
    ? `<div style="display:inline-block;background:#14532d;border:1px solid #16a34a;padding:4px 12px;margin-bottom:20px;"><p style="margin:0;font-size:11px;font-weight:700;color:#86efac;text-transform:uppercase;letter-spacing:.1em;">✅ Accès activé automatiquement</p></div>`
    : `<div style="display:inline-block;background:#7f1d1d;border:1px solid #dc2626;padding:4px 12px;margin-bottom:20px;"><p style="margin:0;font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.1em;">⚠️ Compte introuvable — activation manuelle requise</p></div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#dc2626;padding:16px 24px;">
    <p style="margin:0;font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">HealthWatch Global — Candidature Pilot</p>
  </td></tr>
  <tr><td style="background:#1e293b;padding:28px 24px;border:1px solid #334155;border-top:0;">
    ${statusBadge}
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:130px;font-family:Arial,Helvetica,sans-serif;">Nom</td><td style="padding:8px 0;color:#f1f5f9;font-weight:600;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${esc(name)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Organisation</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${esc(organization || "—")}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Email</td><td style="padding:8px 0;font-size:13px;font-family:Arial,Helvetica,sans-serif;"><a href="mailto:${esc(email)}" style="color:#60a5fa;text-decoration:none;">${esc(email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Rôle</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${esc(role || "—")}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Taille équipe</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${esc(teamSize || "—")}</td></tr>
    </table>
    <div style="border-left:4px solid #dc2626;padding:12px 16px;background:#ffffff08;margin-top:16px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${esc(useCase || "—")}</p>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`pilot:${ip}`, { limit: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const { name, organization, email, role, teamSize, useCase, locale } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );

    // Look up profile by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, locale")
      .eq("email", email)
      .maybeSingle();

    let activated = false;

    if (profile) {
      // Activate 35-day Pro trial
      const trialEndsAt = new Date(Date.now() + 35 * 86_400_000).toISOString();
      await supabase
        .from("profiles")
        .update({ plan: "pro", trial_ends_at: trialEndsAt })
        .eq("id", profile.id);

      const userLocale = (locale as string) || profile.locale || "en";
      await sendEmail(
        email,
        name,
        userLocale === "fr"
          ? "HealthWatch Global — Votre accès Pilot est actif"
          : "HealthWatch Global — Your Pilot access is now active",
        buildConfirmationEmail(name, userLocale)
      );
      activated = true;
    } else {
      // No account — prompt signup
      const userLocale = (locale as string) || "en";
      await sendEmail(
        email,
        name,
        userLocale === "fr"
          ? "HealthWatch Global — Créez votre compte pour activer votre accès Pilot"
          : "HealthWatch Global — Create your account to activate Pilot access",
        buildSignupPromptEmail(name, userLocale)
      );
    }

    // Always notify David
    await sendEmail(
      "david.deheunynck@gmail.com",
      "David Deheunynck",
      `[PILOT 🔴] ${name} — ${organization || email}`,
      buildDavidNotification(name, organization, email, role, teamSize, useCase, activated),
      { email, name }
    );

    return NextResponse.json({ success: true, activated });
  } catch (err: unknown) {
    console.error("Pilot route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
