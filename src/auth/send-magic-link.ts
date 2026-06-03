import { Resend } from "resend";

import { AUTH } from "@/lib/constants";
import { env } from "@/lib/env";
import { renderMagicLinkEmail } from "./email";

const resend = new Resend(env.RESEND_API_KEY);

interface SendVerificationRequestParams {
  identifier: string;
  url: string;
}

/** Render and send the magic-link email via Resend. Throws on Resend error so
 *  Auth.js surfaces the failure (routes the user to the error page). */
export async function sendMagicLink({
  identifier,
  url,
}: SendVerificationRequestParams): Promise<void> {
  const html = await renderMagicLinkEmail(url);

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: identifier,
    subject: AUTH.EMAIL_SUBJECT,
    html,
  });

  if (error) {
    throw new Error(`Failed to send magic-link email: ${error.message}`);
  }
}
