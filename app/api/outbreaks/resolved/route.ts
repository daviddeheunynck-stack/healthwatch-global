import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { resolvedPlan } from "@/lib/resolved-plan";

const PAID_PLANS = ["pro", "team", "enterprise"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const days  = Math.max(1, Math.min(90, Number(searchParams.get("days")  ?? 30)));
  const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") ?? 20)));

  const service = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await service
    .from("outbreaks")
    .select("id, disease_en, country_en, risk_level, date, updated_at, region, cases")
    .eq("active", false)
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ resolved: data ?? [], days });
}
