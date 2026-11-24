import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const shotDir = path.join(process.cwd(), "docs", "screenshots");

async function waitForBook(page: Page) {
  await page.goto("/");
  await expect(page.locator("h1")).not.toHaveText("Option Chain", { timeout: 70_000 });
  await expect(page.locator(".spot-block strong")).not.toHaveText("—", { timeout: 70_000 });
  await expect(page.locator(".chain-row").first()).toBeVisible();
  await expect(page.locator(".session-pill")).toHaveText(/Market Open|Market Closed|Pre Open|Market Holiday/);
}

test("desk, density, volume shade, stream, and motion", async ({ page }, testInfo) => {
  await waitForBook(page);

  const chainText = await page.locator(".chain-table").innerText();
  expect(chainText).not.toMatch(/\+\d/);
  expect(chainText).not.toMatch(/ATM|±/);

  const narrow = testInfo.project.name !== "desktop" && testInfo.project.name !== "laptop";
  if (narrow) {
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.locator(".rail")).not.toHaveClass(/is-collapsed/);
  }
  await expect(page.getByRole("button", { name: "Indices" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Equity" })).toBeVisible();

  const density = page.getByTestId("density-select");
  await expect(density).toHaveValue("focus");
  await expect(page.locator(".chain-scroll")).toHaveAttribute("data-density", "focus");
  const focusHeads = await page.locator(".chain-table thead tr:nth-child(2) th").allTextContents();
  expect(focusHeads.join(" ")).not.toMatch(/Bid Quantity|Ask Quantity/);

  await density.selectOption("full");
  await expect(page.locator(".chain-scroll")).toHaveAttribute("data-density", "full");
  await expect(page.locator(".oi-chart")).toHaveAttribute("data-density", "full");

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

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".terminal")).toHaveClass(/rail-hidden/);
  await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(".terminal")).not.toHaveClass(/rail-hidden/);
  await expect(page.locator(".is-itm").first()).toBeVisible();
  await expect(page.locator(".depth-bar").first()).toBeVisible();
  await expect(page.getByTestId("spot-marker")).toBeVisible();

  if (narrow) await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.getByRole("button", { name: "Magnify desk" }).click();
  await expect(page.locator(".terminal")).toHaveClass(/is-magnified/);
  await page.getByRole("button", { name: "Exit magnify" }).click();
  await expect(page.locator(".terminal")).not.toHaveClass(/is-magnified/);
  if (narrow) await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);

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
    const toolbar = document.querySelector(".toolbar") as HTMLElement;
    const stage = document.querySelector(".stage") as HTMLElement;
    chain.scrollTop = 140;
    const strike = chain.querySelector("tbody .strike-cell") as HTMLElement;
    if (chain.scrollWidth > chain.clientWidth + 8 && strike) {
      const delta = strike.getBoundingClientRect().left - chain.getBoundingClientRect().left;
      chain.scrollLeft = Math.max(0, chain.scrollLeft + delta - chain.clientWidth / 2 + strike.clientWidth / 2);
    }
    const cRect = chain.getBoundingClientRect();
    const sRect = strike.getBoundingClientRect();
    return {
      strikeLeft: Math.round(sRect.left),
      strikeRight: Math.round(sRect.right),
      chainLeft: Math.round(cRect.left),
      chainRight: Math.round(cRect.right),
      pageOverflow: doc.scrollWidth - doc.clientWidth,
      docScroll: doc.scrollTop,
      chainTop: chain.scrollTop,
      chainLeft: chain.scrollLeft,
      chainOverflows: chain.scrollWidth > chain.clientWidth + 8,
      strikeInside: sRect.left >= cRect.left - 4 && sRect.right <= cRect.right + 4,
      toolbarFits: toolbar.getBoundingClientRect().right <= window.innerWidth + 1,
      terminalWidth: (document.querySelector(".terminal") as HTMLElement).getBoundingClientRect().width,
      stageMaxWidth: getComputedStyle(stage).maxWidth,
      toolbarMaxWidth: getComputedStyle(toolbar).maxWidth,
      terminalClipped: (document.querySelector(".terminal") as HTMLElement).scrollHeight <= window.innerHeight + 2,
    };
  });

  expect(layout.pageOverflow).toBeLessThanOrEqual(2);
  expect(layout.docScroll).toBe(0);
  expect(layout.chainTop).toBeGreaterThan(40);
  expect(layout.toolbarFits).toBe(true);
  expect(layout.terminalWidth).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 2);
  expect(layout.stageMaxWidth).toBe("none");
  expect(layout.toolbarMaxWidth).toBe("100%");
  expect(layout.terminalClipped).toBe(true);
  if (layout.chainOverflows) {
    expect(layout.chainLeft).toBeGreaterThan(0);
    if (testInfo.project.name !== "phone-narrow") {
      expect(layout.strikeInside, JSON.stringify(layout)).toBe(true);
    }
  }
  if (narrow) {
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.locator(".rail.is-sheet")).toBeVisible();
    await expect(page.locator(".symbol-main").first()).toBeVisible();
    const expiryBox = await page.getByLabel("Expiry").boundingBox();
    expect(expiryBox).toBeTruthy();
    expect(expiryBox!.x).toBeGreaterThanOrEqual(0);
    expect(expiryBox!.x + expiryBox!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    const target = await page.locator(".symbol-main").first().boundingBox();
    expect(target!.height).toBeGreaterThanOrEqual(44);
  }

  if (narrow) await page.getByRole("button", { name: "Collapse sidebar" }).click();
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({
    path: path.join(shotDir, `desk-${testInfo.project.name}.png`),
    fullPage: false,
  });

  if (testInfo.project.name !== "desktop") return;

  await page.getByRole("button", { name: "Search contracts" }).click();
  const search = page.getByLabel("Search indices and equity");
  await search.fill("NIFTY");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.locator("h1")).toContainText(/NIFTY/);

  const equityNames = page.locator("section.tree-section", { hasText: "Equity" }).locator(".symbol-main");
  const equityLabels = await equityNames.allTextContents();
  expect(equityLabels.length).toBeGreaterThan(0);
  expect(equityLabels.length).toBeLessThanOrEqual(2);
  expect(equityLabels.every((label) => /Anand Rathi Wealth|ANANDRATHI/i.test(label))).toBe(true);
  await equityNames.first().click();
  await expect(page.locator("h1")).toHaveText("Anand Rathi Wealth");
  await expect(page.locator(".spot-block strong")).not.toHaveText("—", { timeout: 60_000 });
  const expiry = page.getByLabel("Expiry");
  if ((await expiry.locator("option").count()) > 1) {
    await expiry.selectOption({ index: 1 });
    await expect(page.getByRole("status").filter({ hasText: "Expiry updated" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: path.join(shotDir, "desk-desktop-dark.png"), fullPage: false });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.locator(".ticker-track").evaluate((el) => getComputedStyle(el).animationDuration);
  const millis = reduced.endsWith("ms") ? Number.parseFloat(reduced) : Number.parseFloat(reduced) * 1000;
  expect(millis).toBeLessThan(50);
  await page.emulateMedia({ reducedMotion: "no-preference" });

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

test("universe API exposes indices and Anand Rathi Wealth only", async ({ request }) => {
  const res = await request.get("/api/universe");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.indexes.length).toBeGreaterThan(5);
  const symbols = body.indexes.map((row: { symbol: string }) => row.symbol);
  expect(symbols).toEqual(expect.arrayContaining(["NIFTY"]));
  expect(body.equities.every((row: { symbol: string }) => row.symbol === "ANANDRATHI")).toBe(true);
  expect(body.equities.length).toBeGreaterThanOrEqual(1);
  expect(body.equities.length).toBeLessThanOrEqual(2);
});
