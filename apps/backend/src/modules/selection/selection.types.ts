export type SelectedItemRecord = {
  id: number;
  imgUrl: string;
  itemId: number;
  sortRank: number;
  title: string;
};

export type SelectedItemsCursor = {
  itemId: number;
  sortRank: number;
};

export type SelectedItemsListParams = {
  cursor?: SelectedItemsCursor;
  idFilter?: string;
  limit: number;
};

export type SelectedItemsListResponse = {
  items: SelectedItemRecord[];
  nextCursor: string | null;
};

export type SelectionOperation = {
  itemId: number;
  selected: boolean;
};

export type SetSelectionResult = {
  deselectedIds: number[];
  selectedIds: number[];
};

export type ReorderSelectionResult = {
  orderedIds: number[];
};
