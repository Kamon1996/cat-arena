import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { AUTH } from "@/lib/constants";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { isEmailBanned } from "./is-email-banned";

// Sign-in is Google OAuth. Magic-link (Resend) is STASHED until a verified email
// domain is set up — to re-enable, restore the two imports below, the provider entry,
// and the email form in src/app/signin/page.tsx (the template lives in
// src/auth/{send-magic-link,email}.tsx and is kept intact).
//   import Resend from "next-auth/providers/resend";
//   import { sendMagicLink } from "./send-magic-link";

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
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      // Google verifies emails, so linking to an existing same-email account is safe —
      // lets a prior magic-link account sign in via Google without OAuthAccountNotLinked.
      allowDangerousEmailAccountLinking: true,
    }),
    // STASHED — magic-link via Resend (re-enable when an email domain is verified):
    // Resend({
    //   id: AUTH.PROVIDER_ID,
    //   apiKey: env.RESEND_API_KEY,
    //   from: env.EMAIL_FROM,
    //   maxAge: AUTH.MAGIC_LINK_MAX_AGE_SECONDS,
    //   sendVerificationRequest({ identifier, url }) {
    //     return sendMagicLink({ identifier, url });
    //   },
    // }),
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
