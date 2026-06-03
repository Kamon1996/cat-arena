import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => auth(...a) }));
const createOrg = vi.fn();
vi.mock("@/org/create-org", () => ({
  createOrg: (...a: unknown[]) => createOrg(...a),
}));

import { POST } from "@/app/api/orgs/route";

const post = (body: unknown) =>
  POST(
    new Request("http://t/api/orgs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

const SESSION = { user: { id: "user-1" } };
const VALID = { name: "Acme" };

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue(SESSION);
  createOrg.mockResolvedValue({
    ok: true,
    id: "org-1",
    slug: "acme-org01",
    joinCode: "join-code-fixed-000000000",
  });
});

describe("POST /api/orgs", () => {
  it("returns 401 when not authenticated", async () => {
    auth.mockResolvedValue(null);
    const res = await post(VALID);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await post({ name: "" });
    expect(res.status).toBe(400);
  });

  it("creates the org and returns 201 with id, slug, joinCode", async () => {
    const res = await post(VALID);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: "org-1",
      slug: "acme-org01",
      joinCode: "join-code-fixed-000000000",
    });
    expect(createOrg).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Acme",
      description: undefined,
      logoR2Key: undefined,
    });
  });

  it("returns 409 when the user already owns an org", async () => {
    createOrg.mockResolvedValue({ ok: false, reason: "already_owns_org" });
    const res = await post(VALID);
    expect(res.status).toBe(409);
  });

  it("returns 409 when the name is taken", async () => {
    createOrg.mockResolvedValue({ ok: false, reason: "name_taken" });
    const res = await post(VALID);
    expect(res.status).toBe(409);
  });
});
