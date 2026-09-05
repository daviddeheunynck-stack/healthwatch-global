// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ff3422719dcc565627288fa22104c45a@o4511456134496256.ingest.de.sentry.io/4511456149962832",

  // A local `next dev` run has no NEXT_PUBLIC_VERCEL_ENV, so it reports here as
  // environment "development" alongside real preview/production traffic — found
  // 2026-09-05 via a "Jest worker encountered N child process exceptions" error,
  // a Jest-internal crash on someone's machine with nothing to do with this
  // app's code, captured only because it surfaced inside a browser setTimeout
  // during a local dev session (environment: development, url: localhost:3000).
  // Local dev noise like this has no fix in this codebase and no diagnostic
  // value in the shared inbox — disabled outright rather than chased per-message.
  enabled: process.env.NODE_ENV !== "development",

  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],

  // NEXT_PUBLIC_VERCEL_ENV = production | preview | development (set via next.config.ts)
  // NODE_ENV is always "production" on Vercel — NEXT_PUBLIC_VERCEL_ENV distinguishes previews
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enableLogs: true,
  replaysSessionSampleRate: 0.01,
  // Replays quota (50/billing period) hit 100% on 2026-09-05, with this rate capturing a
  // replay for every single erroring session rather than a sample — Sentry drops any
  // replay past the cap anyway, so this only stops the SDK from spending client-side work
  // starting recordings that go nowhere until the period resets. Temporary, until the
  // period's own reset date; David chose lowering this over paying for more budget.
  replaysOnErrorSampleRate: Date.now() < Date.parse("2026-09-08T00:00:00Z") ? 0.2 : 1.0,
  sendDefaultPii: false,
  // "Object Not Found Matching Id:N, MethodName:update, ParamCount:4" — reported
  // 15/08/2026 on the public outbreak page. Not our code: this exact signature
  // (only the N varies) shows up identically across dozens of unrelated sites
  // (open GitHub issues on totally unrelated stacks, Sentry's own community
  // forum, a dedicated TrackJS explainer) and traces to CefSharp-based headless
  // Chromium crawlers — most commonly Microsoft Outlook Safe Links pre-scanning
  // a URL from an email before a human ever clicks it, whose internal JS-bridge
  // throws this when it calls back into a binding that isn't there in that
  // automated context. Same underlying phenomenon as the RAFALE_WINDOW_MS bot-
  // click filter in the health-check cron (corporate email gateways prefetching
  // links) — that one inflates a click count, this one throws in the browser;
  // no outbreak-page code path calls `.update()` at all, confirmed before
  // filtering.
  // "Event `Event` (type=error) captured as promise rejection" — flagged as a
  // "regression" 2026-08-27 on /:locale/outbreak/:id, but firstSeen was 10 days
  // earlier (2026-08-17) and the "regressed" commit only touched a marketing
  // doc, confirming the Sentry release attribution is coincidental, not causal
  // (same lesson as the disease-alerts/Hydration Error mislabels this week).
  // synthetic:true, mechanism auto.browser.global_handlers.onunhandledrejection,
  // no stacktrace: this is the SDK's own generic handler for a Promise rejected
  // with a raw DOM Event (a failed <img>/<video>/<audio> load, typically) rather
  // than a thrown Error — confirmed via the SDK's own GitHub issues (getsentry/
  // sentry-javascript#2210, #6199) and its community forum as a widely-reported,
  // non-actionable pattern with the identical message shape, not specific to
  // this codebase. userCount was 0 across all 10 days despite 8 occurrences, and
  // the one event with geo data showed a Colombia IP paired with an Asia/Shanghai
  // browser timezone — a VPN/automated-traffic signature, not a real visitor
  // hitting a broken page. Same "confirm the signature is a known non-issue
  // before filtering" standard as "Object Not Found Matching Id" below.
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT", "Object Not Found Matching Id", "captured as promise rejection"],
  // ignoreErrors above matches on error message/name — Next.js's internal
  // not-found/redirect control-flow signals carry their real type in
  // error.digest instead, which doesn't reliably appear in the message. Ported
  // from the now-deleted sentry.client.config.ts (a pre-instrumentation-client.ts
  // leftover — @sentry/nextjs 10 + Next's instrumentation-client.ts convention
  // means this file is the only client init that actually runs; the old one
  // sat dead alongside it since whenever that migration happened, silently not
  // applying this filter).
  beforeSend(event, hint) {
    const err = hint.originalException as { digest?: string } | null;
    if (err?.digest === "NEXT_NOT_FOUND") return null;
    if (err?.digest?.startsWith("NEXT_REDIRECT")) return null;
    // "TypeError: Failed to fetch" as an UNHANDLED promise rejection only —
    // never the handled/explicitly-reported form, which would mean real app
    // code caught a genuinely broken fetch and deliberately surfaced it.
    // Confirmed 2026-08-31 across 4 issues (JAVASCRIPT-NEXTJS-2F/2C/2E/2D,
    // 1-6 events / 0-1 users each, on different pages): the one component with
    // real client-side fetch logic on the affected admin page (DataStatusWidget)
    // already wraps its call in try/catch, ruling it out as the source, and the
    // stack shows only generic generator/promise-wrapper frames (Object.next,
    // new Promise), not app code — even with source-map upload configured.
    // Same known, framework-internal shape as Next.js App Router's own Link-
    // prefetch RSC fetch (fetchServerResponse), which throws exactly this when
    // a prefetch is interrupted, with no further stack detail by design — see
    // vercel/next.js#48677 ("Prefetching failed to fetch RSC payload") and
    // vercel/next.js#77009 (no useful stack trace for this message, ever).
    // Scoped to mechanism.handled===false, narrower than ignoreErrors, so a
    // future explicit Sentry.captureException() for an actually broken fetch
    // still reports.
    const exc = event.exception?.values?.[0];
    if (exc?.type === "TypeError" && exc?.value === "Failed to fetch" && exc?.mechanism?.handled === false) {
      return null;
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
