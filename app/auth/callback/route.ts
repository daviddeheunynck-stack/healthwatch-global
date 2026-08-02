import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { activateTrial } from "@/lib/activate-trial";

const VALID_LOCALES = ["en", "fr", "es", "ar", "id"];

function localeFromNext(next: string): string | null {
  const parts = next.split("/").filter(Boolean);
  const first = parts[0];
  return first && VALID_LOCALES.includes(first) ? first : null;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Capture error forwarded by Google/Supabase (e.g. access_denied, redirect_uri_mismatch)
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");
  if (oauthError) {
    console.error("[auth/callback] OAuth error received:", oauthError, oauthErrorDesc);
    const nextParam = searchParams.get("next") ?? "";
    const errorLocale = nextParam.split("/").filter(Boolean)[0] ?? "en";
    const safeLocale2 = VALID_LOCALES.includes(errorLocale) ? errorLocale : "en";
    return NextResponse.redirect(
      `${origin}/${safeLocale2}/login?error=oauth&reason=${encodeURIComponent(oauthError)}`
    );
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", error.message, error.status);
      const nextParam2 = searchParams.get("next") ?? "";
      const errLocale = nextParam2.split("/").filter(Boolean)[0] ?? "en";
      const safeErrLocale = VALID_LOCALES.includes(errLocale) ? errLocale : "en";
      return NextResponse.redirect(
        `${origin}/${safeErrLocale}/login?error=oauth&reason=${encodeURIComponent(error.message)}`
      );
    }
    if (!error && user) {
      try {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: profile } = await admin
          .from("profiles")
          .select("locale")
          .eq("id", user.id)
          .single();

        // Activate 14-day Pro trial for users who never had one — routed through
        // the same helper as /api/activate-trial (see lib/activate-trial.ts) so
        // OAuth signups get the same regional-alert enrollment + signup digest as
        // email signups. Before 2026-08-01 this set plan/trial_ends_at inline
        // without enrolling, which also permanently blocked enrollment afterwards
        // (activate-trial's idempotence guard treats any trial_ends_at as already handled).
        let isNewSignup = false;
        try {
          const result = await activateTrial(admin, user);
          isNewSignup = result.activated;
        } catch (err) {
          console.error("[auth/callback] trial activation failed:", err);
          Sentry.captureException(err, { tags: { user_id: user.id } });
          await Sentry.flush(2000);
        }

        // Save locale for signups that bypass (or lose the race with) the
        // client-side write in signup/page.tsx: OAuth users, and email/password
        // users whose confirmation link lands here before any session ever
        // existed for that first write to pass RLS. Gated on isNewSignup, not
        // `!profile?.locale` (the old check) — profiles.locale has carried a
        // DEFAULT 'fr' since migration 20240108000000, so a freshly-created
        // profile already reads as non-null here and that guard never actually
        // fired, silently leaving alert_locale stuck on its own DEFAULT 'en'
        // regardless of the account's real signup locale.
        const inferredLocale = localeFromNext(next);
        const localeUpdates: Record<string, unknown> = {};
        if (isNewSignup && inferredLocale) {
          localeUpdates.locale = inferredLocale;
          localeUpdates.alert_locale = inferredLocale;
        }

        if (Object.keys(localeUpdates).length > 0) {
          await admin.from("profiles").update(localeUpdates).eq("id", user.id);
        }

        // Send welcome email only for OAuth signups — email/password users already
        // receive it from signup/page.tsx immediately after form submission.
        const isOAuth = user.app_metadata?.provider !== "email";
        if (isNewSignup && isOAuth && user.email) {
          const emailLocale = (localeUpdates.locale as string | undefined) ?? profile?.locale ?? inferredLocale ?? "en";
          fetch(`${origin}/api/send-welcome`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, locale: emailLocale }),
          }).catch((e) => console.error("[auth/callback] welcome email failed:", e));
        }
      } catch (e) {
        // Non-blocking — failures must not break login
        console.error("[auth/callback] profile update failed:", e);
      }

      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : `/${VALID_LOCALES[0]}`;
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Extract locale from ?next=/{locale}/... so the error lands in the right language
  const nextParam = searchParams.get("next") ?? "";
  const errorLocale = nextParam.split("/").filter(Boolean)[0] ?? "en";
  const validLocales = ["en", "fr", "es", "ar", "id"];
  const safeLocale = validLocales.includes(errorLocale) ? errorLocale : "en";
  return NextResponse.redirect(`${origin}/${safeLocale}/login?error=oauth&reason=exchange_failed`);
}
