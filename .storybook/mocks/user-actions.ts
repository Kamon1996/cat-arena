import { fn } from "storybook/test";

// Browser-safe stand-ins for the "use server" admin user actions (aliased in main.ts).
export const banUser = fn(async () => ({ ok: true })).mockName("banUser");
export const unbanUser = fn(async () => ({ ok: true })).mockName("unbanUser");
export const setUserRole = fn(async () => ({ ok: true })).mockName("setUserRole");
