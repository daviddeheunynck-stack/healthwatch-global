/**
 * Per-user convenience wrapper around sendExpoPushToMany — the one thing
 * every alert-trigger cron calls right alongside its existing
 * alert_notifications insert. Deliberately swallows every error: a push
 * failure must never break the email/in-app-notification flow that already
 * works, so callers can fire-and-forget this without their own try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendExpoPushToMany } from "@/lib/expo-push";
import { isRealProduction } from "@/lib/cron-monitor";
import { errorMessage } from "@/lib/error";

export interface MobileNotifyPayload {
  title: string;
  body: string;
  outbreak_id?: string | null;
}

export async function notifyMobile(supabase: SupabaseClient, userId: string, payload: MobileNotifyPayload): Promise<void> {
  try {
    const { data: tokens } = await supabase
      .from("mobile_push_tokens")
      .select("id, expo_push_token")
      .eq("user_id", userId);

    if (!tokens?.length || !isRealProduction) return;

    const result = await sendExpoPushToMany(tokens, {
      title: payload.title,
      body: payload.body,
      // `url` (not a raw outbreak_id) so the client's notification-tap handler
      // can router.push() it directly — same convention as lib/push.ts's Web
      // Push payload.
      data: { url: payload.outbreak_id ? `/outbreak/${payload.outbreak_id}` : undefined },
    });

    if (result.expiredIds.length) {
      await supabase.from("mobile_push_tokens").delete().in("id", result.expiredIds);
    }
  } catch (err) {
    console.error(`[mobile-notify] Failed for user ${userId}:`, errorMessage(err));
  }
}
