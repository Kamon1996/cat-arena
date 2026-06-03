import { describe, expect, it } from "vitest";

import { renderMagicLinkEmail } from "./email";

const SIGN_IN_URL = "https://cat-arena.test/api/auth/callback/resend?token=abc123def456";

describe("renderMagicLinkEmail", () => {
  it("renders HTML containing the sign-in URL", async () => {
    const html = await renderMagicLinkEmail(SIGN_IN_URL);
    expect(html).toContain(SIGN_IN_URL);
    expect(html).toContain("Sign in to Cat Arena");
  });

  it("returns a non-empty HTML string", async () => {
    const html = await renderMagicLinkEmail(SIGN_IN_URL);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });
});
