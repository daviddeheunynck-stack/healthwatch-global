"use client";

// Renders Vercel Analytics only after the user has explicitly accepted cookies.
//
// Reads the localStorage-backed consent value via useSyncExternalStore — the
// same store CookieBanner derives its own visibility from (see
// subscribeToConsent/getConsent/getConsentServerSnapshot there for the full
// rationale, including why this isn't just `useState` + `useEffect`). One
// reactive read covers both cases that used to need separate handling:
// returning visitors (consent already in localStorage on mount) and consent
// granted live during this session (the "cookie-consent" event CookieBanner
// dispatches when the user responds) — React re-renders this component either
// way, no manual event-listener bookkeeping required.

import { useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/react";
import { getConsent, subscribeToConsent, getConsentServerSnapshot } from "@/components/CookieBanner";

export default function ConsentAwareAnalytics() {
  const consent = useSyncExternalStore(subscribeToConsent, getConsent, getConsentServerSnapshot);
  if (consent !== "accepted") return null;
  return <Analytics />;
}
