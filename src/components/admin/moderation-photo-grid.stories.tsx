import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModerationPhotoGrid } from "@/components/admin/moderation-photo-grid";
import type { ModerationImage } from "@/moderation/moderation-types";

const IMAGES: ModerationImage[] = [
  {
    id: "1",
    thumbUrl: "https://placecats.com/400/400",
    fullUrl: "https://placecats.com/800/800",
    width: 1080,
    height: 1080,
  },
  {
    id: "2",
    thumbUrl: "https://placecats.com/420/520",
    fullUrl: "https://placecats.com/840/1040",
    width: 1080,
    height: 1350,
  },
  {
    id: "3",
    thumbUrl: "https://placecats.com/410/410",
    fullUrl: "https://placecats.com/820/820",
    width: 1080,
    height: 1080,
  },
];

const meta = {
  title: "Admin/ModerationPhotoGrid",
  component: ModerationPhotoGrid,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { images: IMAGES, catName: "Mochi", layout: "responsive" },
  argTypes: {
    layout: { control: "inline-radio", options: ["fill", "responsive", "square", "compact"] },
  },
  // Wrapped in a row-width card so the layouts read the same as in the moderation list.
  render: (args) => (
    <div className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-4">
      <ModerationPhotoGrid {...args} />
    </div>
  ),
} satisfies Meta<typeof ModerationPhotoGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Default — auto-fill tiles capped at ~15rem; wrap + left-align, never gigantic. */
export const Responsive: Story = {};

/** The previous behaviour — equal columns stretch to the full row width (large on wide screens). */
export const FillRow: Story = { args: { layout: "fill" } };

/** Uniform square thumbnails, auto-fill capped at ~11rem. */
export const Squares: Story = { args: { layout: "square" } };

/** Small fixed 6rem thumbnails, flex-wrapped — calmest / most compact. */
export const Compact: Story = { args: { layout: "compact" } };

/** A single photo doesn't blow up to full width in the responsive layout. */
export const SinglePhoto: Story = { args: { images: IMAGES.slice(0, 1) } };
