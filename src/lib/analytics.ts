"use client";

import posthog from "posthog-js";

import type { ANALYTICS_EVENT } from "@/lib/constants";

export type AnalyticsEvent = (typeof ANALYTICS_EVENT)[keyof typeof ANALYTICS_EVENT];

/**
 * Capture a product event. No PII — pass ids and counts only (cat ids, scope),
 * never names or emails. Safe to call before init: posthog-js queues events
 * until the provider loads.
 */
export function captureEvent(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  posthog.capture(event, properties);
}
