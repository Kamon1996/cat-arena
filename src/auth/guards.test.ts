import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockRedirect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  // redirect() terminates control flow in Next.js by throwing; model that here.
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("./config", () => ({ auth: mockAuth }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { requireAdmin, requireModerator, requireUser } from "./guards";

const sessionFor = (role: "USER" | "MODERATOR" | "ADMIN") =>
  ({ user: { id: "u1", role } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("redirects to /signin when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow();
    expect(mockRedirect).toHaveBeenCalledWith("/signin");
  });

  it("returns the session when signed in", async () => {
    mockAuth.mockResolvedValue(sessionFor("USER"));
    const session = await requireUser();
    expect(session.user.id).toBe("u1");
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("requireModerator", () => {
  it("redirects a plain USER home", async () => {
    mockAuth.mockResolvedValue(sessionFor("USER"));
    await expect(requireModerator()).rejects.toThrow();
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("allows a MODERATOR", async () => {
    mockAuth.mockResolvedValue(sessionFor("MODERATOR"));
    await requireModerator();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows an ADMIN", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    await requireModerator();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  it("redirects a MODERATOR home", async () => {
    mockAuth.mockResolvedValue(sessionFor("MODERATOR"));
    await expect(requireAdmin()).rejects.toThrow();
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("allows an ADMIN", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    await requireAdmin();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
