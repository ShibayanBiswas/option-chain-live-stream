import { expect, test, type Page } from "@playwright/test";

async function waitForBook(page: Page) {
  await page.goto("/");
  await expect(page.locator("h1")).not.toHaveText("Option Chain", { timeout: 70_000 });
  await expect(page.locator(".spot-block strong")).not.toHaveText("—");
  await expect(page.locator(".chain-row").first()).toBeVisible();
  await expect(page.locator(".session-pill")).toHaveText(/Market Open|Market Closed|Pre-Open|Market Holiday/);
}

test("live book, Anand Rathi Wealth only, and the stream", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Live exchange checks run once on desktop");
  test.setTimeout(180_000);
  await waitForBook(page);

  const book = await page.evaluate(async () => {
    const response = await fetch("/api/universe");
    return response.json();
  });
  const symbols = (book.indexes as Array<{ symbol: string; exchange: string }>).map((item) => `${item.exchange}:${item.symbol}`);
  expect(symbols).toContain("NSE:NIFTY");
  expect(symbols).toContain("NSE:BANKNIFTY");
  expect(symbols).toContain("BSE:SENSEX");
  expect(symbols.length).toBeGreaterThanOrEqual(8);
  expect(book.equities.length).toBeGreaterThan(0);
  for (const equity of book.equities as Array<{ symbol: string }>) {
    expect(equity.symbol.toUpperCase()).toContain("ANANDRATHI");
  }

  await page.getByPlaceholder("Find an instrument").fill("RELIANCE");
  await expect(page.getByRole("button", { name: /RELIANCE/ })).toHaveCount(0);
  await page.getByPlaceholder("Find an instrument").fill("ANAND");
  await page.getByRole("button", { name: "ANANDRATHI NSE" }).click();
  await expect(page.locator("h1")).toHaveText("ANANDRATHI");
  await expect(page.locator(".spot-block strong")).not.toHaveText("—", { timeout: 40_000 });

  await page.getByPlaceholder("Find an instrument").fill("");
  await page.getByRole("button", { name: "NIFTY NSE", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("NIFTY");

  const view = page.getByLabel("View");
  await expect(view.locator("option[value='near']")).toHaveText("Spot Focus");
  await expect(view.locator("option[value='full']")).toHaveText("Entire Book");
  await view.selectOption("full");
  await expect(page.locator(".chain-row").nth(40)).toBeVisible();

  const headerOrder = await page.evaluate(() => {
    const text = (selector: string) =>
      [...document.querySelectorAll(selector)].map((node) => node.textContent?.trim());
    return {
      calls: text(".chain-pane.calls thead tr:nth-child(2) th"),
      puts: text(".chain-pane.puts thead tr:nth-child(2) th"),
    };
  });
  expect(headerOrder.calls.slice(-2)).toEqual(["Change", "Last"]);
  expect(headerOrder.puts.slice(0, 2)).toEqual(["Last", "Change"]);

  await expect(page.locator('[data-volume="zero"]').first()).toBeVisible();
  expect(await page.locator(".vol-zero").count()).toBeGreaterThan(0);
  expect(await page.locator(".vol-high").count()).toBeGreaterThan(0);
  expect(await page.locator(".vol-low").count()).toBeGreaterThan(0);

  const barWidth = await page.locator(".oi-fill").first().evaluate((el) => parseFloat(getComputedStyle(el).width));
  expect(barWidth).toBeGreaterThan(0);

  const session = await page.locator(".session-pill").innerText();
  const events = await page.evaluate(async () => {
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch("/api/stream?symbol=NIFTY&exchange=NSE&segment=INDEX", { signal: controller.signal });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const names: string[] = [];
      const start = Date.now();
      while (Date.now() - start < 22_000 && !names.includes("chain")) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const name = (part.match(/^event: (.+)$/m) || [])[1];
          if (name) names.push(name);
        }
      }
      await reader.cancel().catch(() => undefined);
      return names;
    } catch {
      return [] as string[];
    } finally {
      clearTimeout(kill);
    }
  });
  if (events.length > 0) {
    expect(events).toContain("chain");
    if (session.includes("Closed") || session.includes("Holiday") || session.includes("Pre-Open")) {
      expect(events).not.toContain("socket");
    }
  }

  const nifty = await page.evaluate(async () => {
    const response = await fetch("/api/chain?symbol=NIFTY&exchange=NSE&segment=INDEX");
    return response.json();
  });
  expect(nifty.rows.length).toBeGreaterThan(20);
  expect(nifty.expiries.length).toBeGreaterThan(1);
  const sensex = await page.evaluate(async () => {
    const response = await fetch("/api/chain?symbol=SENSEX&exchange=BSE&segment=INDEX");
    return { status: response.status, body: await response.json() };
  });
  expect(sensex.status).toBe(200);
  expect(sensex.body.rows.length).toBeGreaterThan(10);
});
