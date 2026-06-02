import { createHmac, timingSafeEqual } from "node:crypto";

const MS_PER_SECOND = 1000;
const TOKEN_PART_COUNT = 2;
const HMAC_ALGORITHM = "sha256";

export type PairTokenPayload = {
  a: string;
  b: string;
  nonce: string;
  exp: number;
  scope: string;
};

export { signPairToken, verifyPairToken };

function secret(): string {
  const value = process.env.PAIR_TOKEN_SECRET;
  if (!value) {
    throw new Error("PAIR_TOKEN_SECRET is not set");
  }
  return value;
}

function sign(body: string): string {
  return createHmac(HMAC_ALGORITHM, secret()).update(body).digest("base64url");
}

function signPairToken(payload: PairTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function verifyPairToken(token: string): PairTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== TOKEN_PART_COUNT) {
    return null;
  }
  const [body, signature] = parts;
  if (!body || !signature) {
    return null;
  }
  if (!safeEqual(signature, sign(body))) {
    return null;
  }

  let payload: PairTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PairTokenPayload;
  } catch {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / MS_PER_SECOND);
  if (typeof payload.exp !== "number" || payload.exp < nowSeconds) {
    return null;
  }

  return payload;
}
