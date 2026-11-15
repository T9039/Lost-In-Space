import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  ["home", "/"],
  ["archive", "/archive"],
  ["sources", "/sources"],
  ["compare", "/compare?a=opportunity&b=insight&deep=1"],
  ["item", "/item/opportunity"],
] as const;

for (const [name, path] of pages) {
  test(`${name} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const scan = await new AxeBuilder({ page }).analyze();
    const serious = scan.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
    expect(
      serious.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target),
      }))
    ).toEqual([]);
  });
}
