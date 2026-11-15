import { expect, test } from "@playwright/test";

test("sources page lists credited NASA sources", async ({ page }) => {
  await page.goto("/sources");
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByText("Provenance")).toBeVisible();
  await expect(page.locator(".card-title").first()).toBeVisible();
  await expect(page.getByText(/NASA/).first()).toBeVisible();
});
