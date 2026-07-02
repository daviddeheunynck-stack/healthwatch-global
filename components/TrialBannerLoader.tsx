"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import TrialBanner from "@/components/TrialBanner";

const SKIP_PATHS = ["/login", "/signup", "/success", "/reset-password", "/forgot-password"];

interface TrialData {
  trialEndsAt: string;
  hasBilling: boolean;
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
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", session.user.id)
        .single();

      const plan = profile?.plan ?? "free";
      const trialEndsAt = profile?.trial_ends_at ?? null;
      const hasSubscription = Boolean(profile?.stripe_subscription_id);

      const isPaid = ["starter", "pro", "team", "enterprise"].includes(plan);
      if (!isPaid || !trialEndsAt || hasSubscription) return;
      if (new Date(trialEndsAt).getTime() <= Date.now()) return;

      setTrial({ trialEndsAt, hasBilling: false });
    });
  }, []);

  if (!trial || skipBanner) return null;
  return <TrialBanner trialEndsAt={trial.trialEndsAt} locale={locale} hasBilling={trial.hasBilling} />;
}
