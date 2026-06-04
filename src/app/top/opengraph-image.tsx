import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/constants";

export const runtime = "nodejs";
// Must be a static literal for Next's metadata-route config (= OG_SIZE).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — leaderboard`;

const CREAM = "#FBF7EE";
const INK = "#1A1714";
const PINK = "#FF4D8D";

// Static branded card for the leaderboard (no per-request data).
export default function TopOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: CREAM,
        color: INK,
        padding: 88,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: PINK }}>{SITE_NAME}</div>
      <div
        style={{ display: "flex", fontSize: 104, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}
      >
        Top Cats
      </div>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 600, marginTop: 16, opacity: 0.7 }}>
        Ranked by Glicko-2 rating
      </div>
    </div>,
    { ...size },
  );
}
