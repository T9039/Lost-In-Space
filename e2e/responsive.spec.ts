import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
] as const;

const pages = [
  ["home", "/"],
  ["archive", "/archive"],
  ["orbit map", "/archive?zone=earth-orbit&view=map"],
  ["item", "/item/opportunity"],
  ["compare", "/compare?a=opportunity&b=insight&deep=1"],
  ["sources", "/sources"],
] as const;

for (const viewport of viewports) {
  for (const [name, path] of pages) {
    test(`${name} fits ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}
