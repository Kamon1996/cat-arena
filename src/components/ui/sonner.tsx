"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Host for the app's toasts. Every user-facing toast is a branded cat toast
 * (see cat-toast.tsx) rendered via `toast.custom`, so each card owns its own
 * styling — the Toaster only tracks the theme and lays out the stack.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as NonNullable<ToasterProps["theme"]>}
      className="toaster group"
      expand
      gap={12}
      {...props}
    />
  );
};

export { Toaster };
