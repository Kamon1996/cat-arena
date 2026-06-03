import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { AUTH } from "@/lib/constants";
import { auth } from "./config";

/** Require any signed-in user; redirect to /signin otherwise. */
export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect(AUTH.SIGN_IN_PATH);
  }
  if (session.user.banned) {
    redirect(`${AUTH.SIGN_IN_PATH}?banned=1`);
  }
  return session;
}

/** Require MODERATOR or ADMIN; redirect home otherwise. */
export async function requireModerator(): Promise<Session> {
  const session = await requireUser();
  if (session.user.role !== "MODERATOR" && session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}

/** Require ADMIN; redirect home otherwise. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}
