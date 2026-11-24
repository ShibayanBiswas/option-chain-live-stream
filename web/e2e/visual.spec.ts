import { expect, test, type Page } from "@playwright/test";

import { chain, oi, quotes, universe } from "./fixtures";

async function freeze(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  await page.addInitScript((next) => {
    localStorage.setItem("option-chain-live-theme", next);
  }, theme);
  await page.route("**/api/universe", (route) => route.fulfill({ json: universe }));
  await page.route("**/api/chain**", (route) => route.fulfill({ json: chain }));
  await page.route("**/api/oi**", (route) => route.fulfill({ json: oi }));
  await page.route("**/api/quotes", (route) => route.fulfill({ json: quotes }));
  await page.route("**/api/stream**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: `event: chain\ndata: ${JSON.stringify(chain)}\n\n`,
    }),
  );
  await page.goto("/");
  await expect(page.locator(".chain-row").first()).toBeVisible();
  await expect(page.locator(".feed-chip")).toContainText(/Rest|Live/);
}

for (const theme of ["light", "dark"] as const) {
  test(`visual ${theme}`, async ({ page }) => {
    await freeze(page, theme);
    await expect(page).toHaveScreenshot(`desk-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
  });
}
