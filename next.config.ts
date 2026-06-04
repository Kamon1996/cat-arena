import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships platform binaries and must NOT be bundled by webpack — keeping it
  // external prevents broken builds. (Image auto-screening is Cloudflare Workers AI
  // over HTTP, so there are no local model deps left to externalize.)
  serverExternalPackages: ["sharp"],
  // Custom loader → R2/CDN; bypasses Vercel image optimization quota (R2 already
  // serves pre-sized WebP). Every next/image goes straight to the CDN.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/next-image-loader.ts",
  },
};

export default nextConfig;
