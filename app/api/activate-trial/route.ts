import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const TRIAL_DAYS = 14;
const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST(_req: NextRequest) {
  // Identify the caller from their session cookie — never trust client-supplied userId
  const cookieStore = await cookies();
  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("plan, trial_ends_at")
    .eq("id", user.id)
    .single();

  if (fetchErr) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Idempotent — only activate once, and only for free users
  if (profile?.plan !== "free" || profile.trial_ends_at) {
    return NextResponse.json({ skipped: true });
  }

  const trialEndsAt = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ plan: "pro", trial_ends_at: trialEndsAt })
    .eq("id", user.id);

  if (updateErr) {
    console.error("[activate-trial] update failed:", updateErr);
    Sentry.captureException(new Error(`[activate-trial] DB update failed: ${updateErr.message}`), {
      tags: { user_id: user.id },
    });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  console.log(`[activate-trial] Trial activated until ${trialEndsAt}`);
  return NextResponse.json({ activated: true, trial_ends_at: trialEndsAt });
}
