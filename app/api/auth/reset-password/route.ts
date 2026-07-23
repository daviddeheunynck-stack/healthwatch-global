import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildResetPasswordEmail } from "@/lib/reset-password-email";
import { errorMessage } from "@/lib/error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isRealProduction } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

const VALID_LOCALES = ["en", "fr", "es", "ar", "id"];

// Supabase's own Auth mailer (default or dashboard SMTP) is unreliable for
// recovery emails to some providers (Gmail in particular — see the Zahra
// Bouzidi case, July 2026: account confirmed but zero successful sign-ins,
// recovery emails never arrived). This route bypasses it entirely: generate
// the recovery link server-side via the admin API, then send it through the
// Brevo transport already used for every other transactional email in the
// app (send-welcome, admin/invite, etc).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`reset-password:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { email, locale: rawLocale } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const locale = VALID_LOCALES.includes(rawLocale) ? rawLocale : "fr";

    const admin = createServiceClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL) || "https://healthwatch-global.com";
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/${locale}/reset-password` },
    });

    // Don't leak whether an account exists for this email — always report
    // success to the caller, but capture unexpected failures for visibility.
    if (linkErr || !linkData?.properties?.action_link) {
      if (linkErr && !/not.?found/i.test(linkErr.message)) {
        Sentry.captureException(new Error(`[reset-password] generateLink error: ${linkErr.message}`), {
          tags: { route: "reset-password" },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (!BREVO_API_KEY || !isRealProduction) {
      if (!BREVO_API_KEY) {
        console.warn("[reset-password] BREVO_API_KEY not set — skipping send");
        Sentry.captureException(new Error("[reset-password] BREVO_API_KEY not set"), { tags: { route: "reset-password" } });
      }
      return NextResponse.json({ success: true });
    }

    const { subject, html } = buildResetPasswordEmail(locale, linkData.properties.action_link);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const err = await brevoRes.text();
      console.error("[reset-password] Brevo error:", err);
      Sentry.captureException(new Error(`[reset-password] Brevo error: ${err}`), { tags: { route: "reset-password" } });
    }

    // Always report success — matches the anti-enumeration behavior the
    // forgot-password page already had with supabase.auth.resetPasswordForEmail.
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("[reset-password] unexpected error:", errorMessage(e));
    Sentry.captureException(e, { tags: { route: "reset-password" } });
    return NextResponse.json({ success: true });
  }
}
