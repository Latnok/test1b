export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AddItemsResponse = {
  createdIds: number[];
  skippedIds: number[];
};

export type SetSelectionResponse = {
  deselectedIds: number[];
  selectedIds: number[];
};

export type ReorderSelectionResponse = {
  orderedIds: number[];
};
