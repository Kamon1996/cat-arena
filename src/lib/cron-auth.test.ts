import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({ state: { secret: undefined as string | undefined } }));

vi.mock("@/lib/env", () => ({
  env: {
    get CRON_SECRET() {
      return state.secret;
    },
  },
}));

import { authorizeCron } from "./cron-auth";

const SECRET = "cron_secret_at_least_16_chars_long";

function req(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("https://x/api/cron/decay", { headers });
}

beforeEach(() => {
  state.secret = undefined;
});

describe("authorizeCron", () => {
  it("returns 503 (disabled) when CRON_SECRET is unset", () => {
    expect(authorizeCron(req(`Bearer ${SECRET}`))).toEqual({ ok: false, status: 503 });
  });

  it("returns 401 when the bearer token is missing or wrong", () => {
    state.secret = SECRET;
    expect(authorizeCron(req())).toEqual({ ok: false, status: 401 });
    expect(authorizeCron(req("Bearer wrong"))).toEqual({ ok: false, status: 401 });
    expect(authorizeCron(req(SECRET))).toEqual({ ok: false, status: 401 }); // missing "Bearer "
  });

  it("authorizes a correct bearer token", () => {
    state.secret = SECRET;
    expect(authorizeCron(req(`Bearer ${SECRET}`))).toEqual({ ok: true });
  });
});
