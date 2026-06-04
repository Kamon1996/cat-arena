import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    children: "Badge",
    variant: "default",
    dot: false,
    asChild: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "solid",
        "success",
        "warning",
        "destructive",
        "outline",
        "ghost",
        "link",
      ],
    },
    dot: { control: "boolean" },
    asChild: { control: "boolean" },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "Secondary" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Banned" } };
export const Outline: Story = { args: { variant: "outline", children: "Outline" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Ghost" } };
export const Link: Story = { args: { variant: "link", children: "Link" } };

/** Status-style badges with a leading dot — used in the leaderboard + admin tables. */
export const StatusDots: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="success" dot>
        Approved
      </Badge>
      <Badge variant="warning" dot>
        In review
      </Badge>
      <Badge variant="destructive" dot>
        Rejected
      </Badge>
      <Badge variant="outline">12 entries</Badge>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(
        [
          "default",
          "secondary",
          "solid",
          "success",
          "warning",
          "destructive",
          "outline",
          "ghost",
          "link",
        ] as const
      ).map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};
