/**
 * Web Push sender — wraps the `web-push` library with HealthWatch's VAPID
 * config and a result type that distinguishes "expired subscription, delete
 * it" from "transient failure, just log it" without forcing every caller to
 * inspect library-specific error shapes.
 *
 * Usage:
 *   const result = await sendPush(row, { title, body, url });
 *   if (!result.ok && result.expired) { … delete the subscription row … }
 */

import webpush from "web-push";
import { errorMessage } from "@/lib/error";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const VAPID_PUBLIC_KEY  = clean(process.env.VAPID_PUBLIC_KEY);
const VAPID_PRIVATE_KEY = clean(process.env.VAPID_PRIVATE_KEY);
const VAPID_SUBJECT     = clean(process.env.VAPID_SUBJECT) || "mailto:alerts@healthwatch-global.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/** The three columns persisted from the browser's PushSubscription object. */
export interface PushSubscriptionRow {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

/** Matches what public/sw.js expects to receive — keep the two in sync. */
export interface PushPayload {
  title: string;
  body:  string;
  /** App-relative path to focus/open on click, e.g. "/fr/?outbreak=…" */
  url?:   string;
  /** Collapses repeat notifications about the same subject in the OS tray */
  tag?:   string;
  icon?:  string;
  badge?: string;
}

export type PushSendResult =
  | { ok: true }
  /** Push service returned 404/410 — this endpoint is gone for good (user
   *  uninstalled, revoked permission, or the browser rotated it). It will
   *  never succeed again; the caller should delete the row. */
  | { ok: false; expired: true }
  | { ok: false; expired: false; error: string };

export async function sendPush(sub: PushSubscriptionRow, payload: PushPayload): Promise<PushSendResult> {
  if (!ensureConfigured()) {
    return { ok: false, expired: false, error: "VAPID keys not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)" };
  }

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof webpush.WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
      return { ok: false, expired: true };
    }
    return { ok: false, expired: false, error: errorMessage(err) };
  }
}

/**
 * Sends to many subscriptions in parallel and buckets the results so a cron
 * job can act on each bucket: log failures, and — importantly — sweep expired
 * rows out of the table so they stop being retried (and stop inflating
 * "subscriber" counts with dead endpoints).
 */
export async function sendPushToMany<T extends PushSubscriptionRow & { id: string }>(
  subs: T[],
  payload: PushPayload
): Promise<{ sent: number; expiredIds: string[]; failed: number }> {
  const results = await Promise.all(subs.map((sub) => sendPush(sub, payload).then((r) => ({ sub, r }))));

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  for (const { sub, r } of results) {
    if (r.ok) sent++;
    else if (r.expired) expiredIds.push(sub.id);
    else failed++;
  }

  return { sent, expiredIds, failed };
}
