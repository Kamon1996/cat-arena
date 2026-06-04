import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoreHorizontal } from "lucide-react";
import { fn } from "storybook/test";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const meta = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="More actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={fn()}>Hide from arena</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={fn()}>
          Ban cat
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={fn()}>
          Delete cat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Owner · aiko@cats.io</DropdownMenuLabel>
        <DropdownMenuItem onSelect={fn()}>Make moderator</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={fn()}>
          Ban user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
