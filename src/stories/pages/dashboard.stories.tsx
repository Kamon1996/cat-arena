import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { CatCardData } from "@/components/dashboard/cat-card";
import { CatCard } from "@/components/dashboard/cat-card";

const mockCats: CatCardData[] = [
  {
    id: "cat_1",
    name: "Mittens the Magnificent",
    status: "ACTIVE",
    images: [
      { id: "a", status: "APPROVED", thumbUrl: "https://placecats.com/300/300" },
      { id: "b", status: "PENDING", thumbUrl: "https://placecats.com/301/301" },
    ],
  },
  {
    id: "cat_2",
    name: "Sir Fluff",
    status: "PENDING",
    images: [{ id: "c", status: "PENDING", thumbUrl: "https://placecats.com/302/302" }],
  },
  {
    id: "cat_3",
    name: "Banned Bob",
    status: "BANNED",
    images: [{ id: "d", status: "REJECTED", thumbUrl: "https://placecats.com/303/303" }],
  },
];

function DashboardView() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-bold text-3xl tracking-tight">My cats</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockCats.map((cat) => (
          <CatCard key={cat.id} cat={cat} />
        ))}
      </div>
    </main>
  );
}

const meta = {
  title: "Pages/Dashboard",
  component: DashboardView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
