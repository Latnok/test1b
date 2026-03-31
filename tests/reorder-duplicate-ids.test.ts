import assert from "node:assert/strict";
import test from "node:test";

import { withClient } from "../apps/backend/src/config/db.ts";
import { SelectionRepository } from "../apps/backend/src/modules/selection/selection.repository.ts";

const repository = new SelectionRepository();
const testItemIds = [999041, 999042, 999043, 999044];

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

test("reorder ignores duplicate item ids instead of producing null sort ranks", async () => {
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
    await withClient(async (client) => {
      await client.query("BEGIN");

      try {
        await repository.reorderSelectedItems(client, [999044, 999043, 999043, 999042, 999041]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    const finalRows = await readSelectionRows();

    assert.deepEqual(
      finalRows.map((row) => row.itemId),
      [999044, 999043, 999042, 999041]
    );
    assert.ok(finalRows.every((row) => Number.isInteger(row.sortRank) && row.sortRank > 0));
  } finally {
    await withClient(async (client) => {
      await client.query("DELETE FROM selected_items WHERE item_id = ANY($1::bigint[])", [testItemIds]);
    });
  }
});
