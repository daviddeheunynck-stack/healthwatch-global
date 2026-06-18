import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ff3422719dcc565627288fa22104c45a@o4511456134496256.ingest.de.sentry.io/4511456149962832",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  integrations: [Sentry.replayIntegration()],
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
  beforeSend(event, hint) {
    const err = hint.originalException as { digest?: string } | null;
    if (err?.digest === "NEXT_NOT_FOUND") return null;
    if (err?.digest?.startsWith("NEXT_REDIRECT")) return null;
    return event;
  },
});
