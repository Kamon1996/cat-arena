import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { ANON_ID_COOKIE } from "@/lib/constants";

const ANON_ID_BYTES = 16;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Read the anon cookie, or mint + persist a new opaque id. */
export async function getOrCreateAnonId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(ANON_ID_COOKIE)?.value;
  if (existing) {
    return existing;
  }
  const id = randomBytes(ANON_ID_BYTES).toString("base64url");
  jar.set(ANON_ID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return id;
}

/** voterKey = "user:<id>" when authenticated, else the raw anonId. */
export function voterKeyFor(anonId: string, userId: string | null): string {
  return userId ? `user:${userId}` : anonId;
}
