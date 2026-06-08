import { NextRequest, NextResponse } from "next/server";
import { buildWelcomeEmail } from "@/lib/welcome-email";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email, locale } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    if (!BREVO_API_KEY) {
      console.warn("[send-welcome] BREVO_API_KEY not set — skipping");
      return NextResponse.json({ skipped: true });
    }

    const { subject, html } = buildWelcomeEmail(locale || "fr");

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[send-welcome] Brevo error:", err);
      return NextResponse.json({ error: "Email delivery failed" }, { status: 502 });
    }

    return NextResponse.json({ sent: true });
  } catch (e: unknown) {
    console.error("[send-welcome] unexpected error:", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
