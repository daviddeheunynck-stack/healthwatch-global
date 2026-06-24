import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLAN_LIMITS: Record<string, number> = {
  pro: 1,
  team: 5,
  enterprise: 50,
};

const PAID_PLANS = Object.keys(PLAN_LIMITS);

function resolvedPlan(profile: { plan?: string | null; trial_ends_at?: string | null; stripe_subscription_id?: string | null } | null): string {
  const plan = profile?.plan ?? "free";
  if (plan !== "free" && profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() < Date.now() && !profile?.stripe_subscription_id) return "free";
  return plan;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  const plan = resolvedPlan(profile);

  if (!PAID_PLANS.includes(plan))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { data } = await supabase
    .from("scheduled_reports")
    .select("id, recipients, locale, active, last_sent_at")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    report: data ?? null,
    plan,
    maxRecipients: PLAN_LIMITS[plan] ?? 1,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  const plan = resolvedPlan(profile);

  if (!PAID_PLANS.includes(plan))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const maxRecipients = PLAN_LIMITS[plan] ?? 1;

  const body = await req.json() as {
    recipients?: string[];
    locale?: string;
    active?: boolean;
  };

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const recipients = (body.recipients ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(validEmail)
    .slice(0, maxRecipients);

  const locale = ["fr", "en", "es", "ar", "id"].includes(body.locale ?? "")
    ? body.locale!
    : "en";

  const active = body.active !== false;

  const { data, error } = await supabase
    .from("scheduled_reports")
    .upsert(
      { user_id: user.id, recipients, locale, active, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("id, recipients, locale, active, last_sent_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data, plan, maxRecipients }, { status: 200 });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("scheduled_reports").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
