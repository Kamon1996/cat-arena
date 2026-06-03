import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { AUTH } from "@/lib/constants";

interface SignInPageProps {
  searchParams: Promise<{ sent?: string; error?: string; callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { sent, error, callbackUrl } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? "/");
  }

  async function signInWithEmail(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    await signIn(AUTH.PROVIDER_ID, {
      email,
      redirectTo: callbackUrl ?? "/",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="font-semibold text-2xl">Sign in</h1>

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          Could not send the sign-in link. Please try again.
        </p>
      )}

      {sent ? (
        <p className="text-gray-700 text-sm">
          Check your email for a sign-in link. You can close this tab.
        </p>
      ) : (
        <form action={signInWithEmail} className="flex flex-col gap-3">
          <label htmlFor="email" className="font-medium text-sm">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 font-medium text-sm text-white"
          >
            Send sign-in link
          </button>
        </form>
      )}
    </main>
  );
}
