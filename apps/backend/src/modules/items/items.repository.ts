import { query } from "../../config/db.js";
import { buildItemImageUrl, buildItemTitle } from "../../utils/item-factory.js";

import type { AddItemsResult, ItemsListParams } from "./items.types.js";

type ItemRow = {
  id: string;
  img_url: string;
  title: string;
};

export class ItemsRepository {
  async listAvailableItems(params: ItemsListParams) {
    const sqlParams: unknown[] = [];
    const whereClauses = [
      "NOT EXISTS (SELECT 1 FROM selected_items selected WHERE selected.item_id = items.id)"
    ];

    if (params.cursor) {
      sqlParams.push(params.cursor.id);
      whereClauses.push(`items.id > $${sqlParams.length}`);
    }

    if (params.idFilter) {
      sqlParams.push(`${params.idFilter}%`);
      whereClauses.push(`items.id::text LIKE $${sqlParams.length}`);
    }

    sqlParams.push(params.limit + 1);

    const result = await query<ItemRow>(
      `
        SELECT items.id, items.title, items.img_url
        FROM items
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY items.id ASC
        LIMIT $${sqlParams.length}
      `,
      sqlParams
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      imgUrl: row.img_url,
      title: row.title
    }));
  }

  async addItems(ids: number[]): Promise<AddItemsResult> {
    if (ids.length === 0) {
      return {
        createdIds: [],
        skippedIds: []
      };
    }

    const titles = ids.map((id) => buildItemTitle(id));
    const imageUrls = ids.map((id) => buildItemImageUrl(id));
    const result = await query<{ id: string }>(
      `
        INSERT INTO items (id, title, img_url)
        SELECT *
        FROM UNNEST($1::bigint[], $2::text[], $3::text[])
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `,
      [ids, titles, imageUrls]
    );

    const createdIds = result.rows.map((row) => Number(row.id));
    const createdSet = new Set(createdIds);

    return {
      createdIds,
      skippedIds: ids.filter((id) => !createdSet.has(id))
    };
  }
}
