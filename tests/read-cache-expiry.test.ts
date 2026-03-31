import assert from "node:assert/strict";
import test from "node:test";

import { QueueService } from "../apps/backend/src/modules/queue/queue.service.ts";

test("read cache expires after sync flush ttl", async () => {
  let now = 5_000;
  let listCalls = 0;

  const queueService = new QueueService({
    itemsRepository: {
      addItems: async () => ({ createdIds: [], skippedIds: [] }),
      listAvailableItems: async () => {
        listCalls += 1;
        return [
          {
            id: listCalls,
            imgUrl: `img-${listCalls}`,
            title: `Item ${listCalls}`
          }
        ];
      }
    } as never,
    now: () => now,
    selectionRepository: {
      applySelectionOperations: async () => ({ deselectedIds: [], selectedIds: [] }),
      listSelectedItems: async () => [],
      reorderSelectedItems: async () => ({ orderedIds: [] })
    } as never,
    syncFlushMs: 5
  });

  const first = await queueService.enqueueAvailableItemsRead({ limit: 20 });
  const second = await queueService.enqueueAvailableItemsRead({ limit: 20 });

  assert.equal(listCalls, 1);
  assert.equal(first[0]?.title, "Item 1");
  assert.equal(second[0]?.title, "Item 1");

  now += 6;

  const third = await queueService.enqueueAvailableItemsRead({ limit: 20 });
  assert.equal(listCalls, 2);
  assert.equal(third[0]?.title, "Item 2");
});
