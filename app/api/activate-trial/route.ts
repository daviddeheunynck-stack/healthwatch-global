import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const TRIAL_DAYS = 14;
const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const admin = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("plan, trial_ends_at")
    .eq("id", userId)
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
    .eq("id", userId);

  if (updateErr) {
    console.error("[activate-trial] update failed:", updateErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  console.log(`[activate-trial] Trial activated for user ${userId} until ${trialEndsAt}`);
  return NextResponse.json({ activated: true, trial_ends_at: trialEndsAt });
}
