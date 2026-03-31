import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { RefObject, UIEventHandler } from "react";

import { SortableSelectedRow } from "../../components/item-card";
import { Panel } from "../../components/layout";
import { SearchBar } from "../../components/search-bar";

import { VIRTUAL_ITEM_HEIGHT } from "../drag-drop";

import type { Item, SelectedItem } from "../../types/item";

type RightPanelProps = {
  draggingAvailableItem: Item | null;
  error: string | null;
  hasMore: boolean;
  isDropOver: boolean;
  isLoading: boolean;
  isMutating: boolean;
  listRef: RefObject<HTMLDivElement>;
  onDeselect: (item: SelectedItem) => void;
  onDropOverChange: (value: boolean) => void;
  onScroll: UIEventHandler<HTMLDivElement>;
  onSearchChange: (value: string) => void;
  onSelectDroppedItem: (item: Item) => void;
  searchValue: string;
  selectedItemsView: SelectedItem[];
  setDraggingAvailableItem: (item: Item | null) => void;
  virtualStartIndex: number;
  visibleAvailableItems: Item[];
  visibleSelectedItems: SelectedItem[];
  visibleSelectedItemIds: number[];
  onDragEnd: (event: DragEndEvent) => void;
};

export const RightPanel = ({
  draggingAvailableItem,
  error,
  hasMore,
  isDropOver,
  isLoading,
  isMutating,
  listRef,
  onDeselect,
  onDropOverChange,
  onDragEnd,
  onScroll,
  onSearchChange,
  onSelectDroppedItem,
  searchValue,
  selectedItemsView,
  setDraggingAvailableItem,
  virtualStartIndex,
  visibleAvailableItems,
  visibleSelectedItems,
  visibleSelectedItemIds
}: RightPanelProps) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <Panel description="Выбранные элементы с ручной сортировкой" title="Выбранные элементы">
      <div className="panel-controls panel-controls-single">
        <SearchBar label="Фильтр по ID" onChange={onSearchChange} value={searchValue} />
      </div>

      <div
        className={`list-shell ${isDropOver ? "list-shell-drop-active" : ""}`}
        data-testid="selected-list"
        onDragLeave={() => {
          onDropOverChange(false);
        }}
        onDragOver={(event) => {
          if (!draggingAvailableItem) {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDropOverChange(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const droppedId = Number(event.dataTransfer.getData("text/plain"));
          const droppedItem = visibleAvailableItems.find((item) => item.id === droppedId) ?? draggingAvailableItem;
          setDraggingAvailableItem(null);
          onDropOverChange(false);

          if (droppedItem) {
            onSelectDroppedItem(droppedItem);
          }
        }}
        onScroll={onScroll}
        ref={listRef}
      >
        <div
          className="virtual-list"
          style={{
            height: selectedItemsView.length * VIRTUAL_ITEM_HEIGHT
          }}
        >
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
            <SortableContext items={visibleSelectedItemIds} strategy={verticalListSortingStrategy}>
              {visibleSelectedItems.map((item, index) => (
                <div
                  className="virtual-row"
                  key={item.itemId}
                  style={{
                    top: (virtualStartIndex + index) * VIRTUAL_ITEM_HEIGHT
                  }}
                >
                  <SortableSelectedRow
                    disabled={isMutating}
                    item={item}
                    onRemove={onDeselect}
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        </div>
        {!isLoading && selectedItemsView.length === 0 ? (
          <div className="empty-state">Пока нет выбранных элементов.</div>
        ) : null}
        {error ? <div className="error-state">{error}</div> : null}
        <div className="list-footer">
          {isLoading ? "Загрузка..." : hasMore ? "Прокрутите вниз для подгрузки" : "Конец выбранного списка"}
        </div>
      </div>
    </Panel>
  );
};
