"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics/react";

// Fires one Vercel Analytics custom event when a visitor lands via a tagged
// campaign link — e.g. https://healthwatch-global.com/fr?ref=linkedin-fr-launch,
// the link format every share-URL in this app already uses
// (see app/[locale]/layout.tsx, app/widget/page.tsx: always `/${locale}`,
// never the bare domain — which redirects to /en and drops query strings,
// see app/page.tsx). Lets a specific post/campaign be measured by name in the
// dashboard ("campaign_landing" events grouped by `ref`) instead of guessing
// from a traffic bump that might be coincidence.
//
// Lives next to <LandingPage> rather than inside it — a one-shot side effect
// with no UI of its own is the textbook useEffect case
// (https://react.dev/learn/you-might-not-need-an-effect): synchronizing with
// an external system (the analytics beacon) on mount. `track()` is a plain
// function call, not a setState — react-hooks/set-state-in-effect doesn't
// apply here, unlike the cases fixed in ff5fae9. Reading `window.location.search`
// inside the effect (not at render top-level) mirrors the same
// post-mount-only pattern already used in compare/page.tsx.
export default function CampaignRefTracker() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) track("campaign_landing", { ref });
  }, []);

  return null;
}
