import { NextRequest, NextResponse } from "next/server";
import { buildWelcomeEmail } from "@/lib/welcome-email";
import { errorMessage } from "@/lib/error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isRealProduction, claimEmailSend } from "@/lib/cron-monitor";
import { getServiceClient } from "@/lib/supabase-service";
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
  const rl = await rateLimit(`send-welcome:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { email, locale: rawLocale } = await req.json();

    // Format-validated like every other public route that triggers a send
    // (subscribe, team/invite, org/invite, country-risk-alerts, ...): this
    // one only checked "non-empty string", so any string at all reached both
    // the profiles lookup below and Brevo's `to:` field.
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const locale = VALID_LOCALES.includes(rawLocale) ? rawLocale : "en";

    if (!BREVO_API_KEY || !isRealProduction) {
      console.warn("[send-welcome] BREVO_API_KEY not set or not production, skipping");
      return NextResponse.json({ skipped: true });
    }

    // No dedup was possible before this: both real callers (signup/page.tsx
    // right after signUp(), auth/callback/route.ts for OAuth signups) always
    // have a real profiles row by the time they call this, created
    // synchronously by the on_auth_user_created trigger, so this lookup
    // should always resolve. Claimed the same way as the other one-shot
    // lifecycle emails (claimEmailSend, lifecycle_email_log) rather than a
    // new table, since this genuinely is a once-per-account send. If no
    // profile matches (a request outside the two real call sites), proceed
    // without dedup rather than silently dropping a legitimate welcome
    // email over an identity-lookup miss.
    // `%` and `_` are LIKE wildcards, not literals: passing an unescaped
    // caller-supplied string to .ilike() let an unauthenticated request match
    // a profile whose address it doesn't know (e.g. "d%@example.com") and burn
    // that person's one-shot "welcome" claim below, so their real signup would
    // never send them a welcome email. Escaped rather than switched to .eq()
    // to keep the case-insensitive match this lookup needs — and `_` is a
    // legitimate character in real addresses (john_doe@...), so escaping is
    // required even setting abuse aside.
    const emailPattern = email.replace(/[\\%_]/g, "\\$&");
    const { data: profile } = await getServiceClient()
      .from("profiles")
      .select("id")
      .ilike("email", emailPattern)
      .maybeSingle();
    if (profile) {
      const claimed = await claimEmailSend(getServiceClient(), profile.id, "send-welcome", "welcome");
      if (!claimed) {
        console.log("[send-welcome] already sent for", email, "skipping duplicate");
        return NextResponse.json({ skipped: true, reason: "already-sent" });
      }
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
      }).catch((e) => {
        console.error("[send-welcome] founder notification failed:", e);
        Sentry.captureException(e, { tags: { route: "send-welcome", part: "founder-notification" } });
      });
    }

    return NextResponse.json({ sent: true });
  } catch (e: unknown) {
    console.error("[send-welcome] unexpected error:", errorMessage(e));
    Sentry.captureException(e, { tags: { route: "send-welcome" } });
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
