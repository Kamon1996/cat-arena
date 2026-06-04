import { publicUrl } from "@/lib/r2";

type CatImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

/**
 * next/image custom loader. R2 already serves pre-sized WebP variants from a
 * zero-egress CDN, so we bypass Vercel image optimization entirely and return
 * the CDN URL. Accepts either an absolute CDN URL or a bare R2 key.
 */
export function catImageLoader({ src }: CatImageLoaderProps): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return publicUrl(src);
}
