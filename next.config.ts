import { withSentryConfig } from "@sentry/nextjs";
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

// Source-map upload runs only when SENTRY_AUTH_TOKEN/ORG/PROJECT are set (CI);
// locally it's skipped silently. Error reporting works from the DSN regardless.
// Conditional spread keeps optional keys absent (not `undefined`) for strict tsconfig.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
});
