import { ImageResponse } from "next/og";

import { getCatPage } from "@/data/cat-page";
import { SITE_NAME } from "@/lib/constants";

// Reuses getCatPage (Prisma) — pin to Node so it can hit the DB.
export const runtime = "nodejs";
// Must be a static literal for Next's metadata-route config (= OG_SIZE).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — cat card`;

const CREAM = "#FBF7EE";
const INK = "#1A1714";
const PINK = "#FF4D8D";

type OgProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Branded text card. Satori (next/og) can't decode our WebP CDN images, so we
 * render a type treatment (name + rank + wordmark) instead of embedding the photo.
 * Every multi-child element carries display:flex, as Satori requires.
 */
export default async function CatOgImage({ params }: OgProps) {
  const { slug } = await params;
  const cat = await getCatPage(slug);
  const name = cat?.name ?? SITE_NAME;
  const rank = cat ? `#${cat.rank}` : "";

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
        {name}
      </div>
      {rank ? (
        <div style={{ display: "flex", fontSize: 52, fontWeight: 700, marginTop: 20 }}>
          Leaderboard rank {rank}
        </div>
      ) : null}
    </div>,
    { ...size },
  );
}
