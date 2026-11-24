import { expect, test, type Page } from "@playwright/test";

async function waitForBook(page: Page) {
  await page.goto("/");
  await expect(page.locator("h1")).not.toHaveText("Option Chain", { timeout: 70_000 });
  await expect(page.locator(".spot-block strong")).not.toHaveText("—");
  await expect(page.locator(".chain-row").first()).toBeVisible();
  await expect(page.locator(".session-pill")).toHaveText(/Market Open|Market Closed/);
}

test("desk, volume shade, stream, and motion", async ({ page }, testInfo) => {
  await waitForBook(page);

  const chainText = await page.locator(".chain-table").innerText();
  expect(chainText).not.toMatch(/\+\d/);
  expect(chainText).not.toMatch(/ATM|±/);

  const view = page.locator("select").nth(1);
  await expect(view.locator("option[value='near']")).toHaveText("Spot Focus");
  await expect(view.locator("option[value='full']")).toHaveText("Entire Book");
  await view.selectOption("full");
  await expect(page.locator(".chain-row").nth(40)).toBeVisible();

  const headerOrder = await page.evaluate(() => {
    const heads = [...document.querySelectorAll(".chain-table thead tr:nth-child(2) th")].map((th) =>
      th.textContent?.trim(),
    );
    const strike = heads.indexOf("Price");
    return {
      before: heads.slice(Math.max(0, strike - 2), strike),
      after: heads.slice(strike + 1, strike + 3),
    };
  });
  expect(headerOrder.before).toEqual(["Change", "Last"]);
  expect(headerOrder.after).toEqual(["Last", "Change"]);

  const zeroRows = page.locator('[data-volume="zero"]');
  await expect(zeroRows.first()).toBeVisible();
  expect(await page.locator('[data-volume="zero"] .vol-high, [data-volume="zero"] .vol-low').count()).toBe(0);
  expect(await page.locator(".vol-zero").count()).toBeGreaterThan(0);
  expect(await page.locator(".vol-high").count()).toBeGreaterThan(0);
  expect(await page.locator(".vol-low").count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Magnify desk" }).click();
  await expect(page.locator(".terminal")).toHaveClass(/is-magnified/);
  await page.getByRole("button", { name: "Exit magnify" }).click();
  await expect(page.locator(".terminal")).not.toHaveClass(/is-magnified/);
  await expect(page.locator(".rail")).not.toHaveClass(/is-collapsed/);

  const barWidth = await page.locator(".oi-fill").first().evaluate((el) => parseFloat(getComputedStyle(el).width));
  expect(barWidth).toBeGreaterThan(0);
  const flash = await page.locator(".chain-table tbody td").first().evaluate((el) => {
    el.classList.add("cell-flash-up");
    return getComputedStyle(el).animationName;
  });
  expect(flash).toBe("flash-up");

  const traded = page.locator('[data-volume="traded"]').nth(3);
  await traded.evaluate((row) => {
    const scroller = row.closest(".chain-scroll");
    const head = scroller?.querySelector("thead");
    if (!(scroller instanceof HTMLElement) || !(row instanceof HTMLElement) || !(head instanceof HTMLElement)) return;
    scroller.scrollTop = Math.max(0, row.offsetTop - head.getBoundingClientRect().height - 12);
  });
  await traded.dispatchEvent("click");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  expect(await sheet.innerText()).not.toMatch(/\+\d/);
  const sheetBox = await sheet.boundingBox();
  const viewport = page.viewportSize();
  expect(sheetBox).toBeTruthy();
  expect(sheetBox!.x).toBeGreaterThanOrEqual(-1);
  expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 2);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const chain = document.querySelector(".chain-scroll") as HTMLElement;
    const list = document.querySelector(".symbol-list") as HTMLElement;
    const toolbar = document.querySelector(".toolbar") as HTMLElement;
    chain.scrollTop = 140;
    if (chain.scrollWidth > chain.clientWidth + 8) chain.scrollLeft = 180;
    const strike = chain.querySelector(".strike-cell") as HTMLElement;
    const cRect = chain.getBoundingClientRect();
    const sRect = strike.getBoundingClientRect();
    return {
      pageOverflow: doc.scrollWidth - doc.clientWidth,
      docScroll: doc.scrollTop,
      chainTop: chain.scrollTop,
      chainLeft: chain.scrollLeft,
      chainOverflows: chain.scrollWidth > chain.clientWidth + 8,
      strikeInside: sRect.left >= cRect.left - 4 && sRect.right <= cRect.right + 4,
      listDir: getComputedStyle(list).flexDirection,
      toolbarFits: toolbar.getBoundingClientRect().right <= window.innerWidth + 1,
      terminalClipped: (document.querySelector(".terminal") as HTMLElement).scrollHeight <= window.innerHeight + 2,
    };
  });

  expect(layout.pageOverflow).toBeLessThanOrEqual(2);
  expect(layout.docScroll).toBe(0);
  expect(layout.chainTop).toBeGreaterThan(40);
  expect(layout.toolbarFits).toBe(true);
  expect(layout.terminalClipped).toBe(true);
  if (layout.chainOverflows) {
    expect(layout.chainLeft).toBeGreaterThan(0);
    expect(layout.strikeInside).toBe(true);
  }
  if (testInfo.project.name !== "desktop") {
    expect(layout.listDir).toBe("row");
    await expect(page.locator(".symbol-item").first()).toBeVisible();
    const expiryBox = await page.locator("select").first().boundingBox();
    expect(expiryBox).toBeTruthy();
    expect(expiryBox!.x).toBeGreaterThanOrEqual(0);
    expect(expiryBox!.x + expiryBox!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  }

  if (testInfo.project.name !== "desktop") return;

  const expiry = page.locator("select").first();
  const firstExpiry = await expiry.inputValue();
  await expiry.selectOption({ index: 1 });
  await expect(expiry).not.toHaveValue(firstExpiry, { timeout: 40_000 });

  await page.getByRole("button", { name: "Equities" }).click();
  await page.getByPlaceholder("Find an equity").fill("ANAND");
  await page.getByRole("button", { name: /ANANDRATHI/ }).click();
  await expect(page.locator("h1")).toHaveText("ANANDRATHI");
  await expect(page.locator(".spot-block strong")).not.toHaveText("—");

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  const session = await page.locator(".session-pill").innerText();
  await expect(page.locator(".feed-chip")).toContainText(/Live|WebSocket|Rest/);
  const events = await page.evaluate(async () => {
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch("/api/stream?symbol=NIFTY&exchange=NSE&segment=INDEX", {
        signal: controller.signal,
      });
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
    if (session.includes("Closed")) expect(events).not.toContain("socket");
    if (session.includes("Open")) expect(events).toContain("socket");
  } else {
    await expect(page.locator(".feed-chip")).toContainText(/Live|WebSocket/);
  }
});
