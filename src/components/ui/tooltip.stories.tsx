import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    defaultOpen: true,
    delayDuration: 0,
    disableHoverableContent: false,
    onOpenChange: fn(),
  },
  render: (args) => (
    <TooltipProvider>
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>Vote for the better cat</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = {
  args: {
    defaultOpen: true,
  },
  render: (args) => (
    <TooltipProvider>
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <Button variant="outline">Always shown</Button>
        </TooltipTrigger>
        <TooltipContent>This tooltip starts open</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const TopSide: Story = {
  args: {
    defaultOpen: true,
  },
  render: (args) => (
    <TooltipProvider>
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <Button variant="outline">Top tooltip</Button>
        </TooltipTrigger>
        <TooltipContent side="top">Shown above the trigger</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
