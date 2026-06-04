"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

// Enables recommended behaviors incl. automatic SPA $pageview/$pageleave capture.
const POSTHOG_DEFAULTS = "2026-01-30" as const;
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

type PostHogProviderProps = {
  children: React.ReactNode;
};

let initialized = false;

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (initialized || !key) {
      return;
    }
    initialized = true;
    posthog.init(key, {
      api_host: host ?? DEFAULT_POSTHOG_HOST,
      defaults: POSTHOG_DEFAULTS,
      // Don't create profiles for anonymous voters — keeps event costs down.
      person_profiles: "identified_only",
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug();
        }
      },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
