import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const meta = {
  title: "UI/Sonner",
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
    theme: {
      control: "select",
      options: ["light", "dark", "system"],
    },
    dir: {
      control: "select",
      options: ["ltr", "rtl", "auto"],
    },
  },
  args: {
    position: "bottom-right",
    theme: "system",
    dir: "auto",
    richColors: true,
    closeButton: true,
    expand: false,
    visibleToasts: 3,
    duration: 4000,
  },
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button onClick={() => toast("Cat uploaded successfully")}>Show toast</Button>
    </>
  ),
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Success: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button onClick={() => toast.success("Your vote was counted")}>Show success</Button>
    </>
  ),
};

export const ErrorToast: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button variant="destructive" onClick={() => toast.error("Something went wrong. Try again.")}>
        Show error
      </Button>
    </>
  ),
};
