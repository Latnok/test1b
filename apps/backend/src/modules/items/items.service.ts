import { decodeCursor, encodeCursor } from "../../utils/cursor.js";
import { queueService } from "../queue/queue.service.js";

import { ItemsRepository } from "./items.repository.js";
import type { AddItemsResult, ItemsCursor, ItemsListResponse } from "./items.types.js";

export class ItemsService {
  constructor(private readonly repository: ItemsRepository) {}

  async listAvailableItems(options: {
    cursor?: string;
    idFilter?: string;
    limit: number;
  }): Promise<ItemsListResponse> {
    const parsedCursor = options.cursor ? decodeCursor<ItemsCursor>(options.cursor) : undefined;
    const rows = await queueService.enqueueAvailableItemsRead({
      cursor: parsedCursor,
      idFilter: options.idFilter,
      limit: options.limit
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor: hasMore && lastItem ? encodeCursor<ItemsCursor>({ id: lastItem.id }) : null
    };
  }

  async addItems(ids: number[]): Promise<AddItemsResult> {
    const uniqueSortedIds = [...new Set(ids)].sort((left, right) => left - right);
    const results = await Promise.all(uniqueSortedIds.map((id) => queueService.enqueueAdd(id)));

    return {
      createdIds: results.filter((result) => result.created).map((result) => result.id),
      skippedIds: results.filter((result) => !result.created).map((result) => result.id)
    };
  }
}

export const itemsService = new ItemsService(new ItemsRepository());
