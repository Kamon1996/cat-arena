import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    type: "text",
    placeholder: "Name your cat…",
    defaultValue: "Mittens",
    disabled: false,
  },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "url", "tel"],
    },
    disabled: { control: "boolean" },
  },
  render: (args) => (
    <div className="w-72">
      <Input {...args} />
    </div>
  ),
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = {
  args: { defaultValue: undefined, placeholder: "Name your cat…" },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
};

export const Invalid: Story = {
  args: { defaultValue: "not-an-email", "aria-invalid": true },
};
