import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(req: NextRequest) {
  // ── Rate limiting: 3 messages per IP per 10 minutes ─────────────────────────
  const ip = getClientIp(req);
  const rl = rateLimit(`contact:${ip}`, { limit: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait a few minutes before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "3",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const L: Record<string, { subject: string; heading: string; nameLabel: string; orgLabel: string; emailLabel: string; noOrg: string }> = {
    fr: { subject: "Nouveau message de",    heading: "Nouveau contact HealthWatch Global", nameLabel: "Nom",          orgLabel: "Organisation", emailLabel: "Email", noOrg: "—" },
    en: { subject: "New message from",      heading: "New contact from HealthWatch Global", nameLabel: "Name",         orgLabel: "Organization", emailLabel: "Email", noOrg: "—" },
    es: { subject: "Nuevo mensaje de",      heading: "Nuevo contacto HealthWatch Global",   nameLabel: "Nombre",       orgLabel: "Organización", emailLabel: "Email", noOrg: "—" },
    ar: { subject: "رسالة جديدة من",        heading: "جهة اتصال جديدة عبر HealthWatch Global", nameLabel: "الاسم",   orgLabel: "المنظمة",      emailLabel: "البريد الإلكتروني", noOrg: "—" },
    id: { subject: "Pesan baru dari",       heading: "Kontak baru dari HealthWatch Global",  nameLabel: "Nama",        orgLabel: "Organisasi",   emailLabel: "Email", noOrg: "—" },
  };

  try {
    const { name, organization, email, message, locale } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const l = L[locale] ?? L.fr;
    const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);
    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: "Email service unavailable" }, { status: 503 });
    }

    const isPilot = typeof message === "string" && message.startsWith("[PILOT APPLICATION]");
    const subjectPrefix = isPilot ? "[PILOT 🔴]" : "[HealthWatch]";
    const isRtl = locale === "ar";

    const htmlContent = `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>HealthWatch Global</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#dc2626;padding:20px 32px;">
          <p style="margin:0;font-size:20px;font-weight:800;color:white;letter-spacing:-0.5px;">HealthWatch Global</p>
          <p style="margin:4px 0 0;font-size:12px;color:#fca5a5;text-transform:uppercase;letter-spacing:.1em;">Disease Outbreak Surveillance</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${isPilot ? `<div style="display:inline-block;background:#7f1d1d;border:1px solid #dc2626;border-radius:6px;padding:4px 12px;margin-bottom:20px;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.1em;">🔴 Pilot Application</p>
          </div>` : ""}
          <h2 style="margin:0 0 24px;font-size:18px;font-weight:700;color:#f1f5f9;">${l.heading}</h2>
          <div style="background:#0f172a;border-radius:12px;padding:20px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;width:130px;">${l.nameLabel}</td>
                <td style="padding:8px 0;color:#f1f5f9;font-weight:600;font-size:13px;">${esc(name)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;">${l.orgLabel}</td>
                <td style="padding:8px 0;color:#f1f5f9;font-size:13px;">${esc(organization || l.noOrg)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;">${l.emailLabel}</td>
                <td style="padding:8px 0;font-size:13px;"><a href="mailto:${esc(email)}" style="color:#60a5fa;text-decoration:none;">${esc(email)}</a></td>
              </tr>
            </table>
          </div>
          <div style="border-left:4px solid #dc2626;padding:16px 20px;background:#ffffff08;border-radius:0 8px 8px 0;">
            <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;white-space:pre-line;">${esc(message)}</p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#0f172a;text-align:center;">
          <a href="https://healthwatch-global.com" style="color:#64748b;font-size:12px;text-decoration:none;">healthwatch-global.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "HealthWatch Contact Form", email: "alerts@healthwatch-global.com" },
        to: [{ email: "david.deheunynck@gmail.com", name: "David Deheunynck" }],
        replyTo: { email, name },
        subject: `${subjectPrefix} ${l.subject} ${name} — ${organization || l.noOrg}`,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Brevo contact error:", err);
      // This form also receives pilot applications ([PILOT 🔴] prefix) — a
      // lost send here was previously invisible everywhere except Vercel
      // logs, unlike every other Brevo call site in the app.
      Sentry.captureException(new Error(`[contact] Brevo error: ${err}`), { tags: { route: "contact", isPilot: String(isPilot) } });
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    // Logging `err` itself (not just .message) preserves the stack trace for Error objects
    console.error("Contact route error:", err);
    Sentry.captureException(err, { tags: { route: "contact" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
