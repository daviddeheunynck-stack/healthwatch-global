// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ff3422719dcc565627288fa22104c45a@o4511456134496256.ingest.de.sentry.io/4511456149962832",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  sendDefaultPii: false,
});
