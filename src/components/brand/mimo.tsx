import type { SVGProps } from "react";

export type MimoMood = "happy" | "wink" | "sleepy" | "sad";

/** Brand mascot colours — a fixed flat-sticker illustration, intentionally
 *  the same in light and dark (a white-faced cat with a hard ink outline). */
const FACE = "#FFFDFB";
const INK = "#19171C";
const EAR = "#FF4D8D";
const CHEEK = "#FFD23F";
const NOSE = "#FF7A1A";

interface MimoProps extends SVGProps<SVGSVGElement> {
  mood?: MimoMood;
}

/** "Mimo" — the WhosMeowing mascot. Used in the logo, empty states, loaders,
 *  404, the winner celebration, and the error/“sad” toast. Server-safe (no
 *  hooks). Size via className (e.g. `size-32`). */
export function Mimo({ mood = "happy", className, ...props }: MimoProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative mascot, always rendered aria-hidden alongside a text label
    <svg viewBox="0 0 160 160" fill="none" aria-hidden className={className} {...props}>
      {/* ears */}
      <path
        d="M42 56 L34 20 L74 48 Z"
        fill={FACE}
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M118 56 L126 20 L86 48 Z"
        fill={FACE}
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M48 50 L44 30 L62 44 Z" fill={EAR} />
      <path d="M112 50 L116 30 L98 44 Z" fill={EAR} />
      {/* head */}
      <circle cx="80" cy="92" r="52" fill={FACE} stroke={INK} strokeWidth="5" />
      {/* cheeks */}
      <circle cx="52" cy="102" r="9" fill={CHEEK} />
      <circle cx="108" cy="102" r="9" fill={CHEEK} />
      {/* eyes */}
      {mood === "sleepy" ? (
        <path
          d="M54 90 q10 7 20 0 M86 90 q10 7 20 0"
          stroke={INK}
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
      ) : mood === "wink" ? (
        <>
          <path
            d="M56 90 q8 -9 16 0"
            stroke={INK}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="96" cy="88" r="6.5" fill={INK} />
        </>
      ) : (
        <>
          <circle cx="64" cy="88" r="6.5" fill={INK} />
          <circle cx="96" cy="88" r="6.5" fill={INK} />
          {mood === "sad" ? (
            <path
              d="M54 76 l16 6 M106 76 l-16 6"
              stroke={INK}
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          ) : null}
        </>
      )}
      {/* nose */}
      <path
        d="M80 98 l7 7 -7 5 -7 -5 Z"
        fill={NOSE}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* mouth */}
      {mood === "wink" ? (
        <path
          d="M64 112 q16 14 32 0"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      ) : mood === "sleepy" ? (
        <path
          d="M72 112 q8 5 16 0"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      ) : mood === "sad" ? (
        <path
          d="M66 116 q14 -10 28 0"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M80 110 q-9 9 -18 2 M80 110 q9 9 18 2"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {/* whiskers */}
      <path
        d="M30 92 h22 M28 104 h24 M108 92 h22 M108 104 h24"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
