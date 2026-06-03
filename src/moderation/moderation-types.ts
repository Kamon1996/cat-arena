export type ModerationImage = {
  id: string;
  thumbUrl: string;
};

export type ModerationCat = {
  id: string;
  name: string;
  status: string;
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
