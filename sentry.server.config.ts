// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enableLogs: true,
  sendDefaultPii: false,

  // ignoreErrors matches on message/name — covers standard Error wrapping
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],

  // beforeSend covers App Router's notFound() / redirect() which throw plain
  // objects with a `digest` field instead of standard Errors, so ignoreErrors
  // alone does not catch them.
  beforeSend(event, hint) {
    const err = hint.originalException as { digest?: string } | null;
    if (err?.digest === "NEXT_NOT_FOUND") return null;
    if (err?.digest?.startsWith("NEXT_REDIRECT")) return null;
    return event;
  },
});
