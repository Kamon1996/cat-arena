import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "@/components/upload/upload-form";

function UploadView() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Upload a cat</CardTitle>
          <CardDescription>
            Add a name and 1–3 photos. New cats are reviewed before they enter the arena.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
    </main>
  );
}

const meta = {
  title: "Pages/Upload",
  component: UploadView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof UploadView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
