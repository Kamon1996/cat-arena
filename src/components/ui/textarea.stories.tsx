import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Textarea } from "@/components/ui/textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    placeholder: "Tell the world about your cat…",
    rows: 4,
    disabled: false,
  },
  argTypes: {
    disabled: { control: "boolean" },
  },
  render: (args) => (
    <div className="w-80">
      <Textarea {...args} />
    </div>
  ),
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: { defaultValue: "Mochi is a very fluffy ragdoll who is extremely good at napping." },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "too short" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Read-only while saving…" },
};
