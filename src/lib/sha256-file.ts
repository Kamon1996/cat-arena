const HEX_RADIX = 16;
const HEX_PAD = 2;

/** SHA-256 of a file's bytes as lowercase hex, via WebCrypto (browser-safe). */
export async function sha256HexOfFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_PAD, "0"))
    .join("");
}
