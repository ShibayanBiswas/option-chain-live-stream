import { expect, test } from "@playwright/test";

test("desk frame stays stable in light and dark", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop" && testInfo.project.name !== "phone", "breakpoints covered by the pair");
  await page.goto("/");
  await expect(page.locator(".chain-row").first()).toBeVisible({ timeout: 70_000 });
  const mask = [
    page.locator(".chain-scroll"),
    page.locator(".kpi strong"),
    page.locator(".spot-inline"),
    page.locator(".feed-chip"),
    page.locator(".session-pill"),
  ];
  await expect(page).toHaveScreenshot(`desk-${testInfo.project.name}-light.png`, {
    mask,
    maxDiffPixelRatio: 0.04,
  });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page).toHaveScreenshot(`desk-${testInfo.project.name}-dark.png`, {
    mask,
    maxDiffPixelRatio: 0.04,
  });
});
