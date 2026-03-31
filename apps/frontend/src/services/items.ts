import { request } from "./api";

import type { AddItemsResponse, CursorPage } from "../types/api";
import type { Item } from "../types/item";

export const itemsService = {
  add: (ids: number[]) => {
    return request<AddItemsResponse>("/items/add", {
      body: JSON.stringify({ ids }),
      method: "POST"
    });
  },
  list: (params: { cursor?: string; id?: string; limit?: number }) => {
    return request<CursorPage<Item>>("/items", {
      method: "GET",
      query: params
    });
  }
};
