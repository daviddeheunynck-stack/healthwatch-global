import { NextRequest, NextResponse } from "next/server";
import { buildWelcomeEmail } from "@/lib/welcome-email";
import { errorMessage } from "@/lib/error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isRealProduction } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

const VALID_LOCALES = ["en", "fr", "es", "ar", "id"];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 welcome emails per IP per hour (prevents spam-by-proxy abuse)
  const ip = getClientIp(req);
  const rl = rateLimit(`send-welcome:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { email, locale: rawLocale } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const locale = VALID_LOCALES.includes(rawLocale) ? rawLocale : "en";

    if (!BREVO_API_KEY || !isRealProduction) {
      console.warn("[send-welcome] BREVO_API_KEY not set or not production — skipping");
      return NextResponse.json({ skipped: true });
    }

    const { subject, html } = buildWelcomeEmail(locale || "en");

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
      Sentry.captureException(new Error(`[send-welcome] Brevo error: ${err}`), { tags: { route: "send-welcome" } });
      return NextResponse.json({ error: "Email delivery failed" }, { status: 502 });
    }

    // Notify founder of new signup (fire-and-forget)
    const adminEmail = clean(process.env.ADMIN_EMAILS)?.split(",")[0];
    if (adminEmail) {
      fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
          to: [{ email: adminEmail }],
          subject: `Nouvel inscrit : ${email}`,
          htmlContent: `<p>Nouvelle inscription sur HealthWatch Global.</p>
            <p><strong>Email :</strong> ${esc(email)}</p>
            <p><strong>Langue :</strong> ${esc(locale || "fr")}</p>
            <p><strong>Date :</strong> ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p>`,
        }),
      }).catch((e) => console.error("[send-welcome] founder notification failed:", e));
    }

    return NextResponse.json({ sent: true });
  } catch (e: unknown) {
    console.error("[send-welcome] unexpected error:", errorMessage(e));
    Sentry.captureException(e, { tags: { route: "send-welcome" } });
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
