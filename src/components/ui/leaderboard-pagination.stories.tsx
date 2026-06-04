import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LeaderboardPagination } from "@/components/ui/leaderboard-pagination";

const meta = {
  title: "UI/LeaderboardPagination",
  component: LeaderboardPagination,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    page: 2,
    pageCount: 5,
    basePath: "/top",
  },
} satisfies Meta<typeof LeaderboardPagination>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A middle page — both Previous and Next are active. */
export const Middle: Story = {};

/** First page — Previous is disabled. */
export const FirstPage: Story = {
  args: { page: 1, pageCount: 5 },
};

/** Last page — Next is disabled. */
export const LastPage: Story = {
  args: { page: 5, pageCount: 5 },
};
