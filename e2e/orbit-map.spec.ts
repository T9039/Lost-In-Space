import { expect, test } from "@playwright/test";

test("Earth-orbit hall renders the MapLibre live map and record list", async ({ page }) => {
  await page.goto("/archive?zone=earth-orbit&view=map");
  await expect(page.getByRole("region", { name: "Live orbital positions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Earth orbit right now" })).toBeVisible();
  await expect(page.getByTestId("orbit-map-canvas")).toBeVisible();
  await expect(page.getByText(/NO LIVE ELEMENT SET|km ·/).first()).toBeVisible();
});
