import { decodeCursor, encodeCursor } from "../../utils/cursor.js";
import { queueService } from "../queue/queue.service.js";

import { SelectionRepository } from "./selection.repository.js";
import type {
  ReorderSelectionResult,
  SelectedItemsCursor,
  SelectedItemsListResponse,
  SelectionOperation,
  SetSelectionResult
} from "./selection.types.js";

export class SelectionService {
  constructor(private readonly repository: SelectionRepository) {}

  async listSelectedItems(options: {
    cursor?: string;
    idFilter?: string;
    limit: number;
  }): Promise<SelectedItemsListResponse> {
    const parsedCursor = options.cursor ? decodeCursor<SelectedItemsCursor>(options.cursor) : undefined;
    const rows = await queueService.enqueueSelectedItemsRead({
      cursor: parsedCursor,
      idFilter: options.idFilter,
      limit: options.limit
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor:
        hasMore && lastItem
          ? encodeCursor<SelectedItemsCursor>({
              itemId: lastItem.itemId,
              sortRank: lastItem.sortRank
            })
          : null
    };
  }

  async setSelection(operations: SelectionOperation[]): Promise<SetSelectionResult> {
    const latestOperations = new Map<number, boolean>();

    for (const operation of operations) {
      latestOperations.set(operation.itemId, operation.selected);
    }

    const results = await Promise.all(
      [...latestOperations.entries()].map(([itemId, selected]) => queueService.enqueueSelection(itemId, selected))
    );

    return {
      deselectedIds: results.filter((result) => !result.selected).map((result) => result.itemId),
      selectedIds: results.filter((result) => result.selected).map((result) => result.itemId)
    };
  }

  async reorderSelectedItems(itemIds: number[]): Promise<ReorderSelectionResult> {
    return queueService.enqueueReorder(itemIds);
  }
}

export const selectionService = new SelectionService(new SelectionRepository());
