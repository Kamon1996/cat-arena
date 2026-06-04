import * as Sentry from "@sentry/nextjs";

// DSN is public by design. Client reads the NEXT_PUBLIC_ copy (server uses SENTRY_DSN).
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const TRACES_SAMPLE_RATE = 0.2;
const REPLAY_SESSION_SAMPLE_RATE = 0.1;
const REPLAY_ON_ERROR_SAMPLE_RATE = 1.0;

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: TRACES_SAMPLE_RATE,
  replaysSessionSampleRate: REPLAY_SESSION_SAMPLE_RATE,
  replaysOnErrorSampleRate: REPLAY_ON_ERROR_SAMPLE_RATE,
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
  debug: false,
});

// Instruments App Router client-side navigations for tracing (Sentry + Next 15).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
