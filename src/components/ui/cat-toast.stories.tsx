import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { Button } from "@/components/ui/button";
import { CatToast, catToast } from "@/components/ui/cat-toast";
import { Toaster } from "@/components/ui/sonner";

const meta = {
  title: "UI/CatToast",
  component: CatToast,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "select", options: ["sticker", "mascot"] },
    tone: { control: "select", options: ["success", "error"] },
    dismissible: { control: "boolean" },
    confetti: { control: "boolean" },
  },
  args: {
    id: "story",
    variant: "sticker",
    tone: "success",
    title: "Vote counted",
    message: "Mochi climbed the ranks — nice eye!",
    dismissible: true,
    confetti: false,
  },
} satisfies Meta<typeof CatToast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { action: { label: "Undo", onClick: fn() } },
};

export const StickerError: Story = {
  args: { tone: "error", title: "That vote didn't count", message: "Give it another try." },
};

export const Mascot: Story = {
  args: {
    variant: "mascot",
    title: "Your cat's in the arena!",
    message: "We'll review the photos, then the duels begin.",
  },
};

export const MascotError: Story = {
  args: {
    variant: "mascot",
    tone: "error",
    title: "Photo rejected",
    message: "No people or other pets, please.",
    action: { label: "Re-upload", onClick: fn() },
  },
};

/** Fires real toasts through `catToast` with the app's Toaster — mascot
 *  confetti (bespoke) plus the host's stacking, swipe-to-dismiss and timing. */
export const Live: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex min-h-svh flex-wrap items-center justify-center gap-3 p-6">
      <Toaster />
      <Button
        onClick={() =>
          catToast.success("Your cat's in the arena!", {
            variant: "mascot",
            message: "We'll review the photos, then the duels begin.",
          })
        }
      >
        Mascot success
      </Button>
      <Button
        variant="destructive"
        onClick={() =>
          catToast.error("Could not add photo", {
            variant: "mascot",
            message: "Please try again.",
          })
        }
      >
        Mascot error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          catToast.success("Vote counted", {
            message: "Mochi climbed the ranks!",
            action: { label: "Undo", onClick: fn() },
          })
        }
      >
        Sticker + action
      </Button>
    </div>
  ),
};
