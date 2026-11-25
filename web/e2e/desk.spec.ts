import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const shotDir = path.join(process.cwd(), "docs", "screenshots");

async function waitForBook(page: Page) {
  await page.goto("/");
  await expect(page.locator("h1")).not.toHaveText("Option Chain", { timeout: 70_000 });
  await expect(page.locator(".spot-inline")).not.toHaveText("—", { timeout: 70_000 });
  await expect(page.locator(".chain-row").first()).toBeVisible();
  await page.locator(".toolbar").getByRole("button", { name: "Updates" }).click();
  const guide = page.getByRole("dialog", { name: "Updates" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("High volume");
  await expect(guide).toContainText("Zero volume");
  await expect(guide).not.toContainText("nearest expiry");
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 1400 || width <= 400) {
    fs.mkdirSync(shotDir, { recursive: true });
    await page.screenshot({
      path: path.join(shotDir, width >= 1400 ? "updates-custom-desktop.png" : "updates-custom-phone.png"),
      fullPage: false,
    });
  }
  await guide.getByRole("button", { name: "Close updates" }).click();
  await expect(guide).toBeHidden();
  await expect(page.locator(".session-pill")).toHaveText(/Market Open|Market Closed|Pre-Open|Market Holiday|Closed/);
}

async function readInward(page: Page) {
  return page.evaluate(() => {
    const strike = document.querySelector(".inward-pane.mid .column-head .strike-cell");
    const calls = document.querySelector(".inward-panes .calls");
    const last = document.querySelector(".inward-heads .calls .column-head th:last-child");
    const sheets = [".inward-heads .calls table", ".inward-panes .calls table"]
      .map((selector) => document.querySelector(selector))
      .filter((el): el is HTMLElement => el instanceof HTMLElement);
    if (!(strike instanceof HTMLElement) || !(calls instanceof HTMLElement) || !(last instanceof HTMLElement) || sheets.length < 2) return null;
    const before = strike.getBoundingClientRect().left;
    const gapBefore = Math.abs(before - last.getBoundingClientRect().right);
    const parked = sheets.map((sheet) => sheet.style.transform);
    for (const sheet of sheets) sheet.style.transform = "translate3d(0px, 0px, 0px)";
    const after = strike.getBoundingClientRect().left;
    const gapAfter = Math.abs(strike.getBoundingClientRect().left - last.getBoundingClientRect().right);
    sheets.forEach((sheet, index) => {
      sheet.style.transform = parked[index] ?? "";
    });
    const table = calls.querySelector("table");
    return {
      moved: Math.abs(after - before),
      opened: gapAfter - gapBefore,
      overflow: table instanceof HTMLElement && table.offsetWidth > calls.clientWidth + 2,
    };
  });
}

test("desk, density, volume shade, stream, and motion", async ({ page }, testInfo) => {
  await waitForBook(page);
  fs.mkdirSync(shotDir, { recursive: true });
  if (testInfo.project.name === "phone" || testInfo.project.name === "phone-narrow") {
    await expect(page.locator(".feed-chip")).toContainText(/Closed|Delayed|REST|Waiting|Connecting/, { timeout: 25_000 });
    await page.locator(".toolbar").evaluate((bar) => {
      bar.scrollLeft = 0;
    });
    await page.waitForTimeout(400);
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
      const chainBox = chain instanceof HTMLElement ? chain.getBoundingClientRect() : null;
      return {
        name: inside("h1"),
        feed: inside(".feed-chip"),
        expiries: inside("[aria-label='Expiries']"),
        strikes: inside("[aria-label='Strikes']"),
        chainShare: chainBox ? chainBox.height / window.innerHeight : 0,
        separated,
        chainFits: chain instanceof HTMLElement && chain.scrollWidth <= chain.clientWidth + 2,
        tableFills: tableWidth >= chainWidth - 4,
        kpiFits: kpis instanceof HTMLElement && kpis.scrollWidth <= kpis.clientWidth + 2,
      };
    });
    expect(fitted.chainShare).toBeGreaterThanOrEqual(0.75);
    const labels = await page.evaluate(() => {
      const open = (selector: string) => {
        const el = document.querySelector(selector);
        if (!(el instanceof HTMLElement)) return false;
        const box = el.getBoundingClientRect();
        return box.width > 8 && box.left >= -1 && box.right <= window.innerWidth + 1 && box.top >= -1 && box.bottom <= window.innerHeight;
      };
      return {
        view: open("[aria-label='View']"),
        expiries: open("[aria-label='Expiries']"),
        strikes: open("[aria-label='Strikes']"),
        session: open(".session-pill"),
        feed: open(".feed-chip"),
        jump: open(".book-tools .icon-btn"),
      };
    });
    expect(labels).toEqual({
      view: true,
      expiries: true,
      strikes: true,
      session: true,
      feed: true,
      jump: true,
    });
    expect(fitted).toMatchObject({
      name: true,
      feed: true,
      expiries: true,
      strikes: true,
      kpiFits: true,
    });
    if (testInfo.project.name === "phone" || testInfo.project.name === "phone-narrow") {
      await expect(page.locator(".chain-scroll")).toHaveAttribute("data-inward", "true");
      const customScroll = await readInward(page);
      expect(customScroll?.overflow).toBe(true);
      expect(customScroll?.moved).toBeLessThanOrEqual(1);
      expect(customScroll?.opened).toBeGreaterThan(8);
    }
    expect(viewport?.width).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(shotDir, `desk-${testInfo.project.name}.png`), fullPage: false });
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(shotDir, `desk-${testInfo.project.name}-dark.png`), fullPage: false });
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.waitForTimeout(500);
  }

  const searchDialog = page.getByRole("dialog", { name: "Contract search" });
  await page.keyboard.press("Control+k");
  await expect(searchDialog).toBeVisible();
  await searchDialog.getByRole("button", { name: "Back" }).click();
  await expect(searchDialog).toBeHidden();

  const chainText = await page.locator(".chain-table").evaluateAll((tables) =>
    tables.map((table) => table.textContent ?? "").join(" "),
  );
  expect(chainText).not.toMatch(/\+\d/);
  expect(chainText).not.toMatch(/ATM|±/);

  const narrow = testInfo.project.name !== "desktop" && testInfo.project.name !== "laptop";
  if (narrow) {
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.locator(".rail")).not.toHaveClass(/is-collapsed/);
  }
  await expect(page.getByRole("button", { name: "Indices" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Equity" })).toBeVisible();
  if (narrow) {
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);
  }

  const priceShape = await page.evaluate(() => {
    const price = document.querySelector(".chain-scroll .quote-num");
    const strike = document.querySelector("td.strike-cell");
    return {
      price: price?.textContent?.trim() ?? "",
      align: strike instanceof HTMLElement ? getComputedStyle(strike).textAlign : "",
    };
  });
  expect(priceShape.align).toBe("center");
  expect(priceShape.price === "—" || /^\d[\d,]*\.\d{2}$/.test(priceShape.price)).toBe(true);
  await expect(page.getByLabel("View")).toHaveValue("custom");
  await expect(page.locator(".side-labels")).toContainText("Calls");
  await expect(page.locator(".side-labels")).toContainText("Puts");
  const expiryOptions = await page.getByLabel("Expiries").locator("option").allTextContents();
  expect(expiryOptions.length).toBeGreaterThan(1);
  expect(expiryOptions.some((label) => /all/i.test(label))).toBe(true);
  await page.getByRole("button", { name: "Jump to spot" }).click();
  const atmGap = await page.evaluate(() => {
    const cell = document.querySelector("tr.is-atm .strike-cell");
    const pane = document.querySelector(".inward-panes") ?? document.querySelector(".chain-scroll");
    if (!(cell instanceof HTMLElement) || !(pane instanceof HTMLElement)) return 999;
    const cellBox = cell.getBoundingClientRect();
    const paneBox = pane.getBoundingClientRect();
    return Math.abs(cellBox.top + cellBox.height / 2 - (paneBox.top + paneBox.height / 2));
  });
  expect(atmGap).toBeLessThan(240);
  await page.getByLabel("View").selectOption("chain");
  await page.locator(".toolbar").getByRole("button", { name: "Updates" }).click();
  const shades = page.getByRole("dialog", { name: "Updates" });
  await expect(shades).toBeVisible();
  await expect(shades).toContainText("High volume");
  await expect(shades).toContainText("Zero volume");
  await expect(shades).not.toContainText("nearest expiry");
  const chainWidth = testInfo.project.name === "desktop" || testInfo.project.name === "phone" ? page.viewportSize()?.width ?? 0 : 0;
  if (chainWidth >= 1400 || (chainWidth > 0 && chainWidth <= 400)) {
    await page.screenshot({
      path: path.join(shotDir, chainWidth >= 1400 ? "updates-chain-desktop.png" : "updates-chain-phone.png"),
      fullPage: false,
    });
  }
  await shades.getByRole("button", { name: "Close updates" }).click();
  await expect(shades).toBeHidden();
  await expect(page.getByLabel("Strikes")).toHaveValue("near");
  const density = page.getByTestId("density-select");
  await expect(density).toHaveValue("focus");
  await expect(page.locator(".chain-scroll")).toHaveAttribute("data-density", "focus");
  if (testInfo.project.name === "phone" || testInfo.project.name === "phone-narrow") {
    const phoneChain = await page.evaluate(() => {
      const row = document.querySelector(".chain-row");
      const cells = row
        ? [...row.querySelectorAll("td")].filter((td) => getComputedStyle(td).display !== "none")
        : [];
      const chain = document.querySelector(".chain-scroll") as HTMLElement;
      return { cells: cells.length, fits: chain.scrollWidth <= chain.clientWidth + 2 };
    });
    expect(phoneChain.cells).toBe(5);
    expect(phoneChain.fits).toBe(true);
  }
  const focusHeads = await page.locator(".chain-table thead tr th").allTextContents();
  expect(focusHeads.join(" ")).not.toMatch(/Bid Quantity|Ask Quantity/);

  await density.selectOption("full");
  await expect(page.locator(".chain-scroll")).toHaveAttribute("data-density", "full");

  await page.getByRole("button", { name: "Jump to spot" }).click();
  await expect(page.locator(".side-labels")).toContainText("Calls");
  await expect(page.locator(".side-labels")).toContainText("Puts");
  const headRows = await page.locator(".chain-table thead tr").count();
  expect(headRows === 2 || headRows === 3).toBe(true);
  await expect(page.getByTestId("spot-marker")).toBeVisible();
  await expect(page.locator(".wall-badge")).toHaveCount(0);
  const strikeGap = await page.evaluate(() => {
    const heads = [...document.querySelectorAll(".chain-table thead tr.column-head th")];
    const strike = heads.findIndex((th) => th.textContent?.trim() === "Strike");
    const call = heads[strike - 1]?.getBoundingClientRect();
    const cell = heads[strike]?.getBoundingClientRect();
    if (!call || !cell) return 99;
    return Math.abs(cell.left - call.right);
  });
  expect(strikeGap).toBeLessThanOrEqual(1);
  if (
    (testInfo.project.name === "phone" || testInfo.project.name === "phone-narrow") &&
    (await page.locator(".chain-scroll").getAttribute("data-inward")) === "true"
  ) {
    const fullScroll = await readInward(page);
    expect(fullScroll?.overflow).toBe(true);
    expect(fullScroll?.moved).toBeLessThanOrEqual(1);
    expect(fullScroll?.opened).toBeGreaterThan(8);
  }

  const headerOrder = await page.evaluate(() => {
    const heads = [...document.querySelectorAll(".chain-table thead tr.column-head th")].map((th) =>
      th.textContent?.trim(),
    );
    const strike = heads.indexOf("Strike");
    return {
      before: heads.slice(Math.max(0, strike - 2), strike),
      after: heads.slice(strike + 1, strike + 3),
    };
  });
  expect(headerOrder.before).toEqual(["Change", "LTP"]);
  expect(headerOrder.after).toEqual(["LTP", "Change"]);

  await page.getByLabel("Strikes").selectOption("full");
  const zeroRows = page.locator('[data-volume="zero"]');
  if ((await zeroRows.count()) > 0) {
    expect(await page.locator('[data-volume="zero"] .vol-high, [data-volume="zero"] .vol-low').count()).toBe(0);
  }
  expect(await page.locator(".vol-high").count()).toBeGreaterThan(0);
  expect(await page.locator(".vol-low").count()).toBeGreaterThan(0);

  if (await page.getByRole("button", { name: "Collapse sidebar" }).count()) {
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
  }
  await expect(page.locator(".terminal")).toHaveClass(/rail-hidden/);
  await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(".terminal")).not.toHaveClass(/rail-hidden/);
  await expect(page.locator(".is-itm").first()).toBeVisible();
  await expect(page.locator(".depth-bar").first()).toBeVisible();
  await expect(page.getByTestId("spot-marker")).toBeVisible();
  await expect(page.locator(".wall-badge")).toHaveCount(0);

  if (narrow) await page.getByRole("button", { name: "Collapse sidebar" }).click();
  if (narrow) await expect(page.locator(".rail")).toHaveClass(/is-collapsed/);

  const flash = await page.locator(".chain-row td.col-ltp").first().evaluate((el) => {
    el.classList.add("cell-flash-up");
    const num = el.querySelector(".quote-num");
    return {
      wash: getComputedStyle(el, "::after").animationName,
      tick: num ? getComputedStyle(num).animationName : "",
    };
  });
  expect(flash.wash).toBe("flash-wash");
  expect(flash.tick).toBe("tick-up");

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
  await expect(sheet.getByRole("heading", { name: "Calls" })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Puts" })).toBeVisible();
  const sheetBox = await sheet.boundingBox();
  const viewport = page.viewportSize();
  expect(sheetBox).toBeTruthy();
  expect(sheetBox!.x).toBeGreaterThanOrEqual(-1);
  expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 2);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(sheet).toBeHidden();

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const chain = document.querySelector(".chain-scroll") as HTMLElement;
    const scroller = (document.querySelector(".inward-panes") as HTMLElement) ?? chain;
    const toolbar = document.querySelector(".toolbar") as HTMLElement;
    const stage = document.querySelector(".stage") as HTMLElement;
    scroller.scrollTop = 140;
    const strike = scroller.querySelector("tbody .strike-cell") as HTMLElement;
    if (chain.scrollWidth > chain.clientWidth + 8 && strike) {
      const delta = strike.getBoundingClientRect().left - chain.getBoundingClientRect().left;
      chain.scrollLeft = Math.max(0, chain.scrollLeft + delta - chain.clientWidth / 2 + strike.clientWidth / 2);
    }
    const cRect = chain.getBoundingClientRect();
    const sRect = strike.getBoundingClientRect();
    return {
      pageOverflow: doc.scrollWidth - doc.clientWidth,
      docScroll: doc.scrollTop,
      chainTop: scroller.scrollTop,
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
  if (layout.chainOverflows && testInfo.project.name !== "phone-narrow") {
    expect(layout.strikeInside, JSON.stringify(layout)).toBe(true);
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

  await page.keyboard.press("Control+k");
  const search = page.getByLabel("Search indices and equity");
  await search.fill("NIFTY");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.locator("h1")).toContainText(/NIFTY/);

  const indexLabels = await page
    .locator("section.tree-section", { hasText: "Indices" })
    .locator(".symbol-main span")
    .allTextContents();
  expect(indexLabels[0]).toBe("NIFTY 50");
  expect(indexLabels).toContain("SENSEX");
  const equityNames = page.locator("section.tree-section", { hasText: "Equity" }).locator(".symbol-main");
  const equityLabels = await equityNames.allTextContents();
  expect(equityLabels.length).toBeGreaterThan(0);
  expect(equityLabels.every((label) => /Anand Rathi Wealth|ANANDRATHI/i.test(label))).toBe(true);
  await equityNames.first().click();
  await expect(page.locator("h1")).toHaveText("Anand Rathi Wealth");
  await expect(page.locator(".spot-inline")).not.toHaveText("—", { timeout: 60_000 });
  const expiry = page.getByLabel("Expiry");
  const expiryValues = await expiry.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean),
  );
  expect(expiryValues.length).toBeGreaterThan(1);
  const currentExpiry = await expiry.inputValue();
  const nextExpiry = expiryValues.find((value) => value !== currentExpiry) ?? expiryValues[0];
  await expiry.selectOption(nextExpiry);
  await expect(expiry).toHaveValue(nextExpiry);
  await expect(page.locator(".chain-row").first()).toBeVisible();

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
    expect(events).not.toContain("socket");
    expect(events.join(" ")).not.toMatch(/websocket/i);
  }
});

test("universe API exposes indices and Anand Rathi Wealth only", async ({ request }) => {
  const res = await request.get("/api/universe");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const symbols = body.indexes.map((row: { exchange: string; symbol: string }) => `${row.exchange}:${row.symbol}`);
  expect(symbols[0]).toBe("NSE:NIFTY");
  expect(symbols).toContain("BSE:SENSEX");
  expect(body.equities.every((row: { symbol: string }) => row.symbol === "ANANDRATHI")).toBe(true);
  expect(body.equities).toEqual(expect.arrayContaining([expect.objectContaining({ exchange: "NSE", symbol: "ANANDRATHI" })]));
});
