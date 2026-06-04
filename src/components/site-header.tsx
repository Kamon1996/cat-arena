import Link from "next/link";

import { auth, signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="flex items-center justify-between gap-2 border-b-2 border-border bg-background px-4 py-3">
      <Link href="/" className="font-display text-2xl font-bold tracking-tight text-foreground">
        Whos<span className="text-primary">Meowing</span>
      </Link>
      <nav className="flex items-center gap-1.5 text-sm sm:gap-2">
        <ThemeToggle />
        {session?.user ? (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">My cats</Link>
            </Button>
            <span className="hidden text-muted-foreground sm:inline">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <Button asChild size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
