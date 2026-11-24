import { expect, test, type Page } from "@playwright/test";

import { chain, oi, quotes, universe } from "./fixtures";

async function installBook(page: Page) {
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
}

async function openDesk(page: Page) {
  await installBook(page);
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("NIFTY");
  await expect(page.locator(".chain-row").first()).toBeVisible();
  await expect(page.locator(".session-pill")).toHaveText("Market Closed");
}

function touchProject(name: string) {
  return name === "tablet" || name === "phone" || name === "phone-360";
}

test("chain density, colour, navigation, and chrome", async ({ page }, testInfo) => {
  await openDesk(page);
  const touch = touchProject(testInfo.project.name);

  const chainText = await page.locator(".chain-table").first().innerText();
  expect(chainText).not.toMatch(/\+\d/);
  expect(chainText).not.toMatch(/ATM|±/);

  const calls = page.locator(".chain-head .chain-pane.calls thead tr").first().locator("th");
  const callCount = await calls.count();
  await expect(calls.nth(callCount - 1)).toHaveText("Last");
  await expect(calls.nth(callCount - 2)).toHaveText("Change");
  const puts = page.locator(".chain-head .chain-pane.puts thead tr").first().locator("th");
  await expect(puts.nth(0)).toHaveText("Last");
  await expect(puts.nth(1)).toHaveText("Change");
  await expect(page.locator(".chain-scroll")).toHaveAttribute("data-density", "collapsed");
  await expect(page.getByTestId("chain-head")).toBeVisible();
  await expect(page.getByTestId("chain-head")).toContainText("Calls");
  await expect(page.getByTestId("chain-head")).toContainText("Puts");
  await expect(page.getByTestId("chain-head")).toContainText("OI");
  await expect(page.getByTestId("chain-head")).toContainText("Last");
  const headerStuck = await page.evaluate(() => {
    const scroller = document.querySelector(".chain-scroll") as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
    const head = document.querySelector(".chain-head")!.getBoundingClientRect();
    const frame = scroller.getBoundingClientRect();
    return head.top >= frame.top - 2 && head.top <= frame.top + 2 && head.bottom <= frame.bottom;
  });
  expect(headerStuck).toBe(true);
  const clippedHeaders = await page.evaluate(() => {
    const bad: string[] = [];
    for (const pane of document.querySelectorAll(".chain-head .chain-pane")) {
      const frame = pane.getBoundingClientRect();
      for (const cell of pane.querySelectorAll("th[data-col], th.strike-cell")) {
        const box = cell.getBoundingClientRect();
        const seen = box.right > frame.left + 1 && box.left < frame.right - 1;
        const full = box.left >= frame.left - 1 && box.right <= frame.right + 1;
        if (seen && !full) bad.push((cell.textContent ?? "").trim());
      }
    }
    return bad;
  });
  expect(clippedHeaders).toEqual([]);
  await expect(page.locator(".chain-pane.calls thead")).not.toContainText("Bid");

  await page.locator(".desk-header").getByRole("button", { name: "Expand columns" }).click();
  await expect(page.locator(".chain-scroll")).toHaveAttribute("data-density", "expanded");
  await expect(page.locator(".chain-pane.calls thead")).toContainText("Bid");
  await page.locator(".desk-header").getByRole("button", { name: "Collapse columns" }).click();

  await expect(page.locator('.chain-pane.calls tr[data-strike="25200"] td.is-itm').first()).toBeVisible();
  await expect(page.locator('.chain-pane.puts tr[data-strike="25450"] td.is-itm').first()).toBeVisible();
  await expect(page.locator(".depth-bar").first()).toBeVisible();
  await expect(page.locator(".vol-zero").first()).toBeVisible();
  await expect(page.locator(".vol-high").first()).toBeVisible();
  await expect(page.locator(".vol-low").first()).toBeVisible();
  await expect(page.locator(".spot-marker").first()).toBeVisible();
  await expect(page.locator('[data-call-wall="true"]')).toHaveCount(1);
  await expect(page.locator('[data-put-wall="true"]')).toHaveCount(1);

  const overlaps = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".symbol-row")];
    const hits: string[] = [];
    for (const row of rows) {
      const boxes = [".symbol-copy strong", ".symbol-quote", ".spark, .spark-empty", ".pin-btn"]
        .map((selector) => row.querySelector(selector)?.getBoundingClientRect())
        .filter((box): box is DOMRect => Boolean(box));
      for (let left = 0; left < boxes.length; left += 1) {
        for (let right = left + 1; right < boxes.length; right += 1) {
          const a = boxes[left]!;
          const b = boxes[right]!;
          const overlaps =
            a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
          if (overlaps) hits.push((row.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60));
        }
      }
    }
    return hits;
  });
  expect(overlaps).toEqual([]);

  const gap = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".chain-pane.calls tbody tr.chain-row td")].slice(0, 6);
    let max = 0;
    for (let index = 1; index < cells.length; index += 1) {
      const previous = cells[index - 1]!.getBoundingClientRect();
      const current = cells[index]!.getBoundingClientRect();
      if (previous.top !== current.top) continue;
      max = Math.max(max, Math.abs(current.left - previous.right));
    }
    return max;
  });
  expect(gap).toBeLessThanOrEqual(1.5);

  await expect(page.locator(".oi-chart")).toHaveAttribute("data-density", "collapsed");
  await page.getByRole("button", { name: "Expand open interest" }).first().click();
  await expect(page.locator(".oi-chart")).toHaveAttribute("data-density", "expanded");
  await expect(page.getByText("Change in open interest")).toBeVisible();
  await expect(page.locator(".oi-fill").first()).toBeVisible();
  await page.getByRole("button", { name: "Collapse open interest" }).first().click();

  const expiry = page.getByLabel("Expiry");
  await expect(expiry.locator("optgroup")).toHaveCount(2);
  await expect(expiry.locator("option").first()).toHaveText(/·/);
  await expiry.selectOption("31-Dec-2026");
  await expect(page.locator(".toast").last()).toHaveText("Expiry updated");

  const header = page.getByTestId("desk-header");
  const headerBox = await header.boundingBox();
  const viewport = page.viewportSize()!;
  expect(headerBox!.x).toBeLessThanOrEqual(1);
  expect(headerBox!.x + headerBox!.width).toBeGreaterThanOrEqual(viewport.width - 1);
  const toggle = header.getByRole("button", { name: "Toggle sidebar" });
  const title = await page.locator("h1").boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(title!.x + 1);

  if (!touch) {
    await page.getByRole("button", { name: "Magnify desk" }).click();
    await expect(page.locator(".terminal")).toHaveClass(/is-magnified/);
    await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);
    await page.getByRole("button", { name: "Exit magnify" }).click();
    await expect(page.locator(".terminal")).not.toHaveClass(/is-magnified/);
    await expect(page.locator(".rail")).not.toHaveClass(/is-collapsed/);
    await toggle.click();
    await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);
    await toggle.click();
    await expect(page.locator(".rail")).not.toHaveClass(/is-collapsed/);
    await page.getByRole("button", { name: "Indices", exact: true }).click();
    await expect(page.getByRole("button", { name: "NIFTY NSE", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Indices", exact: true }).click();
    await page.getByRole("button", { name: "NIFTY NSE", exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: "NIFTYNXT50 NSE", exact: true })).toBeFocused();
  } else {
    await expect(page.locator(".rail")).toHaveCount(0);
    await expect(page.locator(".mobile-dock")).toBeVisible();
    const dockButton = page.locator(".mobile-dock .btn-icon").first();
    const dockBox = await dockButton.boundingBox();
    expect(dockBox!.width).toBeGreaterThanOrEqual(44);
    expect(dockBox!.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(page.getByRole("dialog", { name: "Instruments" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ANANDRATHI NSE" })).toBeVisible();
    await page.getByRole("button", { name: "ANANDRATHI NSE" }).click();
    await expect(page.locator("h1")).toHaveText("ANANDRATHI");
    await expect(page.getByRole("dialog", { name: "Instruments" })).toBeHidden();
  }

  await page.keyboard.press("Control+k");
  const palette = page.getByTestId("command-palette");
  await expect(palette).toBeVisible();
  await page.getByRole("textbox", { name: "Filter instruments" }).fill("RELIANCE");
  await expect(palette.getByRole("button")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Filter instruments" }).fill("ANAND");
  await expect(palette.getByRole("button", { name: /ANANDRATHI/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  const flash = await page.locator(".chain-table tbody td").nth(3).evaluate((el) => {
    el.classList.add("cell-flash-up");
    return getComputedStyle(el).animationName;
  });
  expect(flash).toBe("flash-up");

  await page.locator("[data-volume='traded']").first().click();
  const sheet = page.getByRole("dialog", { name: /Strike/ });
  await expect(sheet).toBeVisible();
  await expect(sheet).not.toContainText(/\+\d/);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const chain = document.querySelector(".chain-scroll") as HTMLElement;
    const before = doc.scrollTop;
    chain.scrollTop = 80;
    return {
      pageOverflow: doc.scrollWidth - doc.clientWidth,
      chainOverflow: getComputedStyle(chain).overflowY,
      docMoved: doc.scrollTop !== before,
      chainTop: chain.scrollTop,
      terminalClipped: (document.querySelector(".terminal") as HTMLElement).scrollHeight <= window.innerHeight + 4,
    };
  });
  expect(layout.pageOverflow).toBeLessThanOrEqual(2);
  expect(layout.chainOverflow).toMatch(/auto|scroll/);
  expect(layout.docMoved).toBe(false);
  if (layout.chainTop === 0) {
    expect(layout.chainOverflow).toMatch(/auto|scroll/);
  }
  expect(layout.terminalClipped).toBe(true);

  if (!touch) {
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }
});

test("reduced motion stops the ticker", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDesk(page);
  await expect(page.locator(".ticker-strip")).toHaveClass(/is-still/);
  const duration = await page.locator(".ticker-track").evaluate((el) => getComputedStyle(el).animationDuration);
  expect(duration, `animation duration was ${duration}`).toMatch(/^(0s|0\.0)/);
});
