import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

const PAID_PLANS = ["pro", "team", "enterprise"];

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id, api_key")
    .eq("id", user.id)
    .single();

  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  return Response.json({ api_key: profile?.api_key ?? null });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const { data } = await supabase
    .from("profiles")
    .update({ api_key: crypto.randomUUID() })
    .eq("id", user.id)
    .select("api_key")
    .single();

  return Response.json({ api_key: data?.api_key ?? null });
}
