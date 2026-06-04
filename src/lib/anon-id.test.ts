import { describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (store.has(name) ? { name, value: store.get(name) } : undefined),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
  }),
}));

// `server-only` throws if imported outside a server context (e.g. vitest's node env).
vi.mock("server-only", () => ({}));

import { getOrCreateAnonId, voterKeyFor } from "@/lib/anon-id";
import { ANON_ID_COOKIE } from "@/lib/constants";

describe("anon-id", () => {
  it("creates and persists an anonId on first read", async () => {
    store.clear();
    const first = await getOrCreateAnonId();
    expect(first).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(store.get(ANON_ID_COOKIE)).toBe(first);

    const second = await getOrCreateAnonId();
    expect(second).toBe(first);
  });

  it("derives voterKey from a user id when logged in", () => {
    expect(voterKeyFor("anon-123", null)).toBe("anon-123");
    expect(voterKeyFor("anon-123", "u1")).toBe("user:u1");
  });
});
