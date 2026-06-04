import { ImageResponse } from "next/og";

import { getCatPage } from "@/data/cat-page";
import { SITE_NAME } from "@/lib/constants";

// Reuses getCatPage (Prisma) — pin to Node so it can hit the DB.
export const runtime = "nodejs";
// Must be a static literal for Next's metadata-route config (= size).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — cat card`;

const CREAM = "#FBF7EE";
const INK = "#1A1714";
const PINK = "#FF4D8D";

type OgProps = {
  params: Promise<{ slug: string }>;
};

export default async function CatOgImage({ params }: OgProps) {
  const { slug } = await params;
  const cat = await getCatPage(slug);
  const name = cat?.name ?? SITE_NAME;
  const rank = cat ? `#${cat.rank}` : "";
  const imageUrl = cat?.images[0]?.url;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: CREAM,
        color: INK,
        fontFamily: "sans-serif",
      }}
    >
      {imageUrl ? (
        // biome-ignore lint/performance/noImgElement: next/og ImageResponse renders raw img, not next/image
        <img
          src={imageUrl}
          alt=""
          width={size.height}
          height={size.height}
          style={{ objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          flex: 1,
        }}
      >
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
        {rank ? (
          <div style={{ fontSize: 44, fontWeight: 700, color: PINK, marginTop: 16 }}>
            Leaderboard rank {rank}
          </div>
        ) : null}
        <div style={{ fontSize: 32, opacity: 0.6, marginTop: 28 }}>{SITE_NAME}</div>
      </div>
    </div>,
    { ...size },
  );
}
