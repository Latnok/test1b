import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:5173/";
const API_URL = process.env.TEST_API_URL ?? "http://127.0.0.1:4000/api/v1";
const CONTROLLED_IDS = [1992001, 1992002, 1992003];

const post = async (path, body) => {
  const response = await fetch(`${API_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  assert.ok(
    response.status === 200 || response.status === 202,
    `Expected 200/202 from ${path}, received ${response.status}`
  );

  return response.json();
};

const extractIds = async (page) => {
  const texts = await page.locator("[data-testid='selected-list'] .item-card .item-copy span").allTextContents();

  return texts
    .map((text) => Number(text.replace(/\D/g, "")))
    .filter((id) => CONTROLLED_IDS.includes(id));
};

const waitForSelectedCount = async (page, expectedCount) => {
  const items = page.locator("[data-testid='selected-list'] .item-card");
  const startedAt = Date.now();

  while (Date.now() - startedAt < 8000) {
    if (await items.count() === expectedCount) {
      return items;
    }

    await page.waitForTimeout(250);
  }

  return items;
};

const waitForReorderStatus = async (readStatus) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 8000) {
    const status = readStatus();

    if (status !== null) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return null;
};

test("selected list supports body drag reorder and persists the new order", async () => {
  await post("/selected-items/set", {
    operations: CONTROLLED_IDS.map((itemId) => ({ itemId, selected: false }))
  });
  await post("/items/add", { ids: CONTROLLED_IDS });
  await post("/selected-items/set", {
    operations: CONTROLLED_IDS.map((itemId) => ({ itemId, selected: true }))
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  let reorderStatus = null;

  page.on("response", (response) => {
    if (response.url().includes("/selected-items/reorder")) {
      reorderStatus = response.status();
    }
  });

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.locator(".panel-controls-single .field input").fill("199200");

    const items = await waitForSelectedCount(page, 3);
    assert.equal(await items.count(), 3, "Expected exactly 3 filtered selected items");
    await items.nth(0).scrollIntoViewIfNeeded();
    await items.nth(2).scrollIntoViewIfNeeded();

    const initialOrder = await extractIds(page);
    assert.deepEqual(initialOrder, CONTROLLED_IDS);

    const firstBox = await items.nth(0).boundingBox();
    const thirdBox = await items.nth(2).boundingBox();

    assert.ok(firstBox && thirdBox, "Expected drag target boxes to exist");

    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, { steps: 18 });
    await page.mouse.up();

    assert.equal(await waitForReorderStatus(() => reorderStatus), 202, "Expected successful reorder response");

    const reorderedOrder = await extractIds(page);
    assert.deepEqual(reorderedOrder, [1992002, 1992003, 1992001]);

    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".panel-controls-single .field input").fill("199200");
    await waitForSelectedCount(page, 3);

    const persistedOrder = await extractIds(page);
    assert.deepEqual(persistedOrder, [1992002, 1992003, 1992001]);
  } finally {
    await browser.close();
    await post("/selected-items/set", {
      operations: CONTROLLED_IDS.map((itemId) => ({ itemId, selected: false }))
    });
  }
});
