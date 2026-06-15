import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
        subject: `[HealthWatch] ${l.subject} ${name} — ${organization || l.noOrg}`,
        htmlContent: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;" dir="${locale === "ar" ? "rtl" : "ltr"}">
            <h2 style="color:#dc2626;">${l.heading}</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;color:#6b7280;width:130px;">${l.nameLabel}</td><td style="padding:8px;font-weight:600;">${esc(name)}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;">${l.orgLabel}</td><td style="padding:8px;">${esc(organization || l.noOrg)}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;">${l.emailLabel}</td><td style="padding:8px;"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
            </table>
            <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid #dc2626;">
              <p style="margin:0;white-space:pre-line;">${esc(message)}</p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Brevo contact error:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    // Logging `err` itself (not just .message) preserves the stack trace for Error objects
    console.error("Contact route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
