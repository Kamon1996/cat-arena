import Link from "next/link";

import { auth, signOut } from "@/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="flex items-center justify-between gap-2 border-b p-4">
      <Link href="/" className="font-bold text-xl">
        Cat Arena
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {session?.user ? (
          <>
            <span className="text-muted-foreground">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="underline">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/signin" className="underline">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
