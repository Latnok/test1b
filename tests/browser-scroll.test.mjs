import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:5173/";
const TARGET_LOADED_ITEMS = 200;
const VIRTUAL_ITEM_HEIGHT = 108;
const MAX_RENDERED_ROWS = 24;

test("browser scroll keeps the left list DOM bounded while pages accumulate", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });

    const availableList = page.getByTestId("available-list");
    const virtualList = availableList.locator(".virtual-list");

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const virtualHeight = await virtualList.evaluate((element) => Number.parseFloat(getComputedStyle(element).height));
      const loadedItems = Math.round(virtualHeight / VIRTUAL_ITEM_HEIGHT);

      if (loadedItems >= TARGET_LOADED_ITEMS) {
        break;
      }

      await availableList.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await page.waitForTimeout(150);
    }

    const finalVirtualHeight = await virtualList.evaluate((element) => Number.parseFloat(getComputedStyle(element).height));
    const finalLoadedItems = Math.round(finalVirtualHeight / VIRTUAL_ITEM_HEIGHT);
    const renderedRows = await availableList.locator(".virtual-row").count();
    const renderedCards = await availableList.locator(".item-card").count();

    assert.ok(
      finalLoadedItems >= TARGET_LOADED_ITEMS,
      `Expected at least ${TARGET_LOADED_ITEMS} loaded items, but only ${finalLoadedItems} were loaded`
    );
    assert.ok(
      renderedRows <= MAX_RENDERED_ROWS,
      `Expected at most ${MAX_RENDERED_ROWS} rendered rows, but found ${renderedRows}`
    );
    assert.equal(renderedRows, renderedCards, "Each virtual row should contain exactly one rendered card");
  } finally {
    await browser.close();
  }
});
