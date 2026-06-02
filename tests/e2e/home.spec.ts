import { expect, test } from "@playwright/test";

const HOME_URL = "/";
const EXPECTED_HEADING = /cat arena/i;

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME_URL);
  });

  test("renders the main heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: EXPECTED_HEADING })).toBeVisible();
  });

  test("responds with HTTP 200", async ({ page }) => {
    const response = await page.goto(HOME_URL);
    expect(response?.status()).toBe(200);
  });
});
