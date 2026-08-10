import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyPilotToken } from "@/lib/pilot-token";
import { APP_URL, sendEmail, buildConfirmationEmail } from "@/lib/pilot-emails";
import { enrollAlertRegions } from "@/lib/activate-trial";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();

const VALID_LOCALES = ["en", "fr", "es", "ar", "id"];

// Reached only via the signed link emailed by POST /api/pilot — see
// lib/pilot-token.ts for why this had to move out of the original
// unauthenticated POST handler.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`pilot-confirm:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("id") ?? "";
  const expiresAt = Number(searchParams.get("exp"));
  const token = searchParams.get("token") ?? "";
  const rawLocale = searchParams.get("locale") ?? "en";
  const locale = VALID_LOCALES.includes(rawLocale) ? rawLocale : "en";
  const organization = (searchParams.get("org") ?? "").trim().slice(0, 120);
  // Verified against the exact string the token signs — trimmed/capped the same
  // way POST /api/pilot did before signing, but not yet defaulted to "there".
  // Applying the display fallback before verification would make a genuinely
  // empty name fail against a signature computed over "".
  const rawName = (searchParams.get("name") ?? "").trim().slice(0, 120);

  if (!profileId || !verifyPilotToken(profileId, expiresAt, organization, rawName, token)) {
    // Expired, tampered, or already-used-past-window link — send back to the
    // application page rather than a bare error; the applicant can reapply.
    return NextResponse.redirect(`${APP_URL}/${locale}/pilot?expired=1`);
  }

  const name = rawName || "there";

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  // Re-fetch fresh state at click-time — plan/subscription may have changed
  // since the email was sent (e.g. the user subscribed directly in the
  // interim). Never let a stale link downgrade an existing paid customer.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_subscription_id, is_pilot")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.redirect(`${APP_URL}/${locale}/pilot?expired=1`);
  }

  const higherPlan = profile.stripe_subscription_id || profile.plan === "team" || profile.plan === "enterprise";
  if (higherPlan) {
    return NextResponse.redirect(`${APP_URL}/${locale}`);
  }

  // Idempotent: a double-click, or an email-security scanner prefetching the
  // link, must not repeatedly reset the 35-day trial window.
  if (!profile.is_pilot) {
    const trialEndsAt = new Date(Date.now() + 35 * 86_400_000).toISOString();
    await supabase
      .from("profiles")
      .update({
        plan: "pro",
        trial_ends_at: trialEndsAt,
        is_pilot: true,
        pilot_organization: organization || null,
      })
      .eq("id", profile.id);

    // Default-enroll into regional alerts (opt-out, not opt-in) — same helper as
    // the standard activate-trial and admin-invite paths (lib/activate-trial.ts).
    // Without this a Pilot user gets Pro access but no alert ever fires, so
    // re-engagement emails never reach them and they never come back.
    // Best-effort: a failure here must not block activation itself.
    await enrollAlertRegions(supabase, profile.id, "pilot/confirm");

    // Activation has already committed above — a Brevo hiccup here must not
    // turn a real, successful activation into a broken redirect for the user.
    const confirmSubject: Record<string, string> = {
      fr: "HealthWatch Global — Votre accès Pilot est actif",
      en: "HealthWatch Global — Your Pilot access is now active",
      es: "HealthWatch Global — Tu acceso Pilot está activo",
      ar: "HealthWatch Global — تم تفعيل وصولك للبرنامج التجريبي",
      id: "HealthWatch Global — Akses Pilot Anda sudah aktif",
    };
    if (profile.email) {
      try {
        await sendEmail(
          profile.email,
          name,
          confirmSubject[locale] ?? confirmSubject.en,
          buildConfirmationEmail(name, locale)
        );
      } catch (emailErr) {
        console.error("[pilot/confirm] confirmation email failed:", emailErr);
        Sentry.captureException(emailErr, { tags: { route: "pilot/confirm", part: "confirmation-email" } });
      }
    }
  }

  return NextResponse.redirect(`${APP_URL}/${locale}`);
}
