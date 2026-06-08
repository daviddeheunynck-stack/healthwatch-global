// HealthWatch Global — Web Push service worker
//
// Deliberately dumb: all localization/wording decisions happen server-side
// (the sender knows the subscriber's locale — see lib/push.ts), so this file
// only needs to display whatever payload it receives and route clicks. Keeping
// it minimal also keeps it easy to reason about — service workers are awkward
// to debug and updates don't always reach clients promptly.
//
// Expected push payload (JSON):
//   { title, body, url, tag?, icon?, badge? }
//   - url  : app-relative path to open/focus on click (e.g. "/fr/?outbreak=…")
//   - tag  : optional — collapses repeat notifications about the same subject
//            instead of stacking duplicates in the OS notification tray

const DEFAULT_ICON  = "/icon";
const DEFAULT_BADGE = "/icon";

// Activate the new SW immediately rather than waiting for all tabs to close —
// this is a notification-delivery worker, not a caching/offline layer, so
// there's no stale-asset risk in taking over right away.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload (shouldn't happen — lib/push.ts always sends JSON) —
    // fall back to plain text so a malformed message still surfaces something.
    data = { title: "HealthWatch Global", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "HealthWatch Global";
  const options = {
    body:  data.body || "",
    icon:  data.icon  || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    tag:   data.tag,
    data:  { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click → focus an already-open HealthWatch tab if one matches, otherwise open
// a new one. This is the standard "join, don't duplicate" pattern for PWAs.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
