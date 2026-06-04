"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-bold text-2xl tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">An unexpected error occurred. Please try again.</p>
      <Button type="button" className="mt-2" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
