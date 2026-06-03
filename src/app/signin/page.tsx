import { redirect } from "next/navigation";
import { z } from "zod";

import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AUTH } from "@/lib/constants";

interface SignInPageProps {
  searchParams: Promise<{
    sent?: string;
    type?: string;
    error?: string;
    callbackUrl?: string;
    banned?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { sent, type, error, callbackUrl, banned } = await searchParams;

  // Only allow relative, same-origin callbacks (prevent open redirect).
  const rawCallback = callbackUrl ?? "/";
  const safeCallback =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//") ? rawCallback : "/";

  if (session?.user) {
    redirect(safeCallback);
  }

  async function signInWithEmail(formData: FormData) {
    "use server";
    const parsed = z.email().safeParse(formData.get("email"));
    if (!parsed.success) {
      redirect(`${AUTH.SIGN_IN_PATH}?error=1`);
    }
    await signIn(AUTH.PROVIDER_ID, {
      email: parsed.data,
      redirectTo: safeCallback,
    });
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>We'll email you a magic link — no password needed.</CardDescription>
        </CardHeader>
        <CardContent>
          {banned ? (
            <p role="alert" className="mb-4 text-destructive text-sm">
              This account has been banned.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mb-4 text-destructive text-sm">
              Could not send the sign-in link. Please try again.
            </p>
          ) : null}

          {sent || type ? (
            <p className="text-muted-foreground text-sm">
              Check your email for a sign-in link. You can close this tab.
            </p>
          ) : (
            <form action={signInWithEmail} className="flex flex-col gap-3">
              <label htmlFor="email" className="font-medium text-sm">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              <Button type="submit" className="mt-1">
                Send sign-in link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
