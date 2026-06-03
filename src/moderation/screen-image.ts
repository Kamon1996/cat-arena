import type { Buffer } from "node:buffer";
import type { ImageStatus } from "@prisma/client";

import { CAT_MIN_CONFIDENCE, NSFW_PENDING_THRESHOLD, NSFW_REJECT_THRESHOLD } from "@/lib/constants";
import { env } from "@/lib/env";
import { nsfwFallbackScore } from "@/moderation/nsfw-fallback";

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
    throw new Error(`Workers AI ${model} failed: ${res.status}`);
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

/**
 * Auto-screen one image. Tries Cloudflare Workers AI (NSFW + classification);
 * on any failure falls back to local NSFWJS for the NSFW signal and treats
 * cat-confidence as unknown (never auto-approves on the fallback path).
 */
export async function screenImage(image: Buffer): Promise<ImageStatus> {
  try {
    const [nsfwLabels, classifyLabels] = await Promise.all([
      runModel(NSFW_MODEL, image),
      runModel(CLASSIFY_MODEL, image),
    ]);
    return decide(nsfwScore(nsfwLabels), catConfidence(classifyLabels));
  } catch {
    const nsfw = await nsfwFallbackScore(image);
    return decide(nsfw, null);
  }
}
