// Cron: cancel any Stripe subscription still active once HealthWatch Global
// has shut down (isShutDown(), lib/shutdown.ts). Runs daily; a no-op before
// that date and a no-op again once every real subscription is gone.
//
// app/[locale]/layout.tsx replaces every route — dashboard and /admin
// included — with the shutdown notice from that date on, so a customer who
// hasn't already deleted their account (app/api/user/delete/route.ts, which
// cancels their own subscription on the way out) has no UI left to do it
// themselves. Left alone, Stripe would keep billing them for a product that
// tells every visitor it has closed. This is the same
// stripe.subscriptions.cancel() call as that self-service delete route,
// just triggered automatically instead of waiting on the customer.
//
// Deliberately does NOT touch the `profiles` row: customer.subscription.deleted
// (app/api/webhook/route.ts) fires from the Stripe-side cancellation like it
// would from any other cancellation, and already does the DB update (plan ->
// free), team/org cleanup, and churn email — no reason to duplicate that
// here, and every reason not to risk it drifting out of sync with the one
// place that logic already lives.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { isShutDown } from "@/lib/shutdown";
import { logCronRun, isRealProduction, isLiveCronInvocation } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  if (!isShutDown()) {
    await logCronRun(supabase, "cancel-subscriptions-shutdown", "ok", 0);
    return NextResponse.json({ skipped: "not yet shut down" });
  }

  // "admin_override" is a synthetic sentinel (migrations 20260630120000/130000)
  // that grants the founder's own account Pro without a real Stripe object
  // behind it — see app/[locale]/admin/page.tsx's isRealStripeSub for the
  // same exclusion. Passing it to Stripe would just throw; filtered out here
  // instead of relying on the per-item catch below to absorb it.
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, stripe_subscription_id")
    .not("stripe_subscription_id", "is", null)
    .neq("stripe_subscription_id", "admin_override");

  if (error) {
    console.error("[cancel-subscriptions-shutdown] profiles query failed:", error);
    Sentry.captureException(new Error(`[cancel-subscriptions-shutdown] query failed: ${error.message}`), { tags: { route: "cancel-subscriptions-shutdown" } });
    await logCronRun(supabase, "cancel-subscriptions-shutdown", "error", 0, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = profiles ?? [];
  let cancelled = 0, alreadyGone = 0, failed = 0;

  // Same isRealProduction/isLive gate every other cron here uses before an
  // outbound side effect — this one happens to touch money instead of an
  // inbox, which makes the guard against a stray local/preview/manual run
  // matter more, not less.
  if (isRealProduction && isLiveCronInvocation(req)) {
    const stripe = new Stripe(clean(process.env.STRIPE_SECRET_KEY), {
      apiVersion: "2026-04-22.dahlia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    for (const profile of targets) {
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id as string, { prorate: true });
        cancelled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Already canceled, or the id no longer resolves — Stripe throws on
        // both, and either way there is nothing left to bill, which is the
        // actual goal here. Not an error worth paging anyone over.
        if (/already been canceled|No such subscription/i.test(msg)) {
          alreadyGone++;
        } else {
          console.error(`[cancel-subscriptions-shutdown] Failed for ${profile.email}:`, msg);
          Sentry.captureException(err, { tags: { route: "cancel-subscriptions-shutdown", user_id: profile.id } });
          failed++;
        }
      }
    }
  }

  await logCronRun(
    supabase,
    "cancel-subscriptions-shutdown",
    failed > 0 ? "error" : "ok",
    cancelled,
    failed > 0 ? `${failed} cancellation(s) failed` : undefined
  );

  return NextResponse.json({ cancelled, alreadyGone, failed, total: targets.length });
}
