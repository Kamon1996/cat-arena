import { expect, test } from "@playwright/test";

const HOME_URL = "/";
const PAIR_ROUTE = "**/api/pair*";
const VOTE_ROUTE = "**/api/vote";

const PAIR_ONE = {
  token: "tok-1",
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

test.describe("Home duel", () => {
  test("loads a pair, votes, and sees a new pair", async ({ page }) => {
    let pairCount = 0;
    await page.route(PAIR_ROUTE, async (route) => {
      const body = pairCount === 0 ? PAIR_ONE : PAIR_TWO;
      pairCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
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
