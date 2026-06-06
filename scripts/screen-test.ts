import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Manually probe the auto-screen pipeline against arbitrary images. Accepts any
 * mix of local file paths and http(s) URLs, runs each through the SAME sharp
 * JPEG pipeline + resnet-50 cat-gate that production uses, and prints the top
 * labels, cat confidence, and the resulting decision (APPROVED / PENDING).
 *
 * Use it to eyeball how the model scores cats vs. dogs vs. NSFW vs. junk and to
 * tune CAT_MIN_CONFIDENCE on real data. Standalone (reads process.env):
 *   dotenv -e .env.local -- npx tsx scripts/screen-test.ts ./cat.jpg https://cataas.com/cat
 *
 * Add --raw to dump the full Workers AI label list per image.
 */

// Kept in sync with src/lib/constants.ts (CAT_MIN_CONFIDENCE). Inlined so the
// script stays standalone — no app/tsconfig-path imports.
const CAT_MIN_CONFIDENCE = 0.25;
const CLASSIFY_MODEL = "@cf/microsoft/resnet-50";
const CARD_SIZE = 800;
const JPEG_QUALITY = 85;
const TOP_N = 5;
const CAT_LABELS = ["cat", "tabby", "tiger cat", "egyptian cat", "kitten"];

type AiLabel = { label: string; score: number };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function catConfidence(labels: AiLabel[]): number {
  let best = 0;
  for (const l of labels) {
    const name = l.label.toLowerCase();
    if (CAT_LABELS.some((c) => name.includes(c)) && l.score > best) {
      best = l.score;
    }
  }
  return best;
}

async function loadBytes(source: string): Promise<Buffer> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`fetch ${source} → ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(source);
}

/** Mirror process-image.ts: bake rotation, downscale, encode JPEG for Workers AI. */
async function toScreenJpeg(original: Buffer): Promise<Buffer> {
  return sharp(original)
    .rotate()
    .resize(CARD_SIZE, CARD_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

async function classify(image: Buffer): Promise<AiLabel[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLASSIFY_MODEL}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(image),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(
      `Workers AI ${CLASSIFY_MODEL} failed: ${res.status} ${res.statusText} — ${body}`,
    );
  }
  const json = (await res.json()) as { result: AiLabel[] };
  return json.result;
}

async function screenOne(source: string, raw: boolean): Promise<void> {
  try {
    const original = await loadBytes(source);
    const jpeg = await toScreenJpeg(original);
    const labels = await classify(jpeg);
    const catConf = catConfidence(labels);
    const decision = catConf >= CAT_MIN_CONFIDENCE ? "APPROVED" : "PENDING";
    const top = labels
      .slice(0, TOP_N)
      .map((l) => `${l.label}:${pct(l.score)}`)
      .join(", ");

    console.log(`\n${source}`);
    console.log(`  cat=${pct(catConf)} (need≥${pct(CAT_MIN_CONFIDENCE)}) → ${decision}`);
    console.log(`  top${TOP_N}=[${top}]`);
    if (raw) {
      console.log(`  raw=${JSON.stringify(labels)}`);
    }
  } catch (err) {
    console.log(`\n${source}`);
    console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const raw = args.includes("--raw");
  const sources = args.filter((a) => a !== "--raw");

  if (sources.length === 0) {
    console.error("Usage: tsx scripts/screen-test.ts [--raw] <file-or-url> [<file-or-url> ...]");
    console.error(
      "Example: dotenv -e .env.local -- npx tsx scripts/screen-test.ts ./my-cat.jpg https://cataas.com/cat",
    );
    process.exit(1);
  }

  for (const source of sources) {
    await screenOne(source, raw);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
