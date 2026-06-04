/** Brand confetti palette — teal / tangerine / hot-pink / sunny / success-green. */
const CONFETTI_COLORS = ["#14B8A6", "#FF7A1A", "#FF4D8D", "#FFD23F", "#22C55E"] as const;

/** Default number of particles in a burst (the duel-winner celebration). */
export const CONFETTI_DEFAULT_COUNT = 46;

/** Shape distribution: paw < star < dot. */
const PAW_PROBABILITY = 0.22;
const STAR_PROBABILITY = 0.5;
const ROUND_PROBABILITY = 0.5;

const MIN_SIZE = 8;
const SIZE_JITTER = 8;
const MIN_DISTANCE = 90;
const DISTANCE_JITTER = 220;
const RISE = 80;
const FALL = 260;
const MAX_SPIN = 360;
const MIN_DURATION_MS = 900;
const DURATION_JITTER_MS = 500;
const PARTICLE_Z_INDEX = "9999";

export interface FireConfettiOptions {
  /** Burst origin, in viewport coordinates. */
  x: number;
  y: number;
  /** Element the particles are appended to. Defaults to `document.body`. */
  container?: HTMLElement;
  /** Number of particles. */
  count?: number;
}

function prefersReducedMotion(): boolean {
  // A missing matchMedia (SSR / jsdom) counts as "reduce" so the burst is skipped.
  return (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Paw / star / dot confetti burst (Web Animations API). Returns a cleanup that
 * removes any particles still in flight — call it on unmount. No-ops (and
 * returns a no-op cleanup) under `prefers-reduced-motion` or when the DOM / WAAPI
 * is unavailable (SSR, jsdom), so it is safe to call from anywhere.
 */
export function fireConfetti({
  x,
  y,
  container,
  count = CONFETTI_DEFAULT_COUNT,
}: FireConfettiOptions): () => void {
  const noop = () => {};
  if (typeof document === "undefined" || prefersReducedMotion()) {
    return noop;
  }
  const host = container ?? document.body;
  // Web Animations API is absent in jsdom / very old browsers — skip the burst.
  if (typeof host.animate !== "function") {
    return noop;
  }

  const nodes: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    // Appended to a full-screen layer → absolute; appended to <body> → fixed.
    el.style.position = container ? "absolute" : "fixed";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = PARTICLE_Z_INDEX;
    el.style.pointerEvents = "none";
    el.style.willChange = "transform, opacity";

    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? CONFETTI_COLORS[0];
    const size = MIN_SIZE + Math.random() * SIZE_JITTER;
    const kind = Math.random();
    // innerHTML is safe here: the only interpolated values are a numeric `size`
    // and `color` from the static CONFETTI_COLORS tuple — never external input.
    if (kind < PAW_PROBABILITY) {
      el.innerHTML = `<svg width="${size + 6}" height="${size + 6}" viewBox="0 0 24 24" fill="${color}"><circle cx="7" cy="8" r="2.4"/><circle cx="12" cy="6" r="2.6"/><circle cx="17" cy="8" r="2.4"/><circle cx="12" cy="15" r="4.4"/></svg>`;
    } else if (kind < STAR_PROBABILITY) {
      el.innerHTML = `<svg width="${size + 4}" height="${size + 4}" viewBox="0 0 24 24" fill="${color}"><path d="M12 2l2.6 6.6L21 9l-5 4.4L17.5 21 12 17l-5.5 4L8 13.4 3 9l6.4-.4Z"/></svg>`;
    } else {
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = color;
      el.style.borderRadius = Math.random() < ROUND_PROBABILITY ? "50%" : "3px";
    }

    host.appendChild(el);
    nodes.push(el);

    const angle = Math.random() * Math.PI * 2;
    const dist = MIN_DISTANCE + Math.random() * DISTANCE_JITTER;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - RISE;
    const rot = Math.random() * (MAX_SPIN * 2) - MAX_SPIN;
    const animation = el.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`,
          opacity: 1,
          offset: 0.7,
        },
        {
          transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + FALL}px)) rotate(${rot * 1.3}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: MIN_DURATION_MS + Math.random() * DURATION_JITTER_MS,
        easing: "cubic-bezier(.2,.6,.3,1)",
      },
    );
    animation.onfinish = () => el.remove();
  }

  return () => {
    for (const node of nodes) {
      node.remove();
    }
  };
}
