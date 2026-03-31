export type ItemRecord = {
  id: number;
  title: string;
  imgUrl: string;
};

export type ItemsCursor = {
  id: number;
};

export type ItemsListParams = {
  cursor?: ItemsCursor;
  idFilter?: string;
  limit: number;
};

export type ItemsListResponse = {
  items: ItemRecord[];
  nextCursor: string | null;
};

export type AddItemsResult = {
  createdIds: number[];
  skippedIds: number[];
};
