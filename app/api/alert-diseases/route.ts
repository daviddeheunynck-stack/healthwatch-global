import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { resolvedPlan } from "@/lib/resolved-plan";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const MAX_DISEASES = 10;

function getServiceClient() {
  return createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — return user's subscribed diseases + available diseases
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getServiceClient();

  const [{ data: subscribed }, { data: available }] = await Promise.all([
    // User's current disease subscriptions
    service
      .from("user_alert_diseases")
      .select("disease_en, created_at")
      .eq("user_id", user.id)
      .order("disease_en"),

    // All distinct active diseases in DB
    service
      .from("outbreaks")
      .select("disease_en")
      .eq("active", true)
      .not("disease_en", "is", null),
  ]);

  // Deduplicate available diseases and build per-disease outbreak counts
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  const diseases: string[] = [];
  for (const row of available ?? []) {
    if (row.disease_en) {
      counts[row.disease_en] = (counts[row.disease_en] ?? 0) + 1;
      if (!seen.has(row.disease_en)) {
        seen.add(row.disease_en);
        diseases.push(row.disease_en);
      }
    }
  }
  diseases.sort();

  return NextResponse.json({
    subscribed: (subscribed ?? []).map((r) => r.disease_en),
    available:  diseases,
    max:        MAX_DISEASES,
    counts,
  });
}

// POST — subscribe to a disease
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { disease_en } = await req.json();
  if (!disease_en || typeof disease_en !== "string") {
    return NextResponse.json({ error: "disease_en required" }, { status: 400 });
  }

  const service = getServiceClient();

  // Check plan (with trial expiry guard)
  const { data: profile } = await service
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();
  if (!["starter", "pro", "team", "enterprise"].includes(resolvedPlan(profile))) {
    return NextResponse.json({ error: "Pro or Team plan required" }, { status: 403 });
  }

  // Enforce max
  const { count } = await service
    .from("user_alert_diseases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_DISEASES) {
    return NextResponse.json({ error: `Maximum ${MAX_DISEASES} disease alerts` }, { status: 400 });
  }

  const { error } = await service
    .from("user_alert_diseases")
    .insert({ user_id: user.id, disease_en });

  if (error && error.code !== "23505") { // ignore duplicate
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — unsubscribe from a disease
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { disease_en } = await req.json();
  if (!disease_en || typeof disease_en !== "string") return NextResponse.json({ error: "disease_en required" }, { status: 400 });

  const service = getServiceClient();
  const { error } = await service
    .from("user_alert_diseases")
    .delete()
    .eq("user_id", user.id)
    .eq("disease_en", disease_en);

  // A user explicitly opting out who keeps getting that disease's alerts
  // because this failed silently is the opt-out direction of the same
  // West Nile-shaped bug: told "done", not actually done.
  if (error) {
    console.error("[alert-diseases] delete failed:", error.message);
    Sentry.captureException(new Error(`[alert-diseases] delete failed: ${error.message}`), { tags: { route: "alert-diseases", user_id: user.id } });
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
