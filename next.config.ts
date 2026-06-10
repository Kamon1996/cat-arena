import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: bundles a minimal server + only the needed node_modules into
  // .next/standalone, so the Docker image (VPS deploy) ships `node server.js` without
  // the full dependency tree. No-op on Vercel (which has its own build), so it's safe
  // to leave on for both targets.
  output: "standalone",
  // Pin the file-tracing root to this project so standalone always lands flat at
  // .next/standalone/server.js. Without this, Next can root higher when parent
  // lockfiles exist, nesting the output (e.g. .next/standalone/<path>/server.js)
  // and breaking the Dockerfile COPY.
  outputFileTracingRoot: process.cwd(),
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
