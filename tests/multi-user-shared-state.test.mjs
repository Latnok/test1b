import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:5173/";
const API_URL = process.env.TEST_API_URL ?? "http://127.0.0.1:4000/api/v1";

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

test("multiple browser clients share state but do not auto-sync without a new read", async () => {
  const controlledIds = [991001];
  await post("/selected-items/set", {
    operations: controlledIds.map((itemId) => ({ itemId, selected: false }))
  });
  await post("/items/add", { ids: controlledIds });

  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await Promise.all([
      pageA.goto(APP_URL, { waitUntil: "networkidle" }),
      pageB.goto(APP_URL, { waitUntil: "networkidle" })
    ]);

    await Promise.all([
      pageA.reload({ waitUntil: "networkidle" }),
      pageB.reload({ waitUntil: "networkidle" })
    ]);

    const pageAAvailable = pageA.getByTestId("available-list");
    const pageASelected = pageA.getByTestId("selected-list");
    const pageBSelected = pageB.getByTestId("selected-list");

    await pageA.locator(".panel-controls .field input").first().fill(String(controlledIds[0]));
    await pageB.locator(".panel-controls .field input").first().fill(String(controlledIds[0]));
    await pageA.locator(".panel-controls-single .field input").fill(String(controlledIds[0]));
    await pageB.locator(".panel-controls-single .field input").fill(String(controlledIds[0]));
    await pageA.waitForTimeout(1500);
    await pageB.waitForTimeout(1500);

    const pageBSelectedBeforeMutation = await pageBSelected.locator(".item-card").count();
    assert.equal(pageBSelectedBeforeMutation, 0, "Client B should initially see no selected item for the controlled ID");

    await pageAAvailable.locator(".item-card .secondary-button").first().click();
    await pageA.waitForTimeout(2_500);

    const pageASelectedAfter = await pageASelected.locator(".item-card").count();
    const pageBSelectedBeforeReload = await pageBSelected.locator(".item-card").count();

    assert.ok(pageASelectedAfter >= 1, "Client A should see its own mutation");
    assert.equal(
      pageBSelectedBeforeReload,
      pageBSelectedBeforeMutation,
      "Client B should stay stale until it performs a fresh read"
    );

    await pageB.reload({ waitUntil: "networkidle" });
    const pageBSelectedAfterReload = await pageBSelected.locator(".item-card").count();

    assert.ok(
      pageBSelectedAfterReload >= 1,
      "Client B should receive the shared server state after reload"
    );
  } finally {
    await contextA.close();
    await contextB.close();
    await browser.close();
    await post("/selected-items/set", {
      operations: controlledIds.map((itemId) => ({ itemId, selected: false }))
    });
  }
});
