import assert from "node:assert/strict";
import test from "node:test";

import { QueueService } from "../apps/backend/src/modules/queue/queue.service.ts";

test("identical reorder requests in one flush window are deduplicated", async () => {
  let reorderCalls = 0;

  const selectionRepository = {
    applySelectionOperations: async () => ({ deselectedIds: [], selectedIds: [] }),
    listSelectedItems: async () => [],
    reorderSelectedItems: async (_client: unknown, itemIds: number[]) => {
      reorderCalls += 1;
      return { orderedIds: itemIds };
    }
  };

  const queueService = new QueueService({
    itemsRepository: {
      addItems: async () => ({ createdIds: [], skippedIds: [] }),
      listAvailableItems: async () => []
    } as never,
    selectionRepository: selectionRepository as never
  });

  const payload = [11, 7, 5];
  const [first, second] = await Promise.all([
    queueService.enqueueReorder(payload),
    queueService.enqueueReorder(payload)
  ]);

  assert.equal(reorderCalls, 1);
  assert.deepEqual(first.orderedIds, payload);
  assert.deepEqual(second.orderedIds, payload);
});
