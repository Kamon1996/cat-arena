import { publicUrl } from "@/lib/r2";

/** All objects for one CatImage live under `cats/<imageId>/`. */
export function originalKey(imageId: string): string {
  return `cats/${imageId}/original`;
}

export function thumbKey(imageId: string): string {
  return `cats/${imageId}/thumb.webp`;
}

export function cardKey(imageId: string): string {
  return `cats/${imageId}/card.webp`;
}

/** Large UNCROPPED variant for lightboxes — the user's framing crop only
 *  applies to thumb/card; this one preserves the photo as shot. */
export function fullKey(imageId: string): string {
  return `cats/${imageId}/full.webp`;
}

/** Public CDN URL for a derived variant. */
export function thumbUrl(imageId: string): string {
  return publicUrl(thumbKey(imageId));
}

export function cardUrl(imageId: string): string {
  return publicUrl(cardKey(imageId));
}

export function fullUrl(imageId: string): string {
  return publicUrl(fullKey(imageId));
}
