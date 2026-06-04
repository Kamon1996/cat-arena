type CatImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

/**
 * next/image custom loader. Our server data loaders already resolve images to
 * absolute R2/CDN URLs (via publicUrl), so this returns the src verbatim —
 * bypassing Vercel image optimization entirely.
 *
 * It MUST stay client-safe: next/image runs the loader in the browser to build
 * srcset, so this file must not import server-only modules (e.g. @/lib/r2,
 * which constructs an S3 client from the validated server env and would throw
 * in the browser).
 */
export function catImageLoader({ src }: CatImageLoaderProps): string {
  return src;
}
