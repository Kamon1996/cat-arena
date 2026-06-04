import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import { Toaster } from "@/components/ui/sonner";

const meta = {
  title: "UI/Toaster",
  component: Toaster,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    },
    theme: { control: "select", options: ["light", "dark", "system"] },
    expand: { control: "boolean" },
  },
  args: {
    position: "bottom-right",
    theme: "light",
    expand: true,
    gap: 12,
    visibleToasts: 3,
  },
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button
        onClick={() =>
          catToast.success("Cat uploaded successfully", { message: "We'll review it shortly." })
        }
      >
        Show toast
      </Button>
    </>
  ),
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ErrorToast: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button
        variant="destructive"
        onClick={() => catToast.error("Something went wrong", { message: "Please try again." })}
      >
        Show error
      </Button>
    </>
  ),
};
