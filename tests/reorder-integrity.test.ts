import assert from "node:assert/strict";
import test from "node:test";

import { withClient } from "../apps/backend/src/config/db.ts";
import { SelectionRepository } from "../apps/backend/src/modules/selection/selection.repository.ts";

const repository = new SelectionRepository();
const testItemIds = [999001, 999002, 999003, 999004, 999005];
const reorderedSubset = [999005, 999003, 999001, 999004, 999002];

const readSelectionRows = async (client: Parameters<typeof withClient>[0] extends (client: infer T) => Promise<unknown> ? T : never) => {
  const result = await client.query(
    "SELECT item_id, sort_rank FROM selected_items WHERE item_id = ANY($1::bigint[]) ORDER BY sort_rank ASC, item_id ASC",
    [testItemIds]
  );

  return result.rows.map((row: { item_id: string; sort_rank: string }) => ({
    itemId: Number(row.item_id),
    sortRank: Number(row.sort_rank)
  }));
};

test("reorder keeps the same rank slots and preserves the affected subset", async () => {
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

      const before = await readSelectionRows(client);
      const totalBeforeReorder = Number((await client.query("SELECT COUNT(*)::int AS count FROM selected_items")).rows[0].count);
      const expectedRanks = before.map((row) => row.sortRank).sort((left, right) => left - right);

      const reorderResult = await repository.reorderSelectedItems(client, reorderedSubset);
      const after = await readSelectionRows(client);
      const totalAfterReorder = Number((await client.query("SELECT COUNT(*)::int AS count FROM selected_items")).rows[0].count);

      assert.equal(before.length, testItemIds.length);
      assert.equal(after.length, testItemIds.length);
      assert.equal(totalBeforeReorder, totalAfterReorder);
      assert.deepEqual(
        after.map((row) => row.itemId),
        reorderedSubset
      );
      assert.deepEqual(
        after.map((row) => row.sortRank).sort((left, right) => left - right),
        expectedRanks
      );
      assert.deepEqual(
        reorderResult.orderedIds.filter((itemId) => testItemIds.includes(itemId)),
        reorderedSubset
      );

      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
});
