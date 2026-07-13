/**
 * Expo Push sender — companion to lib/push.ts (Web Push/VAPID) for the React
 * Native mobile app. Same result shape so callers can treat both channels
 * identically: a send either succeeds, fails with "token is dead, delete it",
 * or fails transiently (log and move on).
 *
 * Usage:
 *   const result = await sendExpoPushToMany(tokens, { title, body, outbreak_id });
 *   if (result.expiredIds.length) { … delete those mobile_push_tokens rows … }
 */

import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

/** The one column persisted per device from getExpoPushTokenAsync(). */
export interface ExpoPushTokenRow {
  expo_push_token: string;
}

export interface ExpoPushPayload {
  title: string;
  body: string;
  /** Arbitrary payload delivered to the app — e.g. { outbreak_id } for deep-linking. */
  data?: Record<string, unknown>;
}

export async function sendExpoPushToMany<T extends ExpoPushTokenRow & { id: string }>(
  tokens: T[],
  payload: ExpoPushPayload
): Promise<{ sent: number; expiredIds: string[]; failed: number }> {
  const valid = tokens.filter((t) => Expo.isExpoPushToken(t.expo_push_token));

  const messages: ExpoPushMessage[] = valid.map((t) => ({
    to: t.expo_push_token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  }));

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    const chunkTokens = valid.slice(sent + failed, sent + failed + chunk.length);
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "ok") {
          sent++;
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          expiredIds.push(chunkTokens[i].id);
        } else {
          failed++;
        }
      });
    } catch {
      failed += chunk.length;
    }
  }

  return { sent, expiredIds, failed };
}
