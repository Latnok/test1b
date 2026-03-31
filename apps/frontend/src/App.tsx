import { useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useInfiniteItems } from "./hooks/useInfiniteItems";
import { useInfiniteSelectedItems } from "./hooks/useInfiniteSelectedItems";
import { itemsService } from "./services/items";
import { selectionService } from "./services/selection";

import type { Item, SelectedItem } from "./types/item";

const VIRTUAL_ITEM_HEIGHT = 108;
const VIRTUAL_OVERSCAN = 6;

const SearchBar = ({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        placeholder="Например, 123"
        value={value}
      />
    </label>
  );
};

const AddItemForm = ({
  busy,
  onSubmit
}: {
  busy: boolean;
  onSubmit: (value: string) => Promise<void>;
}) => {
  const [value, setValue] = useState("");

  return (
    <form
      className="add-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(value);
        setValue("");
      }}
    >
      <label className="field">
        <span>Добавить ID</span>
        <input
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
          placeholder="Новый ID"
          value={value}
        />
      </label>
      <button className="primary-button" disabled={busy || !value} type="submit">
        {busy ? "Добавление..." : "Добавить"}
      </button>
    </form>
  );
};

const DraggableAvailableRow = ({
  disabled,
  isDragging,
  item,
  onDragStart,
  onDragEnd,
  onSelect
}: {
  disabled?: boolean;
  isDragging: boolean;
  item: Item;
  onDragEnd: () => void;
  onDragStart: (item: Item) => void;
  onSelect: (item: Item) => void;
}) => {
  return (
    <article
      className={`item-card item-card-draggable ${isDragging ? "item-card-dragging" : ""}`}
      draggable={!disabled}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(item.id));
        onDragStart(item);
      }}
    >
      <button
        aria-label={`Перетащить элемент ${item.id} в выбранные`}
        className="drag-handle"
        disabled={disabled}
        type="button"
      >
        ::
      </button>
      <img alt={item.title} className="item-image" loading="lazy" src={item.imgUrl} />
      <div className="item-copy">
        <strong>{item.title}</strong>
        <span>ID: {item.id}</span>
      </div>
      <button className="secondary-button" disabled={disabled} onClick={() => onSelect(item)} type="button">
        Выбрать
      </button>
    </article>
  );
};

