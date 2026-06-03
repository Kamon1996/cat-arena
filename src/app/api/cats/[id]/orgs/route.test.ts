import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => auth(...a) }));
const findCat = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { findUnique: (...a: unknown[]) => findCat(...a) } },
}));
const joinByCode = vi.fn();
vi.mock("@/org/join-by-code", () => ({
  joinByCode: (...a: unknown[]) => joinByCode(...a),
}));
const leaveOrg = vi.fn();
vi.mock("@/org/leave-org", () => ({
  leaveOrg: (...a: unknown[]) => leaveOrg(...a),
}));

import { DELETE, POST } from "@/app/api/cats/[id]/orgs/route";

const CAT_ID = "cat-1";
const OWNER = { user: { id: "user-1" } };
const ctx = { params: Promise.resolve({ id: CAT_ID }) };

const post = (body: unknown) =>
  POST(
    new Request(`http://t/api/cats/${CAT_ID}/orgs`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    ctx,
  );
const del = (body: unknown) =>
  DELETE(
    new Request(`http://t/api/cats/${CAT_ID}/orgs`, {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
    ctx,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue(OWNER);
  findCat.mockResolvedValue({ id: CAT_ID, ownerId: "user-1" });
});

describe("POST /api/cats/[id]/orgs (join)", () => {
  it("returns 401 when not authenticated", async () => {
    auth.mockResolvedValue(null);
    expect((await post({ joinCode: "c" })).status).toBe(401);
  });

  it("returns 404 when the cat does not exist", async () => {
    findCat.mockResolvedValue(null);
    expect((await post({ joinCode: "c" })).status).toBe(404);
  });

  it("returns 403 when the caller does not own the cat", async () => {
    findCat.mockResolvedValue({ id: CAT_ID, ownerId: "someone-else" });
    expect((await post({ joinCode: "c" })).status).toBe(403);
  });

  it("returns 422 for an invalid join code", async () => {
    joinByCode.mockResolvedValue({ ok: false, reason: "invalid_code" });
    expect((await post({ joinCode: "nope" })).status).toBe(422);
  });

  it("returns 409 when the cat is at the org cap or already a member", async () => {
    joinByCode.mockResolvedValue({ ok: false, reason: "cap_reached" });
    expect((await post({ joinCode: "c" })).status).toBe(409);
  });

  it("returns 200 with orgId + orgSlug on success", async () => {
    joinByCode.mockResolvedValue({ ok: true, orgId: "org-1", orgSlug: "acme-org01" });
    const res = await post({ joinCode: "good" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      orgId: "org-1",
      orgSlug: "acme-org01",
    });
  });
});

describe("DELETE /api/cats/[id]/orgs (leave)", () => {
  it("returns 403 when the caller does not own the cat", async () => {
    findCat.mockResolvedValue({ id: CAT_ID, ownerId: "someone-else" });
    expect((await del({ orgId: "org-1" })).status).toBe(403);
  });

  it("returns 404 when the membership is not found", async () => {
    leaveOrg.mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await del({ orgId: "org-1" })).status).toBe(404);
  });

  it("returns 200 on a successful leave", async () => {
    leaveOrg.mockResolvedValue({ ok: true });
    const res = await del({ orgId: "org-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
