import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/server-only deps used by the upload+moderation pipeline must NOT be
  // bundled by webpack — they ship platform binaries (sharp, tfjs-node) or load
  // models at runtime (nsfwjs). Keeping them external prevents broken builds.
  serverExternalPackages: ["sharp", "@tensorflow/tfjs-node", "nsfwjs"],
};

export default nextConfig;