const SortableSelectedRow = ({
  disabled,
  item,
  onRemove
}: {
  disabled?: boolean;
  item: SelectedItem;
  onRemove: (item: SelectedItem) => void;
}) => {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled,
    id: item.itemId
  });

  return (
    <article
      className={`item-card item-card-sortable ${isDragging ? "item-card-dragging" : ""}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      {...attributes}
      {...listeners}
    >
      <button
        aria-label={`Переместить элемент ${item.itemId}`}
        className="drag-handle"
        disabled={disabled}
        type="button"
      >
        ::
      </button>
      <img alt={item.title} className="item-image" loading="lazy" src={item.imgUrl} />
      <div className="item-copy">
        <strong>{item.title}</strong>
        <span>ID: {item.id}</span>
      </div>
      <button
        className="secondary-button"
        disabled={disabled}
        onClick={() => onRemove(item)}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        type="button"
      >
        Убрать
      </button>
    </article>
  );
};

const Panel = ({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) => {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
};

const matchesFilter = (id: number, filter: string) => {
  return filter.length === 0 || String(id).startsWith(filter);
};

const getVirtualRange = (itemCount: number, scrollTop: number, viewportHeight: number) => {
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

const App = () => {
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [leftRefreshKey, setLeftRefreshKey] = useState(0);
  const [rightRefreshKey, setRightRefreshKey] = useState(0);
  const [availableItemsView, setAvailableItemsView] = useState<Item[]>([]);
  const [selectedItemsView, setSelectedItemsView] = useState<SelectedItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [draggingAvailableItem, setDraggingAvailableItem] = useState<Item | null>(null);
  const [isSelectedDropOver, setIsSelectedDropOver] = useState(false);
  const [leftViewportHeight, setLeftViewportHeight] = useState(0);
  const [leftScrollTop, setLeftScrollTop] = useState(0);
  const [rightViewportHeight, setRightViewportHeight] = useState(0);
  const [rightScrollTop, setRightScrollTop] = useState(0);
  const leftListRef = useRef<HTMLDivElement | null>(null);
  const rightListRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const leftList = useInfiniteItems(leftSearch, leftRefreshKey);
  const rightList = useInfiniteSelectedItems(rightSearch, rightRefreshKey);

  useEffect(() => {
    setAvailableItemsView(leftList.items);
  }, [leftList.items]);

  useEffect(() => {
    setSelectedItemsView(rightList.items);
  }, [rightList.items]);

  const visibleSelectedIds = useMemo(
    () => selectedItemsView.map((item) => item.itemId),
    [selectedItemsView]
  );
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
    if (!leftListRef.current) {
      return;
    }

    setLeftViewportHeight(leftListRef.current.clientHeight);
  }, [availableItemsView.length]);

  useEffect(() => {
    if (!rightListRef.current) {
      return;
    }

    setRightViewportHeight(rightListRef.current.clientHeight);
  }, [selectedItemsView.length]);

  const refreshBothLists = () => {
    setLeftRefreshKey((value) => value + 1);
    setRightRefreshKey((value) => value + 1);
  };

  const withMutation = async (action: () => Promise<void>) => {
    setIsMutating(true);
    setFeedback(null);

    try {
      await action();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Что-то пошло не так");
    } finally {
      setIsMutating(false);
    }
  };

  const handleAdd = async (value: string) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
      setFeedback("Введите положительный ID");
      return;
    }

    await withMutation(async () => {
      const result = await itemsService.add([id]);
      refreshBothLists();

      if (result.createdIds.length > 0) {
        setFeedback(`Добавлен ID ${result.createdIds.join(", ")}`);
        return;
      }

      setFeedback(`ID ${result.skippedIds.join(", ")} уже существует`);
    });
  };

  const handleSelect = async (item: Item) => {
    const previousAvailableItems = availableItemsView;
    const previousSelectedItems = selectedItemsView;
    const nextSortRank =
      selectedItemsView.length > 0 ? Math.max(...selectedItemsView.map((selectedItem) => selectedItem.sortRank)) + 1 : 1;

    setAvailableItemsView((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));

    if (matchesFilter(item.id, rightSearch)) {
      setSelectedItemsView((currentItems) => [
        ...currentItems,
        {
          ...item,
          itemId: item.id,
          sortRank: nextSortRank
        }
      ]);
    }

    setFeedback(null);
    setIsMutating(true);

    try {
      await selectionService.set([{ itemId: item.id, selected: true }]);
      void leftList.syncToCount(previousAvailableItems.length);

      if (rightSearch.length > 0) {
        void rightList.syncToCount(previousSelectedItems.length + 1);
      }
    } catch (error) {
      setAvailableItemsView(previousAvailableItems);
      setSelectedItemsView(previousSelectedItems);
      setFeedback(error instanceof Error ? error.message : "Не удалось выбрать элемент");
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeselect = async (item: SelectedItem) => {
    const previousAvailableItems = availableItemsView;
    const previousSelectedItems = selectedItemsView;

    setSelectedItemsView((currentItems) => currentItems.filter((currentItem) => currentItem.itemId !== item.itemId));

    if (matchesFilter(item.id, leftSearch)) {
      setAvailableItemsView((currentItems) => {
        const nextItems = [...currentItems, { id: item.id, imgUrl: item.imgUrl, title: item.title }];
        nextItems.sort((left, right) => left.id - right.id);
        return nextItems;
      });
    }

    setFeedback(null);
    setIsMutating(true);

    try {
      await selectionService.set([{ itemId: item.itemId, selected: false }]);
      void leftList.syncToCount(previousAvailableItems.length);
      void rightList.syncToCount(previousSelectedItems.length);
    } catch (error) {
      setAvailableItemsView(previousAvailableItems);
      setSelectedItemsView(previousSelectedItems);
      setFeedback(error instanceof Error ? error.message : "Не удалось снять выбор");
    } finally {
      setIsMutating(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeId = Number(event.active.id);
    const overId = Number(event.over?.id);

    if (!overId || activeId === overId) {
      return;
    }

    const oldIndex = visibleSelectedIds.indexOf(activeId);
    const newIndex = visibleSelectedIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previousItems = selectedItemsView;
    const reorderedItems = arrayMove(selectedItemsView, oldIndex, newIndex);
    const reorderedIds = reorderedItems.map((item) => item.itemId);

    setSelectedItemsView(reorderedItems);
    setFeedback(null);

    try {
      await selectionService.reorder(reorderedIds);
    } catch (error) {
      setSelectedItemsView(previousItems);
      setFeedback(error instanceof Error ? error.message : "Не удалось сохранить сортировку");
    }
  };

  const handleScroll =
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
          <p className="eyebrow">Million Items Selector</p>
          <h1>Управление миллионом элементов без перегрузки интерфейса</h1>
          <p className="hero-copy">
            Левый контейнер показывает все невыбранные элементы, правый хранит глобальный выбранный порядок.
            Поиск не сохраняется, а выбор и сортировка сохраняются на сервере.
          </p>
        </div>
        {feedback ? <div className="feedback">{feedback}</div> : null}
      </div>

      <section className="board">
        <Panel description="Все элементы, которых нет в выбранном списке" title="Доступные элементы">
          <div className="panel-controls">
            <SearchBar label="Фильтр по ID" onChange={setLeftSearch} value={leftSearch} />
            <AddItemForm busy={isMutating} onSubmit={handleAdd} />
          </div>

          <div
            className="list-shell"
            data-testid="available-list"
            onScroll={handleScroll(leftList.loadMore, leftList.hasMore, leftList.isLoading, (element) => {
              setLeftScrollTop(element.scrollTop);
              setLeftViewportHeight(element.clientHeight);
            })}
            ref={leftListRef}
          >
            <div
              className="virtual-list"
              style={{
                height: availableItemsView.length * VIRTUAL_ITEM_HEIGHT
              }}
            >
              {visibleAvailableItems.map((item, index) => (
                <div
                  className="virtual-row"
                  key={item.id}
                  style={{
                    top: (leftVirtualRange.startIndex + index) * VIRTUAL_ITEM_HEIGHT
                  }}
                >
                  <DraggableAvailableRow
                    disabled={isMutating}
                    isDragging={draggingAvailableItem?.id === item.id}
                    item={item}
                    onDragEnd={() => {
                      setDraggingAvailableItem(null);
                    }}
                    onDragStart={(draggedItem) => {
                      setDraggingAvailableItem(draggedItem);
                    }}
                    onSelect={handleSelect}
                  />
                </div>
              ))}
            </div>
            {!leftList.isLoading && availableItemsView.length === 0 ? (
              <div className="empty-state">Ничего не найдено по текущему фильтру.</div>
            ) : null}
            {leftList.error ? <div className="error-state">{leftList.error}</div> : null}
            <div className="list-footer">
              {leftList.isLoading ? "Загрузка..." : leftList.hasMore ? "Прокрутите вниз для подгрузки" : "Конец списка"}
            </div>
          </div>
        </Panel>

        <Panel description="Выбранные элементы с ручной сортировкой" title="Выбранные элементы">
          <div className="panel-controls panel-controls-single">
            <SearchBar label="Фильтр по ID" onChange={setRightSearch} value={rightSearch} />
          </div>

          <div
            className={`list-shell ${isSelectedDropOver ? "list-shell-drop-active" : ""}`}
            data-testid="selected-list"
            onDragLeave={() => {
              setIsSelectedDropOver(false);
            }}
            onDragOver={(event) => {
              if (!draggingAvailableItem) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setIsSelectedDropOver(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const droppedId = Number(event.dataTransfer.getData("text/plain"));
              const droppedItem = availableItemsView.find((item) => item.id === droppedId) ?? draggingAvailableItem;
              setDraggingAvailableItem(null);
              setIsSelectedDropOver(false);

              if (droppedItem) {
                void handleSelect(droppedItem);
              }
            }}
            onScroll={handleScroll(rightList.loadMore, rightList.hasMore, rightList.isLoading, (element) => {
              setRightScrollTop(element.scrollTop);
              setRightViewportHeight(element.clientHeight);
            })}
            ref={rightListRef}
          >
            <div
              className="virtual-list"
              style={{
                height: selectedItemsView.length * VIRTUAL_ITEM_HEIGHT
              }}
            >
              <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)} sensors={sensors}>
                <SortableContext items={visibleSelectedDragIds} strategy={verticalListSortingStrategy}>
                  {visibleSelectedItems.map((item, index) => (
                    <div
                      className="virtual-row"
                      key={item.itemId}
                      style={{
                        top: (rightVirtualRange.startIndex + index) * VIRTUAL_ITEM_HEIGHT
                      }}
                    >
                      <SortableSelectedRow
                        disabled={isMutating}
                        item={item}
                        onRemove={handleDeselect}
                      />
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            {!rightList.isLoading && selectedItemsView.length === 0 ? (
              <div className="empty-state">Пока нет выбранных элементов.</div>
            ) : null}
            {rightList.error ? <div className="error-state">{rightList.error}</div> : null}
            <div className="list-footer">
              {rightList.isLoading
                ? "Загрузка..."
                : rightList.hasMore
                  ? "Прокрутите вниз для подгрузки"
                  : "Конец выбранного списка"}
            </div>
          </div>
        </Panel>
      </section>
    </main>
  );
};

export default App;
