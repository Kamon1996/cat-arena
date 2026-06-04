import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { RejectReasonsDialog } from "@/components/admin/reject-reasons-dialog";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Admin/RejectReasonsDialog",
  component: RejectReasonsDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    open: false,
    catName: "Mochi",
    pending: false,
    onOpenChange: fn(),
    onConfirm: fn(),
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Reject…
        </Button>
        <RejectReasonsDialog
          {...args}
          open={open}
          onOpenChange={setOpen}
          onConfirm={(reasons) => {
            args.onConfirm(reasons);
            setOpen(false);
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof RejectReasonsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
