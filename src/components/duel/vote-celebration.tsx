"use client";

import { Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

import { Mimo } from "@/components/brand/mimo";
import { fireConfetti } from "@/lib/confetti";

export interface Celebration {
  /** Unique per vote so AnimatePresence + confetti replay each time. */
  id: number;
  /** Burst origin in viewport coordinates (winner card centre). */
  x: number;
  y: number;
  name: string;
}

/** Full-screen layer that hosts a single confetti burst (see lib/confetti). */
function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    return fireConfetti({ x, y, container: layer });
  }, [x, y]);

  return (
    <div
      ref={layerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-60 overflow-hidden"
    />
  );
}

/** Celebration overlay shown when a cat is picked: confetti + mascot pop + a
 *  rating-flash banner. The flash is intentionally number-free — voting is blind
 *  and the real Glicko delta is not exposed to the client. */
export function VoteCelebration({ celebration }: { celebration: Celebration | null }) {
  return (
    <AnimatePresence>
      {celebration ? (
        <div key={celebration.id}>
          <ConfettiBurst x={celebration.x} y={celebration.y} />

          <motion.div
            aria-hidden
            className="pointer-events-none fixed top-1/2 left-1/2 z-55 -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 0, opacity: 0, y: 0 }}
            animate={{ scale: 1, opacity: 1, y: -40 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
          >
            <Mimo mood="wink" className="size-40 drop-shadow-[0_8px_0_var(--border-ink)]" />
          </motion.div>

          <motion.div
            role="status"
            className="pointer-events-none fixed top-20 left-1/2 z-60 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-3 font-display font-semibold text-background shadow-soft"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <Star className="size-4 fill-delight text-delight" />
            {celebration.name} climbed the ranks!
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
