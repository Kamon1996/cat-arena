import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    dir: {
      control: "select",
      options: ["ltr", "rtl"],
    },
  },
  args: {
    defaultValue: "tabby",
    dir: "ltr",
    name: "breed",
    disabled: false,
    required: false,
    onValueChange: fn(),
    onOpenChange: fn(),
  },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Pick a breed" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="tabby">Tabby</SelectItem>
        <SelectItem value="siamese">Siamese</SelectItem>
        <SelectItem value="maine-coon">Maine Coon</SelectItem>
        <SelectItem value="persian">Persian</SelectItem>
      </SelectContent>
    </Select>
  ),
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDefaultValue: Story = {
  args: {
    defaultValue: "siamese",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
