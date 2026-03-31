import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import { LeftPanel } from "./features/left-panel";
import { RightPanel } from "./features/right-panel";
import { getVirtualRange } from "./features/drag-drop";
import { useInfiniteItems } from "./hooks/useInfiniteItems";
import { useInfiniteSelectedItems } from "./hooks/useInfiniteSelectedItems";
import { itemsService } from "./services/items";
import { selectionService } from "./services/selection";

import type { Item, SelectedItem } from "./types/item";

type NoticeTone = "info" | "success" | "error";

type NoticeState = {
  detail: string;
  title: string;
  tone: NoticeTone;
} | null;

const matchesFilter = (id: number, filter: string) => {
  return filter.length === 0 || String(id).startsWith(filter);
};

const App = () => {
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [leftRefreshKey, setLeftRefreshKey] = useState(0);
  const [rightRefreshKey, setRightRefreshKey] = useState(0);
  const [availableItemsView, setAvailableItemsView] = useState<Item[]>([]);
  const [selectedItemsView, setSelectedItemsView] = useState<SelectedItem[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [draggingAvailableItem, setDraggingAvailableItem] = useState<Item | null>(null);
  const [isSelectedDropOver, setIsSelectedDropOver] = useState(false);
  const [leftViewportHeight, setLeftViewportHeight] = useState(0);
  const [leftScrollTop, setLeftScrollTop] = useState(0);
  const [rightViewportHeight, setRightViewportHeight] = useState(0);
  const [rightScrollTop, setRightScrollTop] = useState(0);
  const leftListRef = useRef<HTMLDivElement | null>(null);
  const rightListRef = useRef<HTMLDivElement | null>(null);

  const leftList = useInfiniteItems(leftSearch, leftRefreshKey);
  const rightList = useInfiniteSelectedItems(rightSearch, rightRefreshKey);

  useEffect(() => {
    setAvailableItemsView(leftList.items);
  }, [leftList.items]);

  useEffect(() => {
    setSelectedItemsView(rightList.items);
  }, [rightList.items]);

  const leftVirtualRange = useMemo(
    () => getVirtualRange(availableItemsView.length, leftScrollTop, leftViewportHeight),
    [availableItemsView.length, leftScrollTop, leftViewportHeight]
  );
  const visibleAvailableItems = useMemo(
    () => availableItemsView.slice(leftVirtualRange.startIndex, leftVirtualRange.endIndex),
    [availableItemsView, leftVirtualRange.endIndex, leftVirtualRange.startIndex]
  );
  const rightVirtualRange = useMemo(
    () => getVirtualRange(selectedItemsView.length, rightScrollTop, rightViewportHeight),
    [rightScrollTop, rightViewportHeight, selectedItemsView.length]
  );
  const visibleSelectedItems = useMemo(
    () => selectedItemsView.slice(rightVirtualRange.startIndex, rightVirtualRange.endIndex),
    [rightVirtualRange.endIndex, rightVirtualRange.startIndex, selectedItemsView]
  );
  const visibleSelectedDragIds = useMemo(
    () => visibleSelectedItems.map((item) => item.itemId),
    [visibleSelectedItems]
  );

  useEffect(() => {
    const updateViewports = () => {
      if (!leftListRef.current) {
        return;
      }

      setLeftViewportHeight(leftListRef.current.clientHeight);
      setLeftScrollTop(leftListRef.current.scrollTop);

      if (rightListRef.current) {
        setRightViewportHeight(rightListRef.current.clientHeight);
        setRightScrollTop(rightListRef.current.scrollTop);
      }
    };

    updateViewports();
    window.addEventListener("resize", updateViewports);

    return () => {
      window.removeEventListener("resize", updateViewports);
    };
  }, []);

  useEffect(() => {
    if (leftListRef.current) {
      setLeftViewportHeight(leftListRef.current.clientHeight);
    }
  }, [availableItemsView.length]);

  useEffect(() => {
    if (rightListRef.current) {
      setRightViewportHeight(rightListRef.current.clientHeight);
    }
  }, [selectedItemsView.length]);

  const refreshBothLists = () => {
    setLeftRefreshKey((value) => value + 1);
    setRightRefreshKey((value) => value + 1);
  };

  const withMutation = async (
    action: () => Promise<void>,
    pendingNotice?: NoticeState
  ) => {
    setIsMutating(true);

    if (pendingNotice) {
      setNotice(pendingNotice);
    }

    try {
      await action();
    } catch (error) {
      setNotice({
        detail: error instanceof Error ? error.message : "Попробуйте повторить действие ещё раз.",
        title: "Операция не завершилась",
        tone: "error"
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleAdd = async (value: string) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
      setNotice({
        detail: "Разрешены только положительные числовые ID.",
        title: "Проверьте ID",
        tone: "error"
      });
      return;
    }

    await withMutation(
      async () => {
        const result = await itemsService.add([id]);
        refreshBothLists();

        if (result.createdIds.length > 0) {
          setNotice({
            detail: `Теперь ID ${result.createdIds.join(", ")} можно найти в левом списке.`,
            title: "ID добавлен",
            tone: "success"
          });
          return;
        }

        setNotice({
          detail: `ID ${result.skippedIds.join(", ")} уже был в системе, повторное добавление не потребовалось.`,
          title: "ID уже существует",
          tone: "info"
        });
      },
      {
        detail: `ID ${id} поставлен в очередь на сервере. Батч добавления выполняется раз в 10 секунд.`,
        title: "Ожидаем серверный батч",
        tone: "info"
      }
    );
  };

  const handleSelect = async (item: Item) => {
    const previousAvailableItems = availableItemsView;
    const previousSelectedItems = selectedItemsView;
    const nextSortRank =
      selectedItemsView.length > 0 ? Math.max(...selectedItemsView.map((selectedItem) => selectedItem.sortRank)) + 1 : 1;

    setAvailableItemsView((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
    leftList.setLocalItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));

    if (matchesFilter(item.id, rightSearch)) {
      const appendSelectedItem = (currentItems: SelectedItem[]) => [
        ...currentItems,
        {
          ...item,
          itemId: item.id,
          sortRank: nextSortRank
        }
      ];

      setSelectedItemsView(appendSelectedItem);
      rightList.setLocalItems(appendSelectedItem);
    }

    await withMutation(
      async () => {
        await selectionService.set([{ itemId: item.id, selected: true }]);
        void leftList.syncToCount(previousAvailableItems.length);

        if (rightSearch.length > 0) {
          void rightList.syncToCount(previousSelectedItems.length + 1);
        }

        setNotice({
          detail: `ID ${item.id} добавлен в общий выбранный список.`,
          title: "Выбор сохранён",
          tone: "success"
        });
      },
      {
        detail: `Сохраняем выбор ID ${item.id} на сервере. Изменение будет общим для всех посетителей.`,
        title: "Сохраняем выбор",
        tone: "info"
      }
    ).catch(() => {
      setAvailableItemsView(previousAvailableItems);
      setSelectedItemsView(previousSelectedItems);
      leftList.setLocalItems(() => previousAvailableItems);
      rightList.setLocalItems(() => previousSelectedItems);
    });
  };

  const handleDeselect = async (item: SelectedItem) => {
    const previousAvailableItems = availableItemsView;
    const previousSelectedItems = selectedItemsView;

    setSelectedItemsView((currentItems) => currentItems.filter((currentItem) => currentItem.itemId !== item.itemId));
    rightList.setLocalItems((currentItems) => currentItems.filter((currentItem) => currentItem.itemId !== item.itemId));

    if (matchesFilter(item.id, leftSearch)) {
      const insertAvailableItem = (currentItems: Item[]) => {
        const nextItems = [...currentItems, { id: item.id, imgUrl: item.imgUrl, title: item.title }];
        nextItems.sort((left, right) => left.id - right.id);
        return nextItems;
      };

      setAvailableItemsView(insertAvailableItem);
      leftList.setLocalItems(insertAvailableItem);
    }

    await withMutation(
      async () => {
        await selectionService.set([{ itemId: item.itemId, selected: false }]);
        void leftList.syncToCount(previousAvailableItems.length);
        void rightList.syncToCount(previousSelectedItems.length);
        setNotice({
          detail: `ID ${item.id} убран из общего выбранного списка.`,
          title: "Изменение сохранено",
          tone: "success"
        });
      },
      {
        detail: `Сохраняем удаление ID ${item.id}. Изменение будет общим для всех посетителей.`,
        title: "Обновляем список",
        tone: "info"
      }
    ).catch(() => {
      setAvailableItemsView(previousAvailableItems);
      setSelectedItemsView(previousSelectedItems);
      leftList.setLocalItems(() => previousAvailableItems);
      rightList.setLocalItems(() => previousSelectedItems);
    });
  };

  const handleSelectedDragEnd = async (event: DragEndEvent) => {
    const activeId = Number(event.active.id);
    const overId = Number(event.over?.id);

    if (!overId || activeId === overId) {
      return;
    }

    const oldIndex = visibleSelectedDragIds.indexOf(activeId);
    const newIndex = visibleSelectedDragIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previousItems = selectedItemsView;
    const reorderedVisibleIds = arrayMove(visibleSelectedDragIds, oldIndex, newIndex);
    const reorderedVisibleIdSet = new Set(reorderedVisibleIds);
    const reorderedVisibleItemsById = new Map(
      visibleSelectedItems.map((item) => [item.itemId, item] as const)
    );
    let reorderedVisibleIndex = 0;

    const reorderedItems = selectedItemsView.map((item) => {
      if (!reorderedVisibleIdSet.has(item.itemId)) {
        return item;
      }

      const nextItemId = reorderedVisibleIds[reorderedVisibleIndex];
      reorderedVisibleIndex += 1;

      return reorderedVisibleItemsById.get(nextItemId) ?? item;
    });

    setSelectedItemsView(reorderedItems);
    rightList.setLocalItems(() => reorderedItems);

    await withMutation(
      async () => {
        await selectionService.reorder(reorderedVisibleIds);
        setNotice({
          detail: "Новый порядок сохранён на сервере и восстановится после перезагрузки страницы.",
          title: "Сортировка сохранена",
          tone: "success"
        });
      },
      {
        detail: "Сохраняем новый порядок выбранных элементов на сервере.",
        title: "Обновляем сортировку",
        tone: "info"
      }
    ).catch(() => {
      setSelectedItemsView(previousItems);
      rightList.setLocalItems(() => previousItems);
    });
  };

  const createScrollHandler =
    (
      loadMore: () => Promise<void>,
      hasMore: boolean,
      isLoading: boolean,
      onScrollChange?: (element: HTMLDivElement) => void
    ) =>
    (event: UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;

      onScrollChange?.(element);

      if (!hasMore || isLoading) {
        return;
      }

      const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;

      if (remaining < 160) {
        void loadMore();
      }
    };

  return (
    <main className="app-shell">
      <div className="hero">
        <div>
          <div className="hero-notes">
            <div className="hero-note">
              <strong>Общее состояние для всех</strong>
              <span>Любой выбор, снятие выбора или reorder сразу влияет на общий список всех посетителей.</span>
            </div>
            <div className="hero-note">
              <strong>Добавление работает через очередь</strong>
              <span>Новые ID отправляются в серверный батч. Обновление интерфейса может занимать до 10 секунд.</span>
            </div>
          </div>
        </div>
        {notice ? (
          <div className={`feedback feedback-${notice.tone}`}>
            <strong>{notice.title}</strong>
            <p>{notice.detail}</p>
          </div>
        ) : null}
      </div>

      <section className="board">
        <LeftPanel
          availableItemsView={availableItemsView}
          draggingAvailableItemId={draggingAvailableItem?.id ?? null}
          error={leftList.error}
          hasMore={leftList.hasMore}
          isLoading={leftList.isLoading}
          isMutating={isMutating}
          listRef={leftListRef}
          onAdd={handleAdd}
          onAvailableDragEnd={() => {
            setDraggingAvailableItem(null);
          }}
          onAvailableDragStart={(draggedItem) => {
            setDraggingAvailableItem(draggedItem);
          }}
          onScroll={createScrollHandler(leftList.loadMore, leftList.hasMore, leftList.isLoading, (element) => {
            setLeftScrollTop(element.scrollTop);
            setLeftViewportHeight(element.clientHeight);
          })}
          onSearchChange={setLeftSearch}
          onSelect={handleSelect}
          searchValue={leftSearch}
          virtualStartIndex={leftVirtualRange.startIndex}
          visibleAvailableItems={visibleAvailableItems}
        />

        <RightPanel
          draggingAvailableItem={draggingAvailableItem}
          error={rightList.error}
          hasMore={rightList.hasMore}
          isDropOver={isSelectedDropOver}
          isLoading={rightList.isLoading}
          isMutating={isMutating}
          listRef={rightListRef}
          onDeselect={handleDeselect}
          onDragEnd={(dragEvent) => {
            void handleSelectedDragEnd(dragEvent);
          }}
          onDropOverChange={setIsSelectedDropOver}
          onScroll={createScrollHandler(rightList.loadMore, rightList.hasMore, rightList.isLoading, (element) => {
            setRightScrollTop(element.scrollTop);
            setRightViewportHeight(element.clientHeight);
          })}
          onSearchChange={setRightSearch}
          onSelectDroppedItem={(item) => {
            void handleSelect(item);
          }}
          searchValue={rightSearch}
          selectedItemsView={selectedItemsView}
          setDraggingAvailableItem={setDraggingAvailableItem}
          virtualStartIndex={rightVirtualRange.startIndex}
          visibleAvailableItems={visibleAvailableItems}
          visibleSelectedItemIds={visibleSelectedDragIds}
          visibleSelectedItems={visibleSelectedItems}
        />
      </section>
    </main>
  );
};

export default App;
