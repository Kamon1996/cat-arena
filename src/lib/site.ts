import { SITE_URL } from "@/lib/constants";

/** Absolute canonical URL for a site-relative path (leading slash optional). */
export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

/** Canonical site-relative path for a cat page. */
export function catPath(slug: string): string {
  return `/cat/${slug}`;
}

/** Canonical site-relative path for an organization page. */
export function orgPath(slug: string): string {
  return `/org/${slug}`;
}
