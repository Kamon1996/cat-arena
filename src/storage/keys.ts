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

/** Public CDN URL for a derived variant. */
export function thumbUrl(imageId: string): string {
  return publicUrl(thumbKey(imageId));
}

export function cardUrl(imageId: string): string {
  return publicUrl(cardKey(imageId));
}
