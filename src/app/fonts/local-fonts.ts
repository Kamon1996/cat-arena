import localFont from "next/font/local";

/**
 * Brand fonts, self-hosted via next/font/local (no runtime request, no layout shift).
 * Clash Display — display / headings / cat names / vote CTAs.
 * General Sans — body & UI.
 * Both vendored from Fontshare into ./*.woff2.
 */
export const clashDisplay = localFont({
  src: [
    { path: "./ClashDisplay-Semibold.woff2", weight: "600", style: "normal" },
    { path: "./ClashDisplay-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-clash-display",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const generalSans = localFont({
  src: [
    { path: "./GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
