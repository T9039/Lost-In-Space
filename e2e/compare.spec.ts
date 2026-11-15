import { expect, test } from "@playwright/test";

test("comparison renders a deterministic diff", async ({ page }) => {
  await page.goto("/compare?a=opportunity&b=insight&deep=1");
  await expect(page.getByText(/shared attributes/)).toBeVisible();
  await expect(page.getByText(/differences/)).toBeVisible();
  await expect(page.getByText("Attribute diff")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});
