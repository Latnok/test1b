import assert from "node:assert/strict";
import test from "node:test";

import { QueueService } from "../apps/backend/src/modules/queue/queue.service.ts";

test("concurrent selection updates for the same item resolve to the last state without hanging", async () => {
  let selectionCalls = 0;
  let capturedOperations: Array<{ itemId: number; selected: boolean }> = [];

  const queueService = new QueueService({
    addFlushMs: 0,
    itemsRepository: {
      addItems: async () => ({ createdIds: [], skippedIds: [] }),
      listAvailableItems: async () => []
    } as never,
    selectionRepository: {
      applySelectionOperations: async (_client: unknown, operations: Array<{ itemId: number; selected: boolean }>) => {
        selectionCalls += 1;
        capturedOperations = operations;

        return {
          deselectedIds: operations.filter((operation) => !operation.selected).map((operation) => operation.itemId),
          selectedIds: operations.filter((operation) => operation.selected).map((operation) => operation.itemId)
        };
      },
      listSelectedItems: async () => [],
      reorderSelectedItems: async () => ({ orderedIds: [] })
    } as never,
    syncFlushMs: 0
  });

  const [first, second] = await Promise.all([
    queueService.enqueueSelection(42, true),
    queueService.enqueueSelection(42, false)
  ]);

  assert.equal(selectionCalls, 1);
  assert.deepEqual(capturedOperations, [{ itemId: 42, selected: false }]);
  assert.deepEqual(first, { itemId: 42, selected: false });
  assert.deepEqual(second, { itemId: 42, selected: false });
});
