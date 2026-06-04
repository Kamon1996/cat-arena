import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SignInPageProps {
  searchParams: Promise<{
    error?: string;
    callbackUrl?: string;
    banned?: string;
  }>;
}

const GOOGLE_PROVIDER_ID = "google";

/** Google's multi-color "G" mark. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" role="img">
      <title>Google</title>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { error, callbackUrl, banned } = await searchParams;

  // Only allow relative, same-origin callbacks (prevent open redirect).
  const rawCallback = callbackUrl ?? "/";
  const safeCallback =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//") ? rawCallback : "/";

  if (session?.user) {
    redirect(safeCallback);
  }

  async function signInWithGoogle() {
    "use server";
    await signIn(GOOGLE_PROVIDER_ID, { redirectTo: safeCallback });
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Sign in with Google to upload and manage your cats.</CardDescription>
        </CardHeader>
        <CardContent>
          {banned ? (
            <p role="alert" className="mb-4 text-destructive text-sm">
              This account has been banned.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mb-4 text-destructive text-sm">
              Could not sign you in. Please try again.
            </p>
          ) : null}

          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full gap-2">
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
