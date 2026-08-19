"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import TrialBanner from "@/components/TrialBanner";

const SKIP_PATHS = ["/login", "/signup", "/success", "/reset-password", "/forgot-password"];

interface TrialData {
  trialEndsAt: string;
  hasBilling: boolean;
  isPilot: boolean;
  pilotOrganization: string | null;
}

export default function TrialBannerLoader({ locale }: { locale: string }) {
  const [trial, setTrial] = useState<TrialData | null>(null);
  const pathname = usePathname();

  const skipBanner = SKIP_PATHS.some((p) => pathname.includes(p));

  useEffect(() => {
    if (skipBanner) return;
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id, stripe_customer_id, stripe_has_payment_method, is_pilot, pilot_organization")
        .eq("id", session.user.id)
        .single();

      const plan = profile?.plan ?? "free";
      const trialEndsAt = profile?.trial_ends_at ?? null;
      // Was `Boolean(stripe_subscription_id)` — wrong for a no-card trialing
      // Stripe subscriber (checkout sets stripe_subscription_id the instant
      // checkout completes, even with payment_method_collection: if_required
      // and no card — see app/api/checkout/route.ts:150-152). That read a
      // subscription with nothing backing it as "fully covered" and hid the
      // banner entirely, so the one person whose subscription is scheduled to
      // silently cancel got no warning at all. Found 2026-08-17/18 on
      // otitamorgan@gmail.com. stripe_has_payment_method (migration
      // 20260818200000) is the corrected signal.
      const isCovered = Boolean(profile?.stripe_subscription_id) && Boolean(profile?.stripe_has_payment_method);

      const isPaid = ["starter", "pro", "team", "enterprise"].includes(plan);
      if (!isPaid || !trialEndsAt || isCovered) return;
      if (new Date(trialEndsAt).getTime() <= Date.now()) return;

      setTrial({
        trialEndsAt,
        // stripe_customer_id exists the moment checkout completes (even with
        // no card), so the billing portal already works to add one — a
        // no-card Stripe trialing subscriber should get the portal CTA, not
        // another checkout (which would attempt to start a second
        // subscription for the same customer instead of fixing the existing
        // one).
        hasBilling: Boolean(profile?.stripe_customer_id),
        isPilot: !!profile?.is_pilot,
        pilotOrganization: (profile?.pilot_organization as string | null) ?? null,
      });
    });
  }, []);

  if (!trial || skipBanner) return null;
  return (
    <TrialBanner
      trialEndsAt={trial.trialEndsAt}
      locale={locale}
      hasBilling={trial.hasBilling}
      isPilot={trial.isPilot}
      pilotOrganization={trial.pilotOrganization}
    />
  );
}
