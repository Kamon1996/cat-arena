import { fn } from "storybook/test";

// Browser-safe stand-ins for the "use server" owner actions (aliased in main.ts).
export const renameCat = fn(async () => ({ ok: true })).mockName("renameCat");
export const addCatImage = fn(async () => ({ ok: true })).mockName("addCatImage");
export const deleteCatImage = fn(async () => ({ ok: true })).mockName("deleteCatImage");
export const deleteCatOwned = fn(async () => ({ ok: true })).mockName("deleteCatOwned");
