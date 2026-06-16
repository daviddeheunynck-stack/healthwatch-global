import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_WATCHLIST = 20;
const PAID_PLANS = ["starter", "pro", "enterprise"] as const;

function service() {
  return createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUserAndPlan(svc: ReturnType<typeof service>, userId: string) {
  const { data: profile } = await svc
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", userId)
    .single();

  let plan = profile?.plan ?? "free";
  if (
    plan !== "free" &&
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < Date.now() &&
    !profile.stripe_subscription_id
  ) {
    plan = "free";
  }
  return plan as string;
}

// GET — return user's watchlist outbreak IDs
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await service()
    .from("user_watchlist")
    .select("outbreak_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    watchlist: (data ?? []).map((r) => r.outbreak_id),
    max: MAX_WATCHLIST,
  });
}

// POST — add outbreak to watchlist
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { outbreak_id } = await req.json();
  if (!outbreak_id) return NextResponse.json({ error: "outbreak_id required" }, { status: 400 });

  const svc = service();

  const plan = await getUserAndPlan(svc, user.id);
  if (!PAID_PLANS.includes(plan as typeof PAID_PLANS[number])) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  // Check max
  const { count } = await svc
    .from("user_watchlist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_WATCHLIST) {
    return NextResponse.json({ error: `Maximum ${MAX_WATCHLIST} outbreaks in watchlist` }, { status: 400 });
  }

  const { error } = await svc
    .from("user_watchlist")
    .insert({ user_id: user.id, outbreak_id });

  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE — remove from watchlist
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { outbreak_id } = await req.json();
  if (!outbreak_id) return NextResponse.json({ error: "outbreak_id required" }, { status: 400 });

  await service()
    .from("user_watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("outbreak_id", outbreak_id);

  return NextResponse.json({ success: true });
}
