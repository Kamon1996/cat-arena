import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";

// SiteHeader is an async server component that calls auth(); it cannot be
// rendered directly in Storybook. This is a static presentational replica of
// the signed-out header markup, matching the real header's look.
function SiteHeaderPreview() {
  return (
    <header className="flex w-full items-center justify-between gap-2 border-b p-4">
      <a href="/" className="font-bold text-xl">
        Cat Arena
      </a>
      <nav className="flex items-center gap-4 text-sm">
        <Button variant="link" className="underline">
          Sign in
        </Button>
      </nav>
    </header>
  );
}

const meta = {
  title: "Layout/SiteHeader",
  component: SiteHeaderPreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {},
} satisfies Meta<typeof SiteHeaderPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SignedOut: Story = {};
