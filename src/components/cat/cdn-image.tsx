import Image from "next/image";

type CdnImageProps = {
  src: string; // absolute CDN url or bare r2 key
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/**
 * next/image wrapper. The CDN loader is configured globally in next.config
 * (images.loaderFile), so every image is served straight from R2/CDN with zero
 * Vercel optimization quota. Requires width/height so the browser reserves
 * layout (CLS = 0). Lazy by default; set priority on the LCP image only.
 */
export function CdnImage({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
  className,
}: CdnImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      className={className}
    />
  );
}
