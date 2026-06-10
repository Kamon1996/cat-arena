"use client";

import { useState } from "react";
import {
  ColumnsPhotoAlbum,
  type RenderImageContext,
  type RenderImageProps,
} from "react-photo-album";
import SSR from "react-photo-album/ssr";

import { CdnImage } from "@/components/cat/cdn-image";
import { PhotoLightbox } from "@/components/dashboard/photo-lightbox";

import "react-photo-album/columns.css";

const LCP_INDEX = 0;
/**
 * Pre-rendered layout widths for the zero-CLS SSR wrapper. The largest matches
 * the max-w-3xl article (768px) minus p-4 horizontal padding; CSS container
 * queries pick the right one before hydration.
 */
const GALLERY_BREAKPOINTS = [368, 568, 736];
const GALLERY_SIZES = {
  size: "736px",
  sizes: [{ viewport: "(max-width: 768px)", size: "calc(100vw - 32px)" }],
};

export type CatPhoto = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

function renderCdnImage(
  { alt = "", sizes }: RenderImageProps,
  { photo, width, height, index }: RenderImageContext<CatPhoto>,
) {
  return (
    <div
      style={{
        width: "100%",
        position: "relative",
        aspectRatio: `${width} / ${height}`,
      }}
    >
      <CdnImage fill src={photo.src} alt={alt} sizes={sizes} priority={index === LCP_INDEX} />
    </div>
  );
}

type CatPhotoAlbumProps = {
  catName: string;
  photos: CatPhoto[];
};

/**
 * Client leaf: react-photo-album needs function props (render.image, onClick),
 * which can't cross the server→client boundary, so the album lives here while
 * the rest of the cat page stays server-rendered. Clicking a photo (the album
 * wraps each one in a real <button>) opens the polaroid lightbox.
 */
export function CatPhotoAlbum({ catName, photos }: CatPhotoAlbumProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <SSR breakpoints={GALLERY_BREAKPOINTS}>
        <ColumnsPhotoAlbum
          photos={photos}
          render={{ image: renderCdnImage }}
          onClick={({ index }) => setOpenIndex(index)}
          sizes={GALLERY_SIZES}
        />
      </SSR>
      <PhotoLightbox
        catName={catName}
        photos={photos.map((photo) => ({
          url: photo.src,
          width: photo.width,
          height: photo.height,
        }))}
        openIndex={openIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
