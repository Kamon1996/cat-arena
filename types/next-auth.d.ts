import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "MODERATOR" | "ADMIN";
      banned: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: "USER" | "MODERATOR" | "ADMIN";
    banned: boolean;
  }
}
