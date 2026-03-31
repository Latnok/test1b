import { request } from "./api";

import type { CursorPage, ReorderSelectionResponse, SetSelectionResponse } from "../types/api";
import type { SelectedItem, SelectionOperation } from "../types/item";

export const selectionService = {
  list: (params: { cursor?: string; id?: string; limit?: number }) => {
    return request<CursorPage<SelectedItem>>("/selected-items", {
      method: "GET",
      query: params
    });
  },
  reorder: (itemIds: number[]) => {
    return request<ReorderSelectionResponse>("/selected-items/reorder", {
      body: JSON.stringify({ itemIds }),
      method: "POST"
    });
  },
  set: (operations: SelectionOperation[]) => {
    return request<SetSelectionResponse>("/selected-items/set", {
      body: JSON.stringify({ operations }),
      method: "POST"
    });
  }
};
