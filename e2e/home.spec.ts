import { expect, test } from "@playwright/test";

test("home exposes the four halls and the solar map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("LOST IN");
  await expect(page.getByText("Choose your destination.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Our Solar System/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /START EXPLORATION/i })).toBeVisible();
});
