export type QueueTaskKey = string;

export type QueuedAddResult = {
  created: boolean;
  id: number;
};

export type QueuedSelectionResult = {
  itemId: number;
  selected: boolean;
};

export type QueuedReorderResult = {
  orderedIds: number[];
};

export type QueuedReadKey = string;
