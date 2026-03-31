import assert from "node:assert/strict";
import test from "node:test";

import { QueueService } from "../apps/backend/src/modules/queue/queue.service.ts";

test("read cache serves repeated reads and is invalidated after add flush", async () => {
  let now = 10_000;
  let listCalls = 0;
  let addCalls = 0;

  const itemsRepository = {
    addItems: async (ids: number[]) => {
      addCalls += 1;
      return {
        createdIds: ids,
        skippedIds: []
      };
    },
    listAvailableItems: async () => {
      listCalls += 1;
      return [
        {
          id: 1,
          imgUrl: "img-1",
          title: `Item ${listCalls}`
        }
      ];
    }
  };

  const selectionRepository = {
    applySelectionOperations: async () => ({ deselectedIds: [], selectedIds: [] }),
    listSelectedItems: async () => [],
    reorderSelectedItems: async () => ({ orderedIds: [] })
  };

  const queueService = new QueueService({
    addFlushMs: 0,
    itemsRepository: itemsRepository as never,
    now: () => now,
    selectionRepository: selectionRepository as never,
    syncFlushMs: 5
  });

  const firstRead = await queueService.enqueueAvailableItemsRead({ limit: 20 });
  assert.equal(listCalls, 1);
  assert.equal(firstRead[0]?.title, "Item 1");

  const secondRead = await queueService.enqueueAvailableItemsRead({ limit: 20 });
  assert.equal(listCalls, 1);
  assert.equal(secondRead[0]?.title, "Item 1");

  await queueService.enqueueAdd(1234567);
  assert.equal(addCalls, 1);

  now += 10;

  const thirdRead = await queueService.enqueueAvailableItemsRead({ limit: 20 });
  assert.equal(listCalls, 2);
  assert.equal(thirdRead[0]?.title, "Item 2");
});
