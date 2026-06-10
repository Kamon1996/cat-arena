import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DuelArena } from "@/components/duel/duel-arena";

const ONE_HOUR_MS = 60 * 60 * 1000;
const EXPIRES_AT_MS = Date.now() + ONE_HOUR_MS;

const PAIR_ONE = {
  token: "tok-1",
  expiresAt: EXPIRES_AT_MS,
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
  expiresAt: EXPIRES_AT_MS,
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
const PAIR_REFILL = {
  token: "tok-3",
  expiresAt: EXPIRES_AT_MS,
  a: {
    id: "ce",
    name: "Echo",
    slug: "echo-1",
    images: [{ url: "/e.webp", width: 800, height: 600, position: 0 }],
  },
  b: {
    id: "cf",
    name: "Foxtrot",
    slug: "foxtrot-1",
    images: [{ url: "/f.webp", width: 800, height: 600, position: 0 }],
  },
};

const CELEBRATION_WAIT_MS = 1400; // longer than the 1150ms celebration window

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

function stubFetch(options: { voteStatus?: number; firstBatch?: unknown[] }) {
  const { voteStatus = 200, firstBatch = [PAIR_ONE, PAIR_TWO] } = options;
  let pairCalls = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/vote")) {
      const body =
        voteStatus === 200
          ? {
              ok: true,
              winner: { id: "ca", rating: 1520, rd: 340, score: 840 },
              loser: { id: "cb", rating: 1480, rd: 340, score: 800 },
            }
          : { error: "Internal error" };
      return new Response(JSON.stringify(body), { status: voteStatus });
    }
    // First request: the initial prefetched batch. Later requests: top-ups.
    const pairs = pairCalls === 0 ? firstBatch : [PAIR_REFILL];
    pairCalls += 1;
    return new Response(JSON.stringify({ pairs }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function voteCallsOf(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/vote"));
}

describe("DuelArena", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a batch, votes on the winner, then shows the next queued pair", async () => {
    stubFetch({});
    const user = userEvent.setup();
    renderArena();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pick alpha/i }));

    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument(), {
      timeout: 2500,
    });
    expect(screen.getByText("Delta")).toBeInTheDocument();
  });

  it("shows the next queued pair instantly on skip, without voting", async () => {
    const fetchMock = stubFetch({});
    const user = userEvent.setup();
    renderArena();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /skip/i }));

    // The next pair comes straight from the prefetched queue (the wait below is
    // only the card exit animation, not a network round-trip).
    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());
    expect(screen.getByText("Delta")).toBeInTheDocument();
    expect(voteCallsOf(fetchMock)).toHaveLength(0);
  });

  it("keeps the same pair on screen when the vote fails, so retry is possible", async () => {
    stubFetch({ voteStatus: 500 });
    const user = userEvent.setup();
    renderArena();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /pick alpha/i }));

    // The failed vote must cancel the scheduled advance — wait past the
    // celebration window and confirm the pair did NOT change.
    await new Promise((resolve) => setTimeout(resolve, CELEBRATION_WAIT_MS));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("swaps in a fresh pair without submitting when the current pair has expired", async () => {
    const expiredPair = { ...PAIR_ONE, expiresAt: Date.now() - 1 };
    const fetchMock = stubFetch({ firstBatch: [expiredPair, PAIR_TWO] });
    const user = userEvent.setup();
    renderArena();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /pick alpha/i }));

    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());
    expect(voteCallsOf(fetchMock)).toHaveLength(0);
  });
});
