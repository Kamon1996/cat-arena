import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import ErrorBoundary from "@/app/error";

const meta = {
  title: "Pages/Error",
  component: ErrorBoundary,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { error: new Error("Boom"), reset: fn() },
};
