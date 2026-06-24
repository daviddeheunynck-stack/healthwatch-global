import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const TRIAL_DAYS = 14;
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
          .select("plan, trial_ends_at, locale")
          .eq("id", user.id)
          .single();

        const updates: Record<string, unknown> = {};
        let isNewSignup = false;

        // Activate 14-day Pro trial for users who never had one
        if (profile?.plan === "free" && !profile.trial_ends_at) {
          updates.plan = "pro";
          updates.trial_ends_at = new Date(
            Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
          ).toISOString();
          isNewSignup = true;
        }

        // Save locale for OAuth users (Google/GitHub) who bypass signup/page.tsx
        const inferredLocale = localeFromNext(next);
        if (!profile?.locale && inferredLocale) {
          updates.locale = inferredLocale;
        }

        if (Object.keys(updates).length > 0) {
          await admin.from("profiles").update(updates).eq("id", user.id);
        }

        // Send welcome email only for OAuth signups — email/password users already
        // receive it from signup/page.tsx immediately after form submission.
        const isOAuth = user.app_metadata?.provider !== "email";
        if (isNewSignup && isOAuth && user.email) {
          const emailLocale = (updates.locale as string | undefined) ?? profile?.locale ?? inferredLocale ?? "fr";
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
