import { catImageLoader } from "@/lib/cat-image-loader";

/**
 * next/image `loaderFile` entry. Next.js requires a DEFAULT export here; this
 * is a framework-required loader file (same exemption class as page/route), so
 * the default export is allowed. It delegates to the tested named loader.
 */
export default function loader(props: { src: string; width: number; quality?: number }): string {
  return catImageLoader(props);
}
