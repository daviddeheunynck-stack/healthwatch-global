import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

let _stripe: Stripe | null = null;
function getStripe() {
  return (_stripe ??= new Stripe(clean(process.env.STRIPE_SECRET_KEY), {
    apiVersion: "2026-04-22.dahlia",
  }));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, days = 14 } = await req.json() as { email: string; days?: number };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const admin = createServiceClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("id, plan, trial_ends_at, stripe_subscription_id")
    .eq("email", email)
    .single();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const base = new Date();
  base.setDate(base.getDate() + days);
  base.setUTCHours(23, 59, 59, 0);
  const newEndsAt    = base.toISOString();
  const trialEndUnix = Math.floor(base.getTime() / 1000);

  // If user has a Stripe subscription, check its status
  if (profile.stripe_subscription_id) {
    let sub: Stripe.Subscription;
    try {
      sub = await getStripe().subscriptions.retrieve(profile.stripe_subscription_id);
    } catch {
      sub = { status: "canceled" } as Stripe.Subscription;
    }

    if (sub.status === "active") {
      return NextResponse.json({ error: "Active paid subscription — use Stripe dashboard" }, { status: 409 });
    }

    if (sub.status === "trialing") {
      await getStripe().subscriptions.update(profile.stripe_subscription_id, { trial_end: trialEndUnix });
      await admin.from("profiles").update({ plan: "pro", trial_ends_at: newEndsAt }).eq("id", profile.id);
      return NextResponse.json({ ok: true, trial_ends_at: newEndsAt, via: "stripe" });
    }

    // Canceled / past_due — manage in DB only, clear stale sub ID
    await admin.from("profiles").update({
      plan: "pro",
      trial_ends_at: newEndsAt,
      stripe_subscription_id: null,
    }).eq("id", profile.id);
    return NextResponse.json({ ok: true, trial_ends_at: newEndsAt, via: "db" });
  }

  // No Stripe subscription — DB only
  await admin.from("profiles").update({ plan: "pro", trial_ends_at: newEndsAt }).eq("id", profile.id);
  return NextResponse.json({ ok: true, trial_ends_at: newEndsAt, via: "db" });
}
