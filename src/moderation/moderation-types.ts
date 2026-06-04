/** Canonical rejection reasons — shared by the moderation UI + the reject action. */
export const REJECTION_REASONS = [
  "Not a cat",
  "Blurry / low-res",
  "Inappropriate",
  "Watermark / text",
  "Duplicate",
  "Not the owner's cat",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export type ModerationImage = {
  id: string;
  thumbUrl: string;
  width?: number;
  height?: number;
};

export type ModerationCat = {
  id: string;
  name: string;
  status: string;
  /** ISO timestamp the cat was submitted (for the "x ago" meta line). */
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    role: "USER" | "MODERATOR" | "ADMIN";
    banned: boolean;
  };
  images: ModerationImage[];
};

export type ModerationPage = {
  cats: ModerationCat[];
  nextCursor: string | null;
};
