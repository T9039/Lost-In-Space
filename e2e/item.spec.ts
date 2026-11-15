import { expect, test } from "@playwright/test";

test("item profile shows facts, abandonment, position and provenance", async ({ page }) => {
  await page.goto("/item/opportunity");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Opportunity");
  await expect(page.getByRole("region", { name: "Why it was left" })).toBeVisible();
  await expect(page.getByText("LAST KNOWN POSITION", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lineage" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Provenance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /archive assistant/i })).toBeVisible();
});

test("Earth-orbit items show live tracking or an explicit pending state", async ({ page }) => {
  await page.goto("/item/vanguard-1");
  await expect(page.getByText(/LIVE ELEMENT SET|LIVE ELEMENTS PENDING/)).toBeVisible();
});
