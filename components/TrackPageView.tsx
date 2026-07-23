"use client";

import { useEffect } from "react";

/**
 * Fires a server-verified pageview event for pages that are ISR-cached
 * (revalidate = N), where a trackEvent() call inside the server component
 * body would only run once per cache regen — not once per real visit.
 * Resolves the user from the request's own cookies in app/api/track/route.ts,
 * not from the cached render.
 */
export default function TrackPageView({
  action,
  metadata,
}: {
  action: string;
  metadata?: Record<string, unknown>;
}) {
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, metadata }),
      keepalive: true,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
