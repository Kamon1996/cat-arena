import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ModerationGalleryRow } from "@/components/admin/moderation-gallery-row";
import type { ModerationCat } from "@/moderation/moderation-types";

const MINUTES_AGO = 2;
const recentIso = new Date(Date.now() - MINUTES_AGO * 60_000).toISOString();

const cat: ModerationCat = {
  id: "cat_9f2a48213b",
  name: "Mochi",
  status: "PENDING",
  createdAt: recentIso,
  owner: {
    id: "user_owner",
    name: "Aiko Tanaka",
    email: "aiko@cats.io",
    role: "USER",
    banned: false,
  },
  images: [
    { id: "img_1", thumbUrl: "https://placecats.com/400/400", width: 1080, height: 1080 },
    { id: "img_2", thumbUrl: "https://placecats.com/401/401", width: 1080, height: 1080 },
    { id: "img_3", thumbUrl: "https://placecats.com/402/402", width: 1080, height: 1350 },
  ],
};

const meta = {
  title: "Admin/ModerationGalleryRow",
  component: ModerationGalleryRow,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    cat,
    isAdmin: false,
    currentUserId: "user_admin",
    onResolved: fn(),
    onOwnerResolved: fn(),
    onOwnerRoleChanged: fn(),
  },
  // Actions reveal on hover; the row spans the content width.
  render: (args) => (
    <div className="mx-auto max-w-4xl">
      <ModerationGalleryRow {...args} />
    </div>
  ),
} satisfies Meta<typeof ModerationGalleryRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TwoPhotos: Story = {
  args: { cat: { ...cat, name: "Tofu", images: cat.images.slice(0, 2) } },
};

/** Admin sees extra owner controls (ban user, role) in the ⋯ menu. */
export const AsAdmin: Story = {
  args: { isAdmin: true },
};
