import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function SignInView() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>We'll email you a magic link — no password needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3">
            <label htmlFor="email" className="font-medium text-sm">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Button type="submit" className="mt-1">
              Send sign-in link
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

const meta = {
  title: "Pages/SignIn",
  component: SignInView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SignInView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
