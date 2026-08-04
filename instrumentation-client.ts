// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ff3422719dcc565627288fa22104c45a@o4511456134496256.ingest.de.sentry.io/4511456149962832",

  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],

  // NEXT_PUBLIC_VERCEL_ENV = production | preview | development (set via next.config.ts)
  // NODE_ENV is always "production" on Vercel — NEXT_PUBLIC_VERCEL_ENV distinguishes previews
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enableLogs: true,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
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
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
