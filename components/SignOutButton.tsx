"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function SignOutButton({ locale, label }: { locale: string; label: string }) {
  const router = useRouter();

  async function handleSignOut() {
    // Best-effort: release this device's push subscription before signing
    // out. Without it, the row survives tied to this user, and on a shared
    // device the next person who logs in and enables push silently takes it
    // over (push_subscriptions.endpoint is upserted per-endpoint, not
    // per-user) — this user stops receiving push alerts with no error and
    // no indication anything changed. Never blocks sign-out itself.
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } catch { /* best-effort only */ }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
    >
      <LogOut className="w-4 h-4" />
      {label}
    </button>
  );
}
