import { prisma } from "@/lib/prisma";

/** True when the email is on the persistent ban blacklist. Empty → false. */
export async function isEmailBanned(email: string | null | undefined): Promise<boolean> {
  if (!email) {
    return false;
  }
  const row = await prisma.bannedEmail.findUnique({ where: { email } });
  return row !== null;
}
