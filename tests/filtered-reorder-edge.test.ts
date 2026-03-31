import assert from "node:assert/strict";
import test from "node:test";

import { withClient } from "../apps/backend/src/config/db.ts";
import { SelectionRepository } from "../apps/backend/src/modules/selection/selection.repository.ts";

const repository = new SelectionRepository();
const allIds = [999101, 999102, 999103, 999104, 999105, 999106];
const subsetIds = [999106, 999104, 999102];

const readRows = async (client: Parameters<typeof withClient>[0] extends (client: infer T) => Promise<unknown> ? T : never) => {
  const result = await client.query(
    "SELECT item_id, sort_rank FROM selected_items WHERE item_id = ANY($1::bigint[]) ORDER BY sort_rank ASC, item_id ASC",
    [allIds]
  );

  return result.rows.map((row: { item_id: string; sort_rank: string }) => ({
    itemId: Number(row.item_id),
    sortRank: Number(row.sort_rank)
  }));
};

test("subset reorder preserves unaffected items in their original slots", async () => {
  await withClient(async (client) => {
    await client.query("BEGIN");

    try {
      await repository.applySelectionOperations(
        client,
        allIds.map((itemId) => ({ itemId, selected: false }))
      );

      await repository.applySelectionOperations(
        client,
        allIds.map((itemId) => ({ itemId, selected: true }))
      );

      const before = await readRows(client);
      const beforeOrder = before.map((row) => row.itemId);
      const beforeRanks = new Map(before.map((row) => [row.itemId, row.sortRank]));

      const result = await repository.reorderSelectedItems(client, subsetIds);
      const after = await readRows(client);
      const afterOrder = after.map((row) => row.itemId);

      assert.deepEqual(beforeOrder, allIds);
      assert.deepEqual(afterOrder, [999101, 999106, 999103, 999104, 999105, 999102]);
      assert.deepEqual(
        after
          .filter((row) => !subsetIds.includes(row.itemId))
          .map((row) => row.itemId),
        [999101, 999103, 999105]
      );
      assert.deepEqual(
        after
          .filter((row) => !subsetIds.includes(row.itemId))
          .map((row) => row.sortRank),
        [beforeRanks.get(999101), beforeRanks.get(999103), beforeRanks.get(999105)]
      );
      assert.deepEqual(
        result.orderedIds.filter((itemId) => allIds.includes(itemId)),
        afterOrder
      );

      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
});
