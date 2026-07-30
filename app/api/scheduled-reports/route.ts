import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const PLAN_LIMITS: Record<string, number> = {
  pro: 1,
  team: 5,
  enterprise: 50,
};

const PAID_PLANS = Object.keys(PLAN_LIMITS);

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

  const { error } = await supabase.from("scheduled_reports").delete().eq("user_id", user.id);
  if (error) {
    console.error("[scheduled-reports] delete failed:", error.message);
    Sentry.captureException(new Error(`[scheduled-reports] delete failed: ${error.message}`), { tags: { route: "scheduled-reports", user_id: user.id } });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
