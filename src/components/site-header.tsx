import Link from "next/link";

import { auth, isStaff, signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { AUTH, ROUTES } from "@/lib/constants";

export async function SiteHeader() {
  const session = await auth();
  // Admin link is visible only to staff (MODERATOR/ADMIN); the /admin tree is also
  // server-guarded by requireModerator, so a plain user can never reach it either way.
  const showAdmin = session?.user ? isStaff(session.user.role) : false;

  return (
    <header className="flex items-center justify-between gap-2 border-b-2 border-border bg-background px-4 py-3">
      <Link
        href={ROUTES.HOME}
        className="font-display text-2xl font-bold tracking-tight text-foreground"
      >
        Whos<span className="text-primary">Meowing</span>
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1.5 text-sm sm:gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={ROUTES.TOP}>Leaderboard</Link>
        </Button>
        <ThemeToggle />
        {session?.user ? (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={ROUTES.DASHBOARD}>My cats</Link>
            </Button>
            {showAdmin ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.ADMIN}>Admin</Link>
              </Button>
            ) : null}
            <span className="hidden text-muted-foreground sm:inline">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: ROUTES.HOME });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <Button asChild size="sm">
            <Link href={AUTH.SIGN_IN_PATH}>Sign in</Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
