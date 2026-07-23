import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isRealProduction } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sendEmail(
  to: string,
  toName: string,
  subject: string,
  html: string,
  replyTo?: { email: string; name: string }
) {
  if (!isRealProduction) return;
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

function buildAckEmail(name: string, locale: string): string {
  const COPY: Record<string, { heading: string; body: string; note: string }> = {
    en: {
      heading: "We received your signal",
      body: `Hi ${esc(name)},<br><br>Thanks for flagging this. Someone from HealthWatch Global will personally follow up, usually within 24 hours.`,
      note: "This isn't a formal report and we won't ask you to confirm anything further unless you want to. We appreciate you taking the time.",
    },
    fr: {
      heading: "Votre signal a bien été reçu",
      body: `Bonjour ${esc(name)},<br><br>Merci d'avoir signalé cela. Quelqu'un de HealthWatch Global reviendra vers vous personnellement, en général sous 24 heures.`,
      note: "Ce n'est pas un rapport formel et nous ne vous demanderons rien de plus, sauf si vous le souhaitez. Merci d'avoir pris le temps.",
    },
    es: {
      heading: "Hemos recibido tu señal",
      body: `Hola ${esc(name)},<br><br>Gracias por avisar. Alguien de HealthWatch Global se pondrá en contacto contigo personalmente, normalmente en menos de 24 horas.`,
      note: "Esto no es un informe formal y no te pediremos nada más a menos que tú quieras. Gracias por tu tiempo.",
    },
    ar: {
      heading: "تم استلام إشارتك",
      body: `مرحباً ${esc(name)}،<br><br>شكراً على الإبلاغ. سيتواصل معك شخص من HealthWatch Global شخصياً، عادةً خلال 24 ساعة.`,
      note: "هذا ليس تقريراً رسمياً ولن نطلب منك أي تأكيد إضافي إلا إذا رغبت في ذلك. نقدّر وقتك.",
    },
    id: {
      heading: "Sinyal Anda telah kami terima",
      body: `Halo ${esc(name)},<br><br>Terima kasih telah melaporkan hal ini. Seseorang dari HealthWatch Global akan menindaklanjuti secara pribadi, biasanya dalam 24 jam.`,
      note: "Ini bukan laporan resmi dan kami tidak akan meminta konfirmasi lebih lanjut kecuali Anda menginginkannya. Terima kasih atas waktu Anda.",
    },
  };
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#16a34a;padding:16px 24px;">
    <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">HealthWatch Global — Field Signal</p>
  </td></tr>
  <tr><td style="background:#1e293b;padding:28px 24px;border:1px solid #334155;border-top:0;">
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">${c.heading}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">${c.body}</p>
    <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${c.note}</p>
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
  location: string,
  message: string
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#16a34a;padding:16px 24px;">
    <p style="margin:0;font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">HealthWatch Global — Nouveau signal terrain</p>
  </td></tr>
  <tr><td style="background:#1e293b;padding:28px 24px;border:1px solid #334155;border-top:0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:130px;font-family:Arial,Helvetica,sans-serif;">Nom</td><td style="padding:8px 0;color:#f1f5f9;font-weight:600;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${esc(name)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Organisation / rôle</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${esc(organization || "—")}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Email</td><td style="padding:8px 0;font-size:13px;font-family:Arial,Helvetica,sans-serif;"><a href="mailto:${esc(email)}" style="color:#60a5fa;text-decoration:none;">${esc(email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Localisation</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${esc(location)}</td></tr>
    </table>
    <div style="border-left:4px solid #16a34a;padding:12px 16px;background:#ffffff08;margin-top:16px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${esc(message)}</p>
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
  const rl = rateLimit(`field-signal:${ip}`, { limit: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const { name, organization, email, location, message, locale } = await req.json();

    if (!name || !email || !location || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const userLocale = (locale as string) || "en";

    // David's notification goes first: even if the submitter's ack email fails
    // (bad address, transient Brevo error), the signal itself must still land.
    await sendEmail(
      "david.deheunynck@gmail.com",
      "David Deheunynck",
      `[SIGNAL 🟢] ${name} — ${location}`,
      buildDavidNotification(name, organization, email, location, message),
      { email, name }
    );

    const ackSubject: Record<string, string> = {
      en: "HealthWatch Global — We received your signal",
      fr: "HealthWatch Global — Votre signal a bien été reçu",
      es: "HealthWatch Global — Hemos recibido tu señal",
      ar: "HealthWatch Global — تم استلام إشارتك",
      id: "HealthWatch Global — Sinyal Anda telah kami terima",
    };
    await sendEmail(
      email,
      name,
      ackSubject[userLocale] ?? ackSubject.en,
      buildAckEmail(name, userLocale)
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Field-signal route error:", err);
    Sentry.captureException(err, { tags: { route: "field-signal" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
