import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / functional surfaces with no SEO value.
      disallow: ["/api/", "/admin", "/dashboard", "/upload", "/signin"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
