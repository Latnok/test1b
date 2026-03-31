import assert from "node:assert/strict";
import test from "node:test";

import { withClient } from "../apps/backend/src/config/db.ts";
import { queueService } from "../apps/backend/src/modules/queue/queue.service.ts";
import { SelectionRepository } from "../apps/backend/src/modules/selection/selection.repository.ts";

const repository = new SelectionRepository();
const testItemIds = [999011, 999012, 999013, 999014, 999015];
const firstOrder = [999015, 999013, 999011, 999014, 999012];
const secondOrder = [999012, 999014, 999011, 999013, 999015];

const readSelectionRows = async () => {
  return withClient(async (client) => {
    const result = await client.query(
      "SELECT item_id, sort_rank FROM selected_items WHERE item_id = ANY($1::bigint[]) ORDER BY sort_rank ASC, item_id ASC",
      [testItemIds]
    );

    return result.rows.map((row: { item_id: string; sort_rank: string }) => ({
      itemId: Number(row.item_id),
      sortRank: Number(row.sort_rank)
    }));
  });
};

test("sync queue preserves sequential reorder requests inside one flush window", async () => {
  await withClient(async (client) => {
    await client.query("BEGIN");

    try {
      await repository.applySelectionOperations(
        client,
        testItemIds.map((itemId) => ({ itemId, selected: false }))
      );
      await repository.applySelectionOperations(
        client,
        testItemIds.map((itemId) => ({ itemId, selected: true }))
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  try {
    const firstPromise = queueService.enqueueReorder(firstOrder);
    const secondPromise = queueService.enqueueReorder(secondOrder);

    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
    const finalRows = await readSelectionRows();

    assert.deepEqual(
      firstResult.orderedIds.filter((itemId) => testItemIds.includes(itemId)),
      firstOrder
    );
    assert.deepEqual(
      secondResult.orderedIds.filter((itemId) => testItemIds.includes(itemId)),
      secondOrder
    );
    assert.deepEqual(
      finalRows.map((row) => row.itemId),
      secondOrder
    );
  } finally {
    await withClient(async (client) => {
      await client.query("DELETE FROM selected_items WHERE item_id = ANY($1::bigint[])", [testItemIds]);
    });
  }
});
