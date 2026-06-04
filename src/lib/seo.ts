import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { absoluteUrl, catPath } from "@/lib/site";

const SCHEMA_CONTEXT = "https://schema.org";
const FIRST_RANK = 1;

export type CatJsonLdInput = {
  name: string;
  slug: string;
  images: { url: string; width: number; height: number }[];
};

export type LeaderboardItem = {
  name: string;
  slug: string;
};

/** ImageGallery (with ImageObject members) + BreadcrumbList for a cat page. */
export function catJsonLd(cat: CatJsonLdInput): Record<string, unknown> {
  const canonical = absoluteUrl(catPath(cat.slug));
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      {
        "@type": "ImageGallery",
        name: cat.name,
        url: canonical,
        image: cat.images.map((img) => ({
          "@type": "ImageObject",
          contentUrl: img.url,
          width: img.width,
          height: img.height,
          name: cat.name,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: FIRST_RANK,
            name: SITE_NAME,
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: FIRST_RANK + 1,
            name: cat.name,
            item: canonical,
          },
        ],
      },
    ],
  };
}

/** ItemList of the leaderboard, in rank order (position starts at 1). */
export function leaderboardJsonLd(items: LeaderboardItem[]): Record<string, unknown> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    name: `${SITE_NAME} — top cats`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + FIRST_RANK,
      name: item.name,
      url: absoluteUrl(catPath(item.slug)),
    })),
  };
}
