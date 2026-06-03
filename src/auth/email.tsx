import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

import { AUTH } from "@/lib/constants";

interface MagicLinkEmailProps {
  url: string;
}

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{AUTH.EMAIL_SUBJECT}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "24px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px" }}>{AUTH.EMAIL_SUBJECT}</Heading>
          <Text style={{ fontSize: "14px", color: "#333333" }}>
            Click the button below to sign in. This link expires shortly and can be used once.
          </Text>
          <Button
            href={url}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Sign in
          </Button>
          <Text style={{ fontSize: "12px", color: "#6b7280" }}>
            Or paste this link into your browser: {url}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

MagicLinkEmail.PreviewProps = {
  url: "https://cat-arena.test/api/auth/callback/resend?token=preview",
} satisfies MagicLinkEmailProps;

export async function renderMagicLinkEmail(url: string): Promise<string> {
  return render(<MagicLinkEmail url={url} />);
}
