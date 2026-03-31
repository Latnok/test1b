import type { PoolClient } from "pg";

import { query } from "../../config/db.js";

import type {
  ReorderSelectionResult,
  SelectedItemsListParams,
  SelectionOperation,
  SetSelectionResult
} from "./selection.types.js";

type SelectedItemRow = {
  id: string;
  img_url: string;
  item_id: string;
  sort_rank: string;
  title: string;
};

export class SelectionRepository {
  async listSelectedItems(params: SelectedItemsListParams) {
    const sqlParams: unknown[] = [];
    const whereClauses = ["TRUE"];

    if (params.cursor) {
      sqlParams.push(params.cursor.sortRank, params.cursor.itemId);
      whereClauses.push(`(selected_items.sort_rank, selected_items.item_id) > ($${sqlParams.length - 1}, $${sqlParams.length})`);
    }

    if (params.idFilter) {
      sqlParams.push(`${params.idFilter}%`);
      whereClauses.push(`items.id::text LIKE $${sqlParams.length}`);
    }

    sqlParams.push(params.limit + 1);

    const result = await query<SelectedItemRow>(
      `
        SELECT
          items.id,
          items.title,
          items.img_url,
          selected_items.item_id,
          selected_items.sort_rank
        FROM selected_items
        INNER JOIN items ON items.id = selected_items.item_id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY selected_items.sort_rank ASC, selected_items.item_id ASC
        LIMIT $${sqlParams.length}
      `,
      sqlParams
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      imgUrl: row.img_url,
      itemId: Number(row.item_id),
      sortRank: Number(row.sort_rank),
      title: row.title
    }));
  }

  async applySelectionOperations(
    client: PoolClient,
    operations: SelectionOperation[]
  ): Promise<SetSelectionResult> {
    const selectedOperations = operations.filter((operation) => operation.selected);
    const deselectedOperations = operations.filter((operation) => !operation.selected);
    const deselectedIds = deselectedOperations.map((operation) => operation.itemId);

    if (deselectedIds.length > 0) {
      await client.query("DELETE FROM selected_items WHERE item_id = ANY($1::bigint[])", [deselectedIds]);
    }

    const selectedIds = selectedOperations.map((operation) => operation.itemId);
    let insertedIds: number[] = [];

    if (selectedIds.length > 0) {
      const existingResult = await client.query<{ item_id: string }>(
        "SELECT item_id FROM selected_items WHERE item_id = ANY($1::bigint[])",
        [selectedIds]
      );
      const existingIds = new Set(existingResult.rows.map((row) => Number(row.item_id)));
      const missingIds = selectedIds.filter((itemId) => !existingIds.has(itemId));

      if (missingIds.length > 0) {
        const maxSortRankResult = await client.query<{ max_sort_rank: string | null }>(
          "SELECT MAX(sort_rank) AS max_sort_rank FROM selected_items"
        );
        let nextSortRank = Number(maxSortRankResult.rows[0]?.max_sort_rank ?? 0);
        const sortRanks = missingIds.map(() => {
          nextSortRank += 1;
          return nextSortRank;
        });

        const insertResult = await client.query<{ item_id: string }>(
          `
            INSERT INTO selected_items (item_id, sort_rank)
            SELECT *
            FROM UNNEST($1::bigint[], $2::bigint[])
            ON CONFLICT (item_id) DO NOTHING
            RETURNING item_id
          `,
          [missingIds, sortRanks]
        );

        insertedIds = insertResult.rows.map((row) => Number(row.item_id));
      }
    }

    return {
      deselectedIds,
      selectedIds: insertedIds
    };
  }

  async reorderSelectedItems(
    client: PoolClient,
    itemIds: number[]
  ): Promise<ReorderSelectionResult> {
    if (itemIds.length === 0) {
      return { orderedIds: [] };
    }

    const currentOrderResult = await client.query<{ item_id: string; sort_rank: string }>(
      "SELECT item_id, sort_rank FROM selected_items ORDER BY sort_rank ASC, item_id ASC FOR UPDATE"
    );
    const currentRows = currentOrderResult.rows.map((row) => ({
      itemId: Number(row.item_id),
      sortRank: Number(row.sort_rank)
    }));
    const currentOrder = currentRows.map((row) => row.itemId);
    const currentOrderSet = new Set(currentOrder);
    const seenItemIds = new Set<number>();
    const filteredItemIds = itemIds.filter((itemId) => {
      if (!currentOrderSet.has(itemId) || seenItemIds.has(itemId)) {
        return false;
      }

      seenItemIds.add(itemId);
      return true;
    });

    if (filteredItemIds.length === 0) {
      return { orderedIds: [] };
    }

    const subsetSet = new Set(filteredItemIds);
    const subsetPositions: number[] = [];

    currentOrder.forEach((itemId, index) => {
      if (subsetSet.has(itemId)) {
        subsetPositions.push(index);
      }
    });

    const reordered = [...currentOrder];
    subsetPositions.forEach((position, index) => {
      reordered[position] = filteredItemIds[index];
    });

    const originalRanksByItemId = new Map(currentRows.map((row) => [row.itemId, row.sortRank]));
    const touchedRanks = subsetPositions.map((position) => currentRows[position].sortRank);
    const rankUpdates = filteredItemIds.map((itemId, index) => ({
      itemId,
      sortRank: touchedRanks[index]
    }));

    if (rankUpdates.length > 0) {
      const affectedItemIds = rankUpdates.map((update) => update.itemId);
      const temporaryRanks = affectedItemIds.map((itemId) => -Math.abs(originalRanksByItemId.get(itemId) ?? 0));
      const targetRanks = rankUpdates.map((update) => update.sortRank);

      await client.query(
        `
          UPDATE selected_items AS selected
          SET
            sort_rank = temporary.ranked_sort,
            updated_at = NOW()
          FROM (
            SELECT *
            FROM UNNEST($1::bigint[], $2::bigint[])
              AS staged(item_id, ranked_sort)
          ) AS temporary
          WHERE selected.item_id = temporary.item_id
        `,
        [affectedItemIds, temporaryRanks]
      );

      await client.query(
        `
          UPDATE selected_items AS selected
          SET
            sort_rank = target.ranked_sort,
            updated_at = NOW()
          FROM (
            SELECT *
            FROM UNNEST($1::bigint[], $2::bigint[])
              AS staged(item_id, ranked_sort)
          ) AS target
          WHERE selected.item_id = target.item_id
        `,
        [affectedItemIds, targetRanks]
      );
    }

    return {
      orderedIds: reordered
    };
  }
}
