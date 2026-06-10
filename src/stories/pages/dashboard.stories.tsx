import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { CatCardData } from "@/components/dashboard/cat-card";
import { CatCard } from "@/components/dashboard/cat-card";

const mockCats: CatCardData[] = [
  {
    id: "cat_1",
    name: "Mittens the Magnificent",
    status: "ACTIVE",
    rank: 7,
    score: 1486,
    rating: 1642,
    rd: 22,
    wins: 218,
    losses: 96,
    timesShown: 410,
    images: [
      {
        id: "a",
        status: "APPROVED",
        rejectionReasons: [],
        thumbUrl: "https://placecats.com/300/300",
        fullUrl: "https://placecats.com/700/700",
        width: 700,
        height: 700,
      },
      {
        id: "b",
        status: "PENDING",
        rejectionReasons: [],
        thumbUrl: "https://placecats.com/301/301",
        fullUrl: "https://placecats.com/701/701",
        width: 700,
        height: 700,
      },
    ],
  },
  {
    id: "cat_2",
    name: "Sir Fluff",
    status: "PENDING",
    rank: null,
    score: 1456,
    rating: 1500,
    rd: 140,
    wins: 3,
    losses: 1,
    timesShown: 8,
    images: [
      {
        id: "c",
        status: "PENDING",
        rejectionReasons: [],
        thumbUrl: "https://placecats.com/302/302",
        fullUrl: "https://placecats.com/702/702",
        width: 700,
        height: 700,
      },
    ],
  },
];

function DashboardView() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-display text-4xl font-bold tracking-tight">My cats</h1>
      <div className="grid items-start gap-6 lg:grid-cols-2">
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
