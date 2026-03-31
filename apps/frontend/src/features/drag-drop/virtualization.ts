export const VIRTUAL_ITEM_HEIGHT = 108;
export const VIRTUAL_OVERSCAN = 6;

export const getVirtualRange = (itemCount: number, scrollTop: number, viewportHeight: number) => {
  if (itemCount === 0) {
    return {
      endIndex: 0,
      startIndex: 0
    };
  }

  const safeViewportHeight = viewportHeight > 0 ? viewportHeight : VIRTUAL_ITEM_HEIGHT * 8;
  const visibleCount = Math.ceil(safeViewportHeight / VIRTUAL_ITEM_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ITEM_HEIGHT) - VIRTUAL_OVERSCAN);
  const endIndex = Math.min(itemCount, startIndex + visibleCount + VIRTUAL_OVERSCAN * 2);

  return {
    endIndex,
    startIndex
  };
};
