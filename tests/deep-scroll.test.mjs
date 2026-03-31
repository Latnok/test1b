import assert from "node:assert/strict";
import test from "node:test";

const API_BASE_URL = process.env.TEST_API_BASE_URL ?? "http://localhost:4000/api/v1";
const PAGE_SIZE = 20;
const CHECKPOINTS = [1000, 10000, 100000, 999000];

const encodeCursor = (value) => {
  return Buffer.from(JSON.stringify(value), "utf-8").toString("base64");
};

const fetchItemsPage = async (cursor) => {
  const url = new URL(`${API_BASE_URL}/items`);
  url.searchParams.set("limit", String(PAGE_SIZE));

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url);
  assert.equal(response.status, 200, `Expected 200 from ${url}, received ${response.status}`);

  const payload = await response.json();
  assert.ok(Array.isArray(payload.items), "Response must contain an items array");
  assert.ok(payload.items.length > 0, "Items page should not be empty");

  return payload;
};

const assertAscending = (items) => {
  for (let index = 1; index < items.length; index += 1) {
    assert.ok(
      items[index].id > items[index - 1].id,
      `Items must be strictly ascending, but ${items[index - 1].id} -> ${items[index].id} was found`
    );
  }
};

const reachCheckpoint = async (checkpoint) => {
  let cursor = encodeCursor({ id: Math.max(0, checkpoint - PAGE_SIZE * 3) });
  const visitedItems = [];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const page = await fetchItemsPage(cursor);
    assertAscending(page.items);
    visitedItems.push(...page.items);

    if (page.items.some((item) => item.id >= checkpoint)) {
      return {
        items: visitedItems,
        nextCursor: page.nextCursor
      };
    }

    assert.ok(page.nextCursor, `Expected nextCursor while advancing to checkpoint ${checkpoint}`);
    cursor = page.nextCursor;
  }

  assert.fail(`Failed to reach checkpoint ${checkpoint} within 5 pages`);
};

test("GET /api/v1/items serves pages for deep scroll checkpoints", async () => {
  for (const checkpoint of CHECKPOINTS) {
    const result = await reachCheckpoint(checkpoint);
    const reachedItem = result.items.find((item) => item.id >= checkpoint);

    assert.ok(reachedItem, `Checkpoint ${checkpoint} was not reached`);
    assert.ok(
      reachedItem.id <= checkpoint + PAGE_SIZE * 3,
      `Checkpoint ${checkpoint} overshot too far: first reached id ${reachedItem.id}`
    );
  }
});
