import type { MetadataRoute } from "next";

import { getIndexableCatSlugs, getIndexableOrgSlugs } from "@/data/indexable";
import { absoluteUrl, catPath, orgPath } from "@/lib/site";

// ISR: 1h. Next requires a static literal here (= ISR_REVALIDATE_SECONDS).
export const revalidate = 3600;

const HOME_PRIORITY = 1;
const TOP_PRIORITY = 0.8;
const CAT_PRIORITY = 0.6;
const ORG_PRIORITY = 0.5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cats, orgs] = await Promise.all([getIndexableCatSlugs(), getIndexableOrgSlugs()]);

  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified, priority: HOME_PRIORITY },
    { url: absoluteUrl("/top"), lastModified, priority: TOP_PRIORITY },
  ];

  const catEntries: MetadataRoute.Sitemap = cats.map(({ slug }) => ({
    url: absoluteUrl(catPath(slug)),
    lastModified,
    priority: CAT_PRIORITY,
  }));

  const orgEntries: MetadataRoute.Sitemap = orgs.map(({ slug }) => ({
    url: absoluteUrl(orgPath(slug)),
    lastModified,
    priority: ORG_PRIORITY,
  }));

  return [...staticEntries, ...catEntries, ...orgEntries];
}
