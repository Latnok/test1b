export const buildItemTitle = (id: number) => {
  return `Item ${id} title ${Math.imul(id, 2654435761) >>> 0}`;
};

export const buildItemImageUrl = (id: number) => {
  return `https://picsum.photos/seed/item-${id}/160/160`;
};
