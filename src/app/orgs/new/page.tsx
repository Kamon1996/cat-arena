import type { Metadata } from "next";

import { requireUser } from "@/auth/guards";
import { OrgCreateForm } from "@/components/org/org-create-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create an organization",
  description: "Start a private cat-rating organization with its own leaderboard.",
};

export default async function NewOrgPage() {
  await requireUser();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create an organization</CardTitle>
          <CardDescription>
            You can create one organization. Share its join code so cat owners can enter their cats
            into your private leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgCreateForm />
        </CardContent>
      </Card>
    </main>
  );
}
