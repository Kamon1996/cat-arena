"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheckIcon, OctagonXIcon, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Mimo } from "@/components/brand/mimo";
import { fireConfetti } from "@/lib/confetti";
import { CAT_TOAST_CONFETTI_COUNT, CAT_TOAST_DURATION_MS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type CatToastTone = "success" | "error";

export interface CatToastAction {
  label: string;
  onClick: () => void;
}

/** Let the confetti burst start once the toast has animated into place. */
const CONFETTI_SETTLE_MS = 120;
/** Burst origin: just inside the card's leading (icon) edge. */
const CONFETTI_ORIGIN_INSET_PX = 26;

/** Soft tinted surface for the icon/mascot chip — tone mixed into the card color. */
const TONE_SOFT_SURFACE = "bg-[color-mix(in_oklab,var(--tone)_18%,var(--card))]";
/** Saturated, contrast-safe tone for glyphs and the action link. */
const TONE_STRONG_TEXT = "text-[color-mix(in_oklab,var(--tone)_55%,var(--foreground))]";

const catToastCard = cva(
  "pointer-events-auto flex w-[380px] max-w-[calc(100vw-2rem)] items-center gap-3 border-2 border-ink bg-card font-sans text-card-foreground",
  {
    variants: {
      variant: {
        sticker: "rounded-lg px-4 py-3.5 shadow-sticker",
        mascot: "rounded-lg py-3.5 pr-4 pl-3.5 shadow-sticker-lg",
      },
    },
    defaultVariants: { variant: "sticker" },
  },
);

export interface CatToastProps extends VariantProps<typeof catToastCard> {
  /** Sonner toast id — used to dismiss from the action / close button. */
  id: string | number;
  tone?: CatToastTone;
  title: string;
  message?: string;
  action?: CatToastAction;
  /** Show the × close button. */
  dismissible?: boolean;
  /** Fire a confetti burst on mount. */
  confetti?: boolean;
  className?: string;
}

/**
 * The WhosMeowing toast card. Render it through Sonner's `toast.custom` (or the
 * `catToast` sugar below) — never directly. `sticker` shows a tone-coloured icon
 * circle; `mascot` shows Mimo (happy on success, sad on error).
 */
export function CatToast({
  id,
  variant = "sticker",
  tone = "success",
  title,
  message,
  action,
  dismissible = true,
  confetti = false,
  className,
}: CatToastProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isError = tone === "error";

  useEffect(() => {
    if (!confetti) {
      return;
    }
    const node = ref.current;
    if (!node) {
      return;
    }
    let cleanup = () => {};
    const timer = window.setTimeout(() => {
      const rect = node.getBoundingClientRect();
      cleanup = fireConfetti({
        x: rect.left + CONFETTI_ORIGIN_INSET_PX,
        y: rect.top + rect.height / 2,
        count: CAT_TOAST_CONFETTI_COUNT,
      });
    }, CONFETTI_SETTLE_MS);
    return () => {
      window.clearTimeout(timer);
      cleanup();
    };
  }, [confetti]);

  return (
    <div
      ref={ref}
      role={isError ? "alert" : "status"}
      style={{ "--tone": isError ? "var(--destructive)" : "var(--success)" } as CSSProperties}
      className={cn(catToastCard({ variant }), className)}
    >
      {variant === "mascot" ? (
        <span
          className={cn(
            "grid size-13 shrink-0 place-items-center rounded-[1rem] border-2 border-ink",
            TONE_SOFT_SURFACE,
          )}
        >
          <Mimo mood={isError ? "sad" : "happy"} className="size-10" />
        </span>
      ) : (
        <span
          className={cn(
            "grid size-9.5 shrink-0 place-items-center rounded-full border-2 border-ink",
            TONE_SOFT_SURFACE,
            TONE_STRONG_TEXT,
          )}
        >
          {isError ? (
            <OctagonXIcon className="size-5" aria-hidden />
          ) : (
            <CircleCheckIcon className="size-5" aria-hidden />
          )}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[0.9375rem] leading-tight">{title}</p>
        {message ? (
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground leading-snug">{message}</p>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            toast.dismiss(id);
          }}
          className={cn(
            "shrink-0 cursor-pointer rounded-sm font-display font-semibold text-[0.8125rem] underline decoration-2 underline-offset-2 hover:opacity-75 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
            TONE_STRONG_TEXT,
          )}
        >
          {action.label}
        </button>
      ) : null}

      {dismissible ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => toast.dismiss(id)}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** The card owns all of its chrome, so we null out any styling Sonner might
 *  apply to the toast `<li>` (defensive against a Toaster-level
 *  `toastOptions.style` regaining a border/shadow → no double border). */
const RESET_TOAST_CHROME: CSSProperties = {
  border: "none",
  boxShadow: "none",
  borderRadius: 0,
  background: "transparent",
  padding: 0,
};

export interface CatToastOptions {
  variant?: CatToastProps["variant"];
  tone?: CatToastTone;
  message?: string;
  action?: CatToastAction;
  dismissible?: boolean;
  /** `true`/`false`, or `"auto"` → fire on mascot-success (the delight cards). */
  confetti?: boolean | "auto";
  /** ms; `0` = sticky (no auto-dismiss). */
  duration?: number;
}

/**
 * One-liner sugar over `toast.custom` — the single toast API for the app. Use
 * the `sticker` variant (default) for everyday feedback and `mascot` for the
 * delight moments (uploads, milestones), which also auto-fire confetti.
 *
 *   catToast.success("Name updated");
 *   catToast.success("Your cat's in the arena!", { variant: "mascot" });
 *   catToast.error("Upload failed", { variant: "mascot", action: { label: "Retry", onClick } });
 */
export const catToast = {
  show({
    variant = "sticker",
    tone = "success",
    title,
    message,
    action,
    dismissible = true,
    confetti = "auto",
    duration = CAT_TOAST_DURATION_MS,
  }: CatToastOptions & { title: string }) {
    const fire =
      confetti === true || (confetti === "auto" && tone === "success" && variant === "mascot");
    return toast.custom(
      (id) => (
        <CatToast
          id={id}
          variant={variant}
          tone={tone}
          title={title}
          dismissible={dismissible}
          confetti={fire}
          {...(message !== undefined ? { message } : {})}
          {...(action !== undefined ? { action } : {})}
        />
      ),
      {
        duration: duration === 0 ? Number.POSITIVE_INFINITY : duration,
        style: RESET_TOAST_CHROME,
      },
    );
  },
  success(title: string, options?: Omit<CatToastOptions, "tone">) {
    return this.show({ ...options, tone: "success", title });
  },
  error(title: string, options?: Omit<CatToastOptions, "tone">) {
    return this.show({ ...options, tone: "error", title });
  },
};
