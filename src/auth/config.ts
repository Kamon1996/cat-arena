import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { AUTH } from "@/lib/constants";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { isEmailBanned } from "./is-email-banned";
import { sendMagicLink } from "./send-magic-link";

// Guards-based protection: route gating lives in server guards (src/auth/guards.ts),
// not Edge middleware — database sessions can't be resolved on the Edge runtime.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  secret: env.AUTH_SECRET,
  pages: {
    signIn: AUTH.SIGN_IN_PATH,
    verifyRequest: AUTH.VERIFY_REQUEST_PATH,
  },
  providers: [
    Resend({
      id: AUTH.PROVIDER_ID,
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      maxAge: AUTH.MAGIC_LINK_MAX_AGE_SECONDS,
      sendVerificationRequest({ identifier, url }) {
        return sendMagicLink({ identifier, url });
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Block sign-in (and fresh sign-ups) for blacklisted emails.
      return !(await isEmailBanned(user.email));
    },
    // Database session strategy: `user` is the full Prisma User row.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.banned = user.banned;
      return session;
    },
  },
});
