import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { buildPilotConfirmToken } from "@/lib/pilot-token";
import {
  APP_URL,
  sendEmail,
  buildConfirmRequestEmail,
  buildSignupPromptEmail,
  buildDavidNotification,
} from "@/lib/pilot-emails";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();

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
    const { name, organization: rawOrganization, email, role, teamSize, useCase, locale } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    // Unauthenticated form — never trust type/length of free-text fields before persisting.
    const organization = typeof rawOrganization === "string" ? rawOrganization.trim().slice(0, 120) : "";

    const supabase = createClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );

    // Look up profile by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, locale, plan, stripe_subscription_id")
      .eq("email", email)
      .maybeSingle();

    let pendingConfirmation = false;
    // This form is unauthenticated — anyone who knows a registered user's email can
    // reach this branch. Never let it downgrade an existing paying customer: a team/
    // enterprise plan, or any plan backed by an active Stripe subscription, must be
    // left untouched. Only a free-tier account (no active subscription) is eligible
    // for the 35-day Pro pilot trial.
    const higherPlan = profile?.stripe_subscription_id || profile?.plan === "team" || profile?.plan === "enterprise";

    if (profile && !higherPlan) {
      // Don't activate here — this POST is reachable by anyone who knows the
      // applicant's email, not just the applicant. Email a signed, expiring
      // confirmation link instead (see lib/pilot-token.ts); the actual trial
      // activation happens in /api/pilot/confirm, only reachable by whoever
      // controls that inbox.
      const { token, expiresAt } = buildPilotConfirmToken(profile.id);
      const userLocale = (locale as string) || profile.locale || "en";
      const confirmUrl =
        `${APP_URL}/api/pilot/confirm?id=${encodeURIComponent(profile.id)}` +
        `&exp=${expiresAt}&token=${token}` +
        `&org=${encodeURIComponent(organization)}&locale=${encodeURIComponent(userLocale)}` +
        `&name=${encodeURIComponent(name)}`;

      const confirmSubject: Record<string, string> = {
        fr: "HealthWatch Global — Confirmez votre accès Pilot",
        en: "HealthWatch Global — Confirm your Pilot access",
        es: "HealthWatch Global — Confirma tu acceso Pilot",
        ar: "HealthWatch Global — أكّد وصولك للبرنامج التجريبي",
        id: "HealthWatch Global — Konfirmasi akses Pilot Anda",
      };
      pendingConfirmation = true;
      try {
        await sendEmail(
          email,
          name,
          confirmSubject[userLocale] ?? confirmSubject.en,
          buildConfirmRequestEmail(name, userLocale, confirmUrl)
        );
      } catch (emailErr) {
        console.error("[pilot] confirm-request email failed:", emailErr);
        Sentry.captureException(emailErr, { tags: { route: "pilot", part: "confirm-request-email" } });
      }
    } else if (!profile) {
      // No account — prompt signup
      const userLocale = (locale as string) || "en";
      const signupSubject: Record<string, string> = {
        fr: "HealthWatch Global — Créez votre compte pour activer votre accès Pilot",
        en: "HealthWatch Global — Create your account to activate Pilot access",
        es: "HealthWatch Global — Crea tu cuenta para activar el acceso Pilot",
        ar: "HealthWatch Global — أنشئ حسابك لتفعيل وصول البرنامج التجريبي",
        id: "HealthWatch Global — Buat akun untuk mengaktifkan akses Pilot",
      };
      try {
        await sendEmail(
          email,
          name,
          signupSubject[userLocale] ?? signupSubject.en,
          buildSignupPromptEmail(name, userLocale)
        );
      } catch (emailErr) {
        console.error("[pilot] signup-prompt email failed:", emailErr);
        Sentry.captureException(emailErr, { tags: { route: "pilot", part: "signup-prompt-email" } });
      }
    }
    // else: profile exists but is already on a paying/team/enterprise plan — leave
    // it untouched and skip any auto-reply to the applicant; David reviews manually
    // via the notification below.

    // Always notify David (best-effort — the applicant-facing outcome above is
    // already final by this point, a failed internal notification shouldn't
    // turn a successful submission into a 500 for the applicant).
    try {
      await sendEmail(
        "david.deheunynck@gmail.com",
        "David Deheunynck",
        `[PILOT 🔴] ${name} — ${organization || email}`,
        buildDavidNotification(
          name, organization, email, role, teamSize, useCase,
          pendingConfirmation ? "pending-confirmation" : !profile ? "no-account" : "already-higher-plan"
        ),
        { email, name }
      );
    } catch (emailErr) {
      console.error("[pilot] David notification email failed:", emailErr);
      Sentry.captureException(emailErr, { tags: { route: "pilot", part: "david-notification-email" } });
    }

    return NextResponse.json({ success: true, pendingConfirmation });
  } catch (err: unknown) {
    console.error("Pilot route error:", err);
    Sentry.captureException(err, { tags: { route: "pilot" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
