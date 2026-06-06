import type { Buffer } from "node:buffer";
import type { ImageStatus } from "@prisma/client";

import { CAT_MIN_CONFIDENCE } from "@/lib/constants";
import { env } from "@/lib/env";

// Cloudflare retired @cf/falcons-ai/nsfw_image_detection (the run path now 404s
// with code 7000), so auto-screening is a cat-gate only: resnet-50 reliably
// separates cats from non-cats (a dog classifies as a breed, not a cat, so it
// fails the gate → PENDING). NSFW is caught by the same gate (explicit content
// is not a cat → PENDING) plus user reports + manual review.
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

function decide(catConf: number): ImageStatus {
  if (catConf >= CAT_MIN_CONFIDENCE) return "APPROVED";
  return "PENDING";
}

function fmt(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function logScreenResult(catConf: number, labels: AiLabel[], status: ImageStatus): void {
  const top = labels
    .slice(0, 3)
    .map((l) => `${l.label}:${fmt(l.score)}`)
    .join(", ");

  console.log(
    [
      "[screen-image]",
      `cat=${fmt(catConf)} (need≥${fmt(CAT_MIN_CONFIDENCE)} → APPROVED, else PENDING)`,
      `top3=[${top}]`,
      `decision=${status}`,
    ].join(" | "),
  );
}

export type ScreenResult = {
  status: ImageStatus;
  /** P(is-a-cat) from resnet-50, 0–1. 0 when Workers AI is unavailable. */
  catConfidence: number;
};

/**
 * Auto-screen one image with Cloudflare Workers AI (resnet-50 cat-gate).
 * There is no local model fallback: if Workers AI is unavailable we fail safe to
 * PENDING so the image lands in the manual moderation queue (never auto-approved
 * without a real signal).
 */
export async function screenImage(image: Buffer): Promise<ScreenResult> {
  try {
    const labels = await runModel(CLASSIFY_MODEL, image);
    const catConf = catConfidence(labels);
    const status = decide(catConf);
    logScreenResult(catConf, labels, status);
    return { status, catConfidence: catConf };
  } catch (err) {
    console.error("[screen-image] Workers AI failed, falling back to PENDING:", err);
    return { status: "PENDING", catConfidence: 0 };
  }
}
