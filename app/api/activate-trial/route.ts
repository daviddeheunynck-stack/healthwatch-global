import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { activateTrial, ALL_REGIONS } from "@/lib/activate-trial";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST(req: NextRequest) {
  // Optional single-region preference from the signup form (see
  // app/[locale]/signup/page.tsx). Anything missing, invalid, or "all"
  // (the explicit "every region" choice) falls back to the full 5-region
  // enrollment below — same behavior as before this field existed.
  let priorityRegion: (typeof ALL_REGIONS)[number] | null = null;
  try {
    const body = await req.json();
    if (typeof body?.priorityRegion === "string" && (ALL_REGIONS as readonly string[]).includes(body.priorityRegion)) {
      priorityRegion = body.priorityRegion as (typeof ALL_REGIONS)[number];
    }
  } catch { /* no/invalid JSON body — treat as "all regions", the prior default */ }

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

  let result;
  try {
    result = await activateTrial(admin, user, { priorityRegion });
  } catch (err) {
    console.error("[activate-trial] activation failed:", err);
    Sentry.captureException(err, { tags: { user_id: user.id } });
    await Sentry.flush(2000);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  if (!result.activated) {
    return NextResponse.json({ skipped: true });
  }

  return NextResponse.json({ activated: true, trial_ends_at: result.trial_ends_at });
}
