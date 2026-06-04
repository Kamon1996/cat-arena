import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatDetail } from "@/components/cat/cat-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { getCatPage } from "@/data/cat-page";
import { getIndexableCatSlugs } from "@/data/indexable";
import { SITE_NAME, TOP_LEADERBOARD_LIMIT } from "@/lib/constants";
import { catJsonLd } from "@/lib/seo";
import { absoluteUrl, catPath } from "@/lib/site";

// ISR: 1h. Next requires a static literal here (= ISR_REVALIDATE_SECONDS).
export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const slugs = await getIndexableCatSlugs();
    return slugs.slice(0, TOP_LEADERBOARD_LIMIT).map(({ slug }) => ({ slug }));
  } catch {
    // No DB at build time → render every cat on demand (dynamicParams = true).
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCatPage(slug);
  if (!cat) {
    return { title: "Cat not found", robots: { index: false } };
  }
  const description = `${cat.name} — rank #${cat.rank} in the cat leaderboard. Rating ${Math.round(
    cat.rating,
  )}, ${cat.wins} wins / ${cat.losses} losses.`;
  return {
    title: cat.name,
    description,
    alternates: { canonical: absoluteUrl(catPath(cat.slug)) },
    openGraph: {
      title: `${cat.name} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(catPath(cat.slug)),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.name} | ${SITE_NAME}`,
      description,
    },
  };
}

export default async function CatPage({ params }: PageProps) {
  const { slug } = await params;
  const cat = await getCatPage(slug);
  if (!cat) {
    notFound();
  }

  return (
    <main>
      <JsonLd data={catJsonLd({ name: cat.name, slug: cat.slug, images: cat.images })} />
      <CatDetail cat={cat} />
    </main>
  );
}
