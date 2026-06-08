import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { sendPushToMany } from "@/lib/push";

export const dynamic = "force-dynamic";

function service() {
  return createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const COPY: Record<string, { title: string; body: string }> = {
  fr: { title: "🔔 HealthWatch Global",      body: "Notifications activées — vous recevrez désormais les alertes en temps réel." },
  en: { title: "🔔 HealthWatch Global",      body: "Notifications enabled — you'll now receive real-time alerts here." },
  es: { title: "🔔 HealthWatch Global",      body: "Notificaciones activadas — ahora recibirás alertas en tiempo real aquí." },
  ar: { title: "🔔 HealthWatch Global",      body: "تم تفعيل الإشعارات — ستتلقى الآن التنبيهات الفورية هنا." },
  id: { title: "🔔 HealthWatch Global",      body: "Notifikasi diaktifkan — Anda akan menerima peringatan secara real-time di sini." },
};

// POST — send a one-off test notification to every subscription the logged-in
// user owns. Exists for two reasons: it lets the opt-in UI confirm "yes, this
// actually works" right after permission is granted (closing the loop for the
// user), and it's the fastest way to prove the whole pipeline end-to-end —
// VAPID config, encryption, delivery, service worker rendering — without
// waiting for a real outbreak to trigger a cron alert.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = service();
  const { data: subs, error } = await svc
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, locale")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "Could not load subscriptions" }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "No active push subscription for this account" }, { status: 404 });
  }

  // Group by locale so each subscription gets copy in its own language —
  // most users will have exactly one subscription, but nothing stops someone
  // from opting in on two devices with different browser languages.
  let sent = 0, failed = 0;
  const allExpiredIds: string[] = [];

  for (const locale of new Set(subs.map((s) => s.locale ?? "en"))) {
    const group = subs.filter((s) => (s.locale ?? "en") === locale);
    const copy = COPY[locale] ?? COPY.en;
    const result = await sendPushToMany(group, { ...copy, tag: "hwg-test", url: "/" });
    sent   += result.sent;
    failed += result.failed;
    allExpiredIds.push(...result.expiredIds);
  }

  // Sweep dead endpoints so they stop being retried on every future send —
  // see the `expired` branch of PushSendResult in lib/push.ts for why this
  // is safe to do unconditionally (404/410 means "gone for good").
  if (allExpiredIds.length > 0) {
    await svc.from("push_subscriptions").delete().in("id", allExpiredIds);
  }

  return NextResponse.json({ sent, failed, expired: allExpiredIds.length, total: subs.length });
}
