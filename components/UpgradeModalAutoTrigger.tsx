"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";

// Never on pages where it would be redundant (pricing/account already pitch
// Pro directly) or intrusive (auth flow, checkout success).
const SKIP_PATHS = ["/login", "/signup", "/success", "/reset-password", "/forgot-password", "/pricing", "/account"];

const STORAGE_KEY = "hwg_upgrade_modal_last_shown";
const REPEAT_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // once a week per browser
const MIN_ACCOUNT_AGE_MS = 2 * 24 * 60 * 60 * 1000; // don't ambush a signup that's minutes old
const SHOW_DELAY_MS = 4000; // let the page render first, not an instant popup

export default function UpgradeModalAutoTrigger() {
  const pathname = usePathname();
  const { openModal } = useUpgradeModal();
  const fetchedRef = useRef(false);
  const skip = SKIP_PATHS.some((p) => pathname.includes(p));

  useEffect(() => {
    if (skip || fetchedRef.current) return;
    fetchedRef.current = true;

    let lastShown = 0;
    try { lastShown = Number(localStorage.getItem(STORAGE_KEY) ?? "0"); } catch { /* storage blocked — fail open, just don't persist */ }
    if (Date.now() - lastShown < REPEAT_AFTER_MS) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, stripe_subscription_id, stripe_has_payment_method, is_pilot, created_at")
        .eq("id", session.user.id)
        .single();
      if (!profile) return;

      // Same "actually paying" signal as TrialBannerLoader — covers plan=free
      // (never trialed or trial expired) AND plan=pro/team currently trialing
      // without a committed card, i.e. anyone who hasn't converted yet.
      const isCovered = Boolean(profile.stripe_subscription_id) && Boolean(profile.stripe_has_payment_method);
      if (isCovered) return;
      // Pilots have their own dedicated conversion path (a real human
      // conversation, see lib/trial-ending-email.ts PILOT_COPY) — a generic
      // self-serve upsell modal would undercut that, not support it.
      if (profile.is_pilot) return;

      const createdAt = profile.created_at ? new Date(profile.created_at).getTime() : 0;
      if (createdAt && Date.now() - createdAt < MIN_ACCOUNT_AGE_MS) return;

      timer = setTimeout(() => {
        track("upgrade_modal_auto_shown", { locale: pathname.split("/")[1] ?? "en" });
        openModal("realtime");
        try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* storage blocked — modal still shows, just may repeat next load */ }
      }, SHOW_DELAY_MS);
    });

    return () => { if (timer) clearTimeout(timer); };
  }, [skip, openModal, pathname]);

  return null;
}
