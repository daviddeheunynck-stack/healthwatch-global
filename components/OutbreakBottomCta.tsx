"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";

interface Props {
  locale: string;
  ctaTitle: string;
  ctaSub: string;
  ctaProBtn: string;
  ctaFree: string;
}

export default function OutbreakBottomCta({ locale, ctaTitle, ctaSub, ctaProBtn, ctaFree }: Props) {
  // null = pending, "paid" = hide, "free" | "anon" = show
  const [state, setState] = useState<"pending" | "paid" | "free" | "anon">("pending");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setState("anon"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", session.user.id)
        .single();
      const plan = profile?.plan ?? "free";
      const isPaidPlan = ["starter", "pro", "team", "enterprise"].includes(plan);
      // Hide for Stripe subscribers; show for trial users (let them upgrade to annual)
      // and free users (nudge to start a trial)
      if (isPaidPlan && !!profile?.stripe_subscription_id) {
        setState("paid");
      } else {
        setState("free");
      }
    });
  }, []);

  // Keep visible while pending (SSR fallback) and for non-paid users
  if (state === "paid") return null;

  return (
    <div className="mt-10 p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
      <div>
        <p className="text-white font-semibold">{ctaTitle}</p>
        <p className="text-xs text-gray-400 mt-1">{ctaSub}</p>
      </div>
      <CheckoutButton
        plan="pro"
        locale={locale}
        label={ctaProBtn}
        className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
      />
      <p className="text-xs text-gray-500">
        <Link href={`/${locale}/signup`} className="underline hover:text-gray-300 transition-colors">
          {ctaFree}
        </Link>
      </p>
    </div>
  );
}
