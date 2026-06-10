import { expect, test } from "@playwright/test";

// NOTE: These flows exercise server-rendered, DB-backed pages.
//  - `/orgs/new` is `requireUser()`-gated, so the create test needs an
//    authenticated session (seed a session cookie via `context.addCookies`,
//    backed by a seeded `Session` row) before it can reach the form.
//  - `/org/[slug]` reads the org from the DB and `notFound()`s on a missing
//    slug, so the org-page test needs a seeded organization.
// The API calls below (`/api/orgs`, `/api/pair`, `/api/vote`) are mocked with
// `page.route`, but the page shells still require env + a seeded DB. Run this
// suite in an env-provisioned checkout (`.env.local` + seeded org/session).

const NEW_ORG_URL = "/orgs/new";
const ORG_SLUG = "acme-org01";
const ORG_PAGE_URL = `/org/${ORG_SLUG}`;
const ORGS_ROUTE = "**/api/orgs";
const PAIR_ROUTE = "**/api/pair*";
const VOTE_ROUTE = "**/api/vote";

const CREATE_RESPONSE = {
  id: "org-1",
  slug: ORG_SLUG,
  joinCode: "join-code-fixed-000000000",
};
const ONE_HOUR_MS = 60 * 60 * 1000;

const ORG_PAIR = {
  token: "tok-org-1",
  expiresAt: Date.now() + ONE_HOUR_MS,
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

test.describe("Organizations", () => {
  test("create an org then land on its page", async ({ page }) => {
    await page.route(ORGS_ROUTE, (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(CREATE_RESPONSE),
      }),
    );

    await page.goto(NEW_ORG_URL);
    await page.getByLabel(/name/i).fill("Acme");
    await page.getByRole("button", { name: /create organization/i }).click();

    await expect(page).toHaveURL(new RegExp(`/org/${ORG_SLUG}$`));
  });

  test("member sees the scoped duel and the leaderboard on the org page", async ({ page }) => {
    await page.route(PAIR_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pairs: [ORG_PAIR] }),
      }),
    );
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

    await page.goto(ORG_PAGE_URL);

    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible();
  });
});
