import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST(req: NextRequest) {
  try {
    const { name, organization, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "HealthWatch Contact Form", email: "alerts@healthwatch-global.com" },
        to: [{ email: "contact@healthwatch-global.com", name: "David Deheunynck" }],
        replyTo: { email, name },
        subject: `[HealthWatch] New message from ${name} — ${organization || "No org"}`,
        htmlContent: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#dc2626;">New contact from HealthWatch Global</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;color:#6b7280;width:130px;">Name</td><td style="padding:8px;font-weight:600;">${name}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;">Organization</td><td style="padding:8px;">${organization || "—"}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
            </table>
            <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid #dc2626;">
              <p style="margin:0;white-space:pre-line;">${message}</p>
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
  } catch (err: any) {
    console.error("Contact route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
