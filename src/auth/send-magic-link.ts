import { Resend } from "resend";

import { AUTH } from "@/lib/constants";
import { env } from "@/lib/env";
import { renderMagicLinkEmail } from "./email";

let resend: Resend | null = null;

// Lazy so importing this module is side-effect free (no env read at import) —
// `next build` can trace routes without RESEND_API_KEY present.
function getResend(): Resend {
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

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
  // EMAIL_FROM is optional in env while magic-link is stashed; required to actually send.
  const from = env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is required to send the magic-link email");
  }

  const html = await renderMagicLinkEmail(url);

  const { error } = await getResend().emails.send({
    from,
    to: identifier,
    subject: AUTH.EMAIL_SUBJECT,
    html,
  });

  if (error) {
    throw new Error(`Failed to send magic-link email: ${error.message}`);
  }
}
