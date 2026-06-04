import type { Role } from "@prisma/client";

// Role-based access helpers — the single source of truth for "who can see/do what".
// Pure (type-only Prisma import, erased at build) so both Server Components and the
// route guards can share them. The /admin tree is gated by `isStaff` (guards.ts);
// user management + destructive actions are gated by `isAdmin`.

/** MODERATOR or ADMIN — may open the admin / moderation area. */
export function isStaff(role: Role): boolean {
  return role === "MODERATOR" || role === "ADMIN";
}

/** ADMIN only — may manage users and perform destructive admin actions. */
export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}
