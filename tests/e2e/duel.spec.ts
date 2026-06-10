import { expect, test } from "@playwright/test";

const HOME_URL = "/";
const PAIR_ROUTE = "**/api/pair*";
const VOTE_ROUTE = "**/api/vote";

const ONE_HOUR_MS = 60 * 60 * 1000;
const EXPIRES_AT_MS = Date.now() + ONE_HOUR_MS;

const PAIR_ONE = {
  token: "tok-1",
  expiresAt: EXPIRES_AT_MS,
  a: {
    id: "ca",
    name: "Alpha",
    slug: "alpha-1",
    images: [{ url: "https://placecats.com/300/300", width: 300, height: 300, position: 0 }],
  },
  b: {
    id: "cb",
    name: "Bravo",
    slug: "bravo-1",
    images: [{ url: "https://placecats.com/301/301", width: 301, height: 301, position: 0 }],
  },
};
const PAIR_TWO = {
  token: "tok-2",
  expiresAt: EXPIRES_AT_MS,
  a: {
    id: "cc",
    name: "Charlie",
    slug: "charlie-1",
    images: [{ url: "https://placecats.com/302/302", width: 302, height: 302, position: 0 }],
  },
  b: {
    id: "cd",
    name: "Delta",
    slug: "delta-1",
    images: [{ url: "https://placecats.com/303/303", width: 303, height: 303, position: 0 }],
  },
};
const PAIR_REFILL = {
  token: "tok-3",
  expiresAt: EXPIRES_AT_MS,
  a: {
    id: "ce",
    name: "Echo",
    slug: "echo-1",
    images: [{ url: "https://placecats.com/304/304", width: 304, height: 304, position: 0 }],
  },
  b: {
    id: "cf",
    name: "Foxtrot",
    slug: "foxtrot-1",
    images: [{ url: "https://placecats.com/305/305", width: 305, height: 305, position: 0 }],
  },
};

test.describe("Home duel", () => {
  test("loads a prefetched batch, votes, and instantly sees the next pair", async ({ page }) => {
    let pairCount = 0;
    await page.route(PAIR_ROUTE, async (route) => {
      // First request: the initial batch. Later requests: watermark top-ups.
      const pairs = pairCount === 0 ? [PAIR_ONE, PAIR_TWO] : [PAIR_REFILL];
      pairCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pairs }),
      });
    });
    await page.route(VOTE_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          winner: { id: "ca", rating: 1520, rd: 340, score: 840 },
          loser: { id: "cb", rating: 1480, rd: 340, score: 800 },
        }),
      }),
    );

    await page.goto(HOME_URL);

    await expect(page.getByRole("heading", { name: "Alpha" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bravo" })).toBeVisible();

    await page.getByRole("button", { name: /pick alpha/i }).click();

    await expect(page.getByRole("heading", { name: "Charlie" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Delta" })).toBeVisible();
  });
});
