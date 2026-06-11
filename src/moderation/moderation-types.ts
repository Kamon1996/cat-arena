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
  /** Cropped 200px tile — fast grid triage of the duel framing. */
  thumbUrl: string;
  /** UNCROPPED 1600px variant — the full photo the public sees; what the
   *  moderator must judge, shown by the click-to-fullscreen lightbox. */
  fullUrl: string;
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
