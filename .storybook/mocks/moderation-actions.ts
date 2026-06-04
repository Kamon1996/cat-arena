import { fn } from "storybook/test";

// Browser-safe stand-ins for the "use server" moderation actions (aliased in main.ts).
export const approveImageAction = fn(async () => ({ ok: true })).mockName("approveImageAction");
export const rejectImageAction = fn(async () => ({ ok: true })).mockName("rejectImageAction");
export const approveAllAction = fn(async () => ({ ok: true })).mockName("approveAllAction");
export const rejectCatImagesAction = fn(async () => ({ ok: true })).mockName(
  "rejectCatImagesAction",
);
export const hideCatAction = fn(async () => ({ ok: true })).mockName("hideCatAction");
export const banCatAction = fn(async () => ({ ok: true })).mockName("banCatAction");
export const deleteCatAction = fn(async () => ({ ok: true })).mockName("deleteCatAction");
