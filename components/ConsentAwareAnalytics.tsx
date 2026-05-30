"use client";

// Renders Vercel Analytics only after the user has explicitly accepted cookies.
// Listens to the "cookie-consent" custom event dispatched by CookieBanner,
// and also checks localStorage on mount for returning visitors who already consented.

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { getConsent } from "@/components/CookieBanner";

export default function ConsentAwareAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Already consented in a previous session
    if (getConsent() === "accepted") {
      setAllowed(true);
      return;
    }

    // Listen for consent granted in this session
    function onConsent(e: Event) {
      const value = (e as CustomEvent<string>).detail;
      if (value === "accepted") setAllowed(true);
    }

    window.addEventListener("cookie-consent", onConsent);
    return () => window.removeEventListener("cookie-consent", onConsent);
  }, []);

  if (!allowed) return null;
  return <Analytics />;
}
