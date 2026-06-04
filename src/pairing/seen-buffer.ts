import { z } from "zod";

import { SEEN_BUFFER_SIZE } from "@/lib/constants";

const seenSchema = z.array(z.string()).max(SEEN_BUFFER_SIZE);

/** Serialize the ring buffer to a compact cookie value. */
export function encodeSeen(ids: string[]): string {
  return JSON.stringify(ids.slice(0, SEEN_BUFFER_SIZE));
}

/** Parse a cookie value into a validated id list (empty on malformed). */
export function decodeSeen(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = seenSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Prepend new ids (newest first), de-dupe, cap at SEEN_BUFFER_SIZE. */
export function appendSeen(current: string[], add: string[]): string[] {
  const merged = [...add, ...current.filter((id) => !add.includes(id))];
  return merged.slice(0, SEEN_BUFFER_SIZE);
}
