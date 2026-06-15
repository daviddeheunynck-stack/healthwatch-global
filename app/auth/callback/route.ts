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

        // Activate 14-day Pro trial for users who never had one
        if (profile?.plan === "free" && !profile.trial_ends_at) {
          updates.plan = "pro";
          updates.trial_ends_at = new Date(
            Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
          ).toISOString();
        }

        // Save locale for OAuth users (Google/GitHub) who bypass signup/page.tsx
        if (!profile?.locale) {
          const inferredLocale = localeFromNext(next);
          if (inferredLocale) updates.locale = inferredLocale;
        }

        if (Object.keys(updates).length > 0) {
          await admin.from("profiles").update(updates).eq("id", user.id);
        }
      } catch (e) {
        // Non-blocking — failures must not break login
        console.error("[auth/callback] profile update failed:", e);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Extract locale from ?next=/{locale}/... so the error lands in the right language
  const nextParam = searchParams.get("next") ?? "";
  const errorLocale = nextParam.split("/").filter(Boolean)[0] ?? "en";
  const validLocales = ["en", "fr", "es", "ar", "id"];
  const safeLocale = validLocales.includes(errorLocale) ? errorLocale : "en";
  return NextResponse.redirect(`${origin}/${safeLocale}/login?error=oauth`);
}
