import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DuelArena } from "@/components/duel/duel-arena";

const PAIR_ONE = {
  token: "tok-1",
  a: {
    id: "ca",
    name: "Alpha",
    slug: "alpha-1",
    images: [{ url: "/a.webp", width: 800, height: 600, position: 0 }],
  },
  b: {
    id: "cb",
    name: "Bravo",
    slug: "bravo-1",
    images: [{ url: "/b.webp", width: 800, height: 600, position: 0 }],
  },
};
const PAIR_TWO = {
  token: "tok-2",
  a: {
    id: "cc",
    name: "Charlie",
    slug: "charlie-1",
    images: [{ url: "/c.webp", width: 800, height: 600, position: 0 }],
  },
  b: {
    id: "cd",
    name: "Delta",
    slug: "delta-1",
    images: [{ url: "/d.webp", width: 800, height: 600, position: 0 }],
  },
};

function renderArena() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DuelArena scope="global" />
    </QueryClientProvider>,
  );
}

describe("DuelArena", () => {
  beforeEach(() => {
    let pairCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/vote")) {
        return new Response(
          JSON.stringify({
            ok: true,
            winner: { id: "ca", rating: 1520, rd: 340, score: 840 },
            loser: { id: "cb", rating: 1480, rd: 340, score: 800 },
          }),
          { status: 200 },
        );
      }
      const pair = pairCalls === 0 ? PAIR_ONE : PAIR_TWO;
      pairCalls += 1;
      return new Response(JSON.stringify(pair), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a pair, votes on the winner, then shows the next pair", async () => {
    const user = userEvent.setup();
    renderArena();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pick alpha/i }));

    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());
    expect(screen.getByText("Delta")).toBeInTheDocument();
  });

  it("requests a new pair on skip without voting", async () => {
    const user = userEvent.setup();
    renderArena();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /skip this pair/i }));

    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());
  });
});
