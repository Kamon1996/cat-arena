import type { Buffer } from "node:buffer";
import type { ImageStatus } from "@prisma/client";

import { CAT_MIN_CONFIDENCE, NSFW_PENDING_THRESHOLD, NSFW_REJECT_THRESHOLD } from "@/lib/constants";
import { env } from "@/lib/env";

const NSFW_MODEL = "@cf/falcons-ai/nsfw_image_detection";
const CLASSIFY_MODEL = "@cf/microsoft/resnet-50";

type AiLabel = { label: string; score: number };

function runUrl(model: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
}

async function runModel(model: string, image: Buffer): Promise<AiLabel[]> {
  const res = await fetch(runUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(image),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Workers AI ${model} failed: ${res.status} ${res.statusText} — ${body}`);
  }
  const json = (await res.json()) as { result: AiLabel[] };
  return json.result;
}

function nsfwScore(labels: AiLabel[]): number {
  const nsfw = labels.find((l) => l.label.toLowerCase() === "nsfw");
  return nsfw?.score ?? 0;
}

const CAT_LABELS = ["cat", "tabby", "tiger cat", "egyptian cat", "kitten"];

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

function decide(nsfw: number, catConf: number | null): ImageStatus {
  if (nsfw >= NSFW_REJECT_THRESHOLD) return "REJECTED";
  if (nsfw >= NSFW_PENDING_THRESHOLD) return "PENDING";
  if (catConf !== null && catConf >= CAT_MIN_CONFIDENCE) return "APPROVED";
  return "PENDING";
}

function fmt(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function logScreenResult(nsfw: number, catConf: number, status: ImageStatus): void {
  const nsfwBar =
    nsfw >= NSFW_REJECT_THRESHOLD ? "REJECT" : nsfw >= NSFW_PENDING_THRESHOLD ? "PENDING" : "ok";
  const catBar = catConf >= CAT_MIN_CONFIDENCE ? "APPROVED" : "low";

  console.log(
    [
      "[screen-image]",
      `nsfw=${fmt(nsfw)} (ok<${fmt(NSFW_PENDING_THRESHOLD)} pending<${fmt(NSFW_REJECT_THRESHOLD)} reject) → ${nsfwBar}`,
      `cat=${fmt(catConf)} (need≥${fmt(CAT_MIN_CONFIDENCE)}) → ${catBar}`,
      `decision=${status}`,
    ].join(" | "),
  );
}

/**
 * Auto-screen one image with Cloudflare Workers AI (NSFW + classification).
 * There is no local model fallback: if Workers AI is unavailable we fail safe to
 * PENDING so the image lands in the manual moderation queue (never auto-approved
 * or auto-rejected without a real signal).
 */
export async function screenImage(image: Buffer): Promise<ImageStatus> {
  try {
    const [nsfwLabels, classifyLabels] = await Promise.all([
      runModel(NSFW_MODEL, image),
      runModel(CLASSIFY_MODEL, image),
    ]);
    const nsfw = nsfwScore(nsfwLabels);
    const catConf = catConfidence(classifyLabels);
    const status = decide(nsfw, catConf);
    logScreenResult(nsfw, catConf, status);
    return status;
  } catch (err) {
    console.error("[screen-image] Workers AI failed, falling back to PENDING:", err);
    return "PENDING";
  }
}
