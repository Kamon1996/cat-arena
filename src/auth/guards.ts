import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { AUTH } from "@/lib/constants";
import { auth } from "./config";
import { isAdmin, isStaff } from "./roles";

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
  if (!isStaff(session.user.role)) {
    redirect("/");
  }
  return session;
}

/** Require ADMIN; redirect home otherwise. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!isAdmin(session.user.role)) {
    redirect("/");
  }
  return session;
}
