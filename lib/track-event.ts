import { getServiceClient } from "@/lib/supabase-service";

/**
 * Fire-and-forget product usage event log (product_events table).
 * Non-async on purpose — returns void, not a Promise, so no call site can
 * accidentally await it and add latency to a real user-facing response.
 * Matches the existing best-effort insert pattern already used for
 * alert_notifications elsewhere (`.then(() => {}, () => {})`, no throw).
 */
export function trackEvent(
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
): void {
  getServiceClient()
    .from("product_events")
    .insert({ user_id: userId, action, metadata: metadata ?? {} })
    .then(() => {}, () => {});
}
