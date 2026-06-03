import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const here = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  staticDirs: ["../public"],
  async viteFinal(cfg) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(cfg, {
      resolve: {
        alias: {
          // Replace "use server" modules with browser-safe fn() spies so client
          // components that call server actions render in Storybook (clicks log to Actions).
          "@/cats/owner-actions": resolve(here, "mocks/owner-actions.ts"),
          "@/admin/user-actions": resolve(here, "mocks/user-actions.ts"),
          "@/moderation/moderation-actions": resolve(here, "mocks/moderation-actions.ts"),
          "@/moderation/moderation-queue": resolve(here, "mocks/moderation-queue.ts"),
        },
      },
    });
  },
};

export default config;
