import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:5173/";
const API_URL = process.env.TEST_API_URL ?? "http://127.0.0.1:4000/api/v1";
const VIRTUAL_ITEM_HEIGHT = 108;
const PRESELECTED_IDS = Array.from({ length: 30 }, (_value, index) => 990001 + index);

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  assert.equal(response.status, 200, `Expected 200 from ${path}, received ${response.status}`);
  return response.json();
};

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

const getLoadedItemsCount = async (listLocator) => {
  const virtualList = listLocator.locator(".virtual-list");
  const virtualHeight = await virtualList.evaluate((element) => Number.parseFloat(getComputedStyle(element).height));

  return Math.round(virtualHeight / VIRTUAL_ITEM_HEIGHT);
};

const waitForLoadedCount = async (listLocator, predicate, message) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 6000) {
    const count = await getLoadedItemsCount(listLocator);

    if (predicate(count)) {
      return count;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(message);
};

test("browser selection changes keep loaded slices aligned after background sync", async () => {
  await post("/selected-items/set", {
    operations: PRESELECTED_IDS.map((itemId) => ({ itemId, selected: true }))
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });

    const availableList = page.getByTestId("available-list");
    const selectedList = page.getByTestId("selected-list");

    const initialAvailableLoaded = await getLoadedItemsCount(availableList);
    const initialSelectedLoaded = await getLoadedItemsCount(selectedList);

    assert.ok(initialAvailableLoaded >= 20, `Expected at least 20 loaded available items, got ${initialAvailableLoaded}`);
    assert.ok(initialSelectedLoaded >= 20, `Expected at least 20 loaded selected items, got ${initialSelectedLoaded}`);

    await availableList.locator(".item-card .secondary-button").first().click();
    const syncedAvailableLoaded = await waitForLoadedCount(
      availableList,
      (count) => count >= initialAvailableLoaded,
      `Available slice should recover to at least ${initialAvailableLoaded} loaded items after select`
    );
    const selectedLoadedAfterAdd = await waitForLoadedCount(
      selectedList,
      (count) => count >= initialSelectedLoaded,
      `Selected slice should stay filled after select`
    );

    assert.equal(
      syncedAvailableLoaded,
      initialAvailableLoaded,
      `Available slice should recover to ${initialAvailableLoaded} loaded items after select, got ${syncedAvailableLoaded}`
    );
    assert.ok(
      selectedLoadedAfterAdd >= initialSelectedLoaded,
      `Selected slice should stay filled after select, got ${selectedLoadedAfterAdd}`
    );

    await selectedList.locator(".item-card .secondary-button").first().click();
    const syncedAvailableAfterRemove = await waitForLoadedCount(
      availableList,
      (count) => count >= initialAvailableLoaded,
      `Available slice should stay filled after deselect`
    );
    const syncedSelectedAfterRemove = await waitForLoadedCount(
      selectedList,
      (count) => count >= initialSelectedLoaded,
      `Selected slice should recover to at least ${initialSelectedLoaded} loaded items after deselect`
    );

    assert.equal(
      syncedSelectedAfterRemove,
      initialSelectedLoaded,
      `Selected slice should recover to ${initialSelectedLoaded} loaded items after deselect, got ${syncedSelectedAfterRemove}`
    );
    assert.ok(
      syncedAvailableAfterRemove >= initialAvailableLoaded,
      `Available slice should stay filled after deselect, got ${syncedAvailableAfterRemove}`
    );

    await request("/health");
  } finally {
    await browser.close();
    await post("/selected-items/set", {
      operations: PRESELECTED_IDS.map((itemId) => ({ itemId, selected: false }))
    });
  }
});
