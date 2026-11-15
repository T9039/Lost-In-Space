import { expect, test } from "@playwright/test";

test("archive lists the curated set and filters by zone", async ({ page }) => {
  await page.goto("/archive");
  await expect(page.getByRole("heading", { name: /ZONE EXPLORER/i })).toBeVisible();
  await expect(page.getByText(/DATABASE|OFFLINE FIXTURES/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Opportunity", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Mars/i }).click();
  await expect(page).toHaveURL(/zone=mars/);
  await expect(page.getByRole("link", { name: "Opportunity", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voyager 1", exact: true })).toHaveCount(0);
});

test("archive search is server-backed", async ({ page }) => {
  await page.goto("/archive");
  const search = page.getByPlaceholder(/Search machines/i);
  await search.fill("opportunity");
  await expect(page).toHaveURL(/q=opportunity/, { timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Opportunity", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "InSight", exact: true })).toHaveCount(0);
});
