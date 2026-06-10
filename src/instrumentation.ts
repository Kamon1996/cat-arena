import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Clean up DB/Redis connections on SIGTERM (container restart/stop).
    const { registerShutdownHandlers } = await import("./lib/shutdown");
    registerShutdownHandlers();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures Server Component / route errors (Next.js 15 hook).
export const onRequestError = Sentry.captureRequestError;
