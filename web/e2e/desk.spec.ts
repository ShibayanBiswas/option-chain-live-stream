import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const shotDir = path.join(process.cwd(), "docs", "screenshots");

async function waitForBook(page: Page) {
  await page.goto("/");
  await expect(page.locator("h1")).not.toHaveText("Option Chain", { timeout: 70_000 });
  await expect(page.locator(".spot-inline")).not.toHaveText("—", { timeout: 70_000 });
  await expect(page.locator(".chain-row").first()).toBeVisible();
  await expect(page.locator(".session-pill")).toHaveText(/Market Open|Market Closed|Pre Open|Market Holiday/);
}

test("desk, density, volume shade, stream, and motion", async ({ page }, testInfo) => {
  await waitForBook(page);
  fs.mkdirSync(shotDir, { recursive: true });
  if (testInfo.project.name === "phone" || testInfo.project.name === "phone-narrow") {
    await page.waitForTimeout(700);
    const viewport = page.viewportSize();
    const fitted = await page.evaluate(() => {
      const inside = (selector: string) => {
        const el = document.querySelector(selector);
        if (!(el instanceof HTMLElement)) return false;
        const box = el.getBoundingClientRect();
        return box.width > 20 && box.left >= -1 && box.right <= window.innerWidth + 1;
      };
      const row = document.querySelector(".chain-row");
      const cells = row
        ? [...row.querySelectorAll("td")].filter((td) => getComputedStyle(td).display !== "none")
        : [];
      let separated = cells.length === 5;
      for (let i = 1; i < cells.length; i += 1) {
        const previous = cells[i - 1].getBoundingClientRect();
        const next = cells[i].getBoundingClientRect();
        if (previous.right > next.left + 1) separated = false;
      }
      const chain = document.querySelector(".chain-scroll");
      const table = document.querySelector(".chain-table");
      const kpis = document.querySelector(".kpi-row");
      const chainWidth = chain instanceof HTMLElement ? chain.getBoundingClientRect().width : 0;
      const tableWidth = table instanceof HTMLElement ? table.getBoundingClientRect().width : 0;
      return {
        session: inside(".session-pill"),
        expiry: inside("[aria-label='Expiry']"),
        strikes: inside("[aria-label='Strikes']"),
        columns: inside("[aria-label='Columns']"),
        separated,
        chainFits: chain instanceof HTMLElement && chain.scrollWidth <= chain.clientWidth + 2,
        tableFills: tableWidth >= chainWidth - 4,
        kpiFits: kpis instanceof HTMLElement && kpis.scrollWidth <= kpis.clientWidth + 2,
      };
    });
    expect(fitted).toEqual({
      session: true,
      expiry: true,
      strikes: true,
      columns: true,
      separated: true,
      chainFits: true,
      tableFills: true,
      kpiFits: true,
    });
    expect(viewport?.width).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(shotDir, `desk-${testInfo.project.name}.png`), fullPage: false });
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(shotDir, `desk-${testInfo.project.name}-dark.png`), fullPage: false });
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.waitForTimeout(500);
  }

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

  const view = page.locator("select").nth(1);
  await expect(view.locator("option[value='near']")).toHaveText("Spot Focus");
  await expect(view.locator("option[value='full']")).toHaveText("Entire Book");
  await view.selectOption("full");
  await expect(page.locator(".chain-row").nth(40)).toBeVisible();

  const headerOrder = await page.evaluate(() => {
    const heads = [...document.querySelectorAll(".chain-table thead tr:nth-child(2) th")].map((th) =>
      th.textContent?.trim(),
    );
    const strike = heads.indexOf("Strike");
    return {
      before: heads.slice(Math.max(0, strike - 2), strike),
      after: heads.slice(strike + 1, strike + 3),
    };
  });
  expect(headerOrder.before).toEqual(["Chng", "LTP"]);
  expect(headerOrder.after).toEqual(["LTP", "Chng"]);

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
  if (narrow) await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);

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
    await page.locator(".rail.is-sheet").evaluate(async (el) => {
      const running = el.getAnimations().filter((item) => item.effect?.getComputedTiming().iterations !== Infinity);
      await Promise.all(running.map((item) => item.finished.catch(() => undefined)));
    });
    await expect(page.locator(".symbol-main").first()).toBeVisible();
    const toolbarBox = await page.locator(".toolbar").boundingBox();
    expect(toolbarBox, "toolbar box").toBeTruthy();
    expect(toolbarBox!.x, JSON.stringify(toolbarBox)).toBeGreaterThanOrEqual(-1);
    expect(toolbarBox!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 2);
    const target = await page.locator(".symbol-main").first().boundingBox();
    expect(target!.height).toBeGreaterThanOrEqual(44);
  }

  if (narrow) await page.getByRole("button", { name: "Collapse sidebar" }).click();
  if (testInfo.project.name !== "phone" && testInfo.project.name !== "phone-narrow") {
    await page.screenshot({
      path: path.join(shotDir, `desk-${testInfo.project.name}.png`),
      fullPage: false,
    });
  }

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
  await expect(page.locator(".spot-inline")).not.toHaveText("—", { timeout: 60_000 });
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
  const reduced = await page.locator(".terminal").evaluate((el) => getComputedStyle(el).animationDuration);
  const millis = reduced.endsWith("ms") ? Number.parseFloat(reduced) : Number.parseFloat(reduced) * 1000;
  expect(millis).toBeLessThan(50);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const session = await page.locator(".session-pill").innerText();
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
  }
});

test("universe API exposes indices and Anand Rathi Wealth only", async ({ request }) => {
  const res = await request.get("/api/universe");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const symbols = body.indexes.map((row: { symbol: string }) => row.symbol);
  expect(symbols).toEqual(["NIFTY", "SENSEX"]);
  expect(body.indexes.map((row: { exchange: string }) => row.exchange)).toEqual(["NSE", "BSE"]);
  expect(body.equities.every((row: { symbol: string }) => row.symbol === "ANANDRATHI")).toBe(true);
  expect(body.equities.length).toBeGreaterThanOrEqual(1);
  expect(body.equities.length).toBeLessThanOrEqual(2);
});
