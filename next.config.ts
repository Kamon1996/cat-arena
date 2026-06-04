import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships platform binaries and must NOT be bundled by webpack — keeping it
  // external prevents broken builds. (Image auto-screening is Cloudflare Workers AI
  // over HTTP, so there are no local model deps left to externalize.)
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
