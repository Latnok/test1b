export type Item = {
  id: number;
  imgUrl: string;
  title: string;
};

export type SelectedItem = Item & {
  itemId: number;
  sortRank: number;
};

export type SelectionOperation = {
  itemId: number;
  selected: boolean;
};
