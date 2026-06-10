import Image from "next/image";

type CdnImageBaseProps = {
  src: string; // absolute CDN url or bare r2 key
  alt: string;
  sizes?: string | undefined;
  priority?: boolean | undefined;
  className?: string | undefined;
};

type CdnImageProps = CdnImageBaseProps &
  ({ fill: true; width?: never; height?: never } | { fill?: false; width: number; height: number });

/**
 * next/image wrapper. The CDN loader is configured globally in next.config
 * (images.loaderFile), so every image is served straight from R2/CDN with zero
 * Vercel optimization quota. Requires width/height so the browser reserves
 * layout (CLS = 0); in `fill` mode the positioned parent must reserve space
 * itself (e.g. via aspect-ratio). Lazy by default; set priority on the LCP
 * image only.
 */
export function CdnImage(props: CdnImageProps) {
  const { src, alt, sizes, priority = false, className } = props;
  const loading = priority ? undefined : "lazy";

  if (props.fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={loading}
        className={className}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={props.width}
      height={props.height}
      sizes={sizes}
      priority={priority}
      loading={loading}
      className={className}
    />
  );
}
