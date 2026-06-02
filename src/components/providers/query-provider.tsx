"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { PAIR_GC_TIME_MS, PAIR_STALE_TIME_MS } from "@/lib/constants";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: PAIR_STALE_TIME_MS,
            gcTime: PAIR_GC_TIME_MS,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
