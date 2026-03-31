import type { RefObject, UIEventHandler } from "react";

import { AddItemForm } from "../../components/add-item-form";
import { DraggableAvailableRow } from "../../components/item-card";
import { Panel } from "../../components/layout";
import { SearchBar } from "../../components/search-bar";

import { VIRTUAL_ITEM_HEIGHT } from "../drag-drop";

import type { Item } from "../../types/item";

type LeftPanelProps = {
  availableItemsView: Item[];
  draggingAvailableItemId: number | null;
  error: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isMutating: boolean;
  listRef: RefObject<HTMLDivElement>;
  onAdd: (value: string) => Promise<void>;
  onAvailableDragEnd: () => void;
  onAvailableDragStart: (item: Item) => void;
  onScroll: UIEventHandler<HTMLDivElement>;
  onSearchChange: (value: string) => void;
  onSelect: (item: Item) => void;
  searchValue: string;
  virtualStartIndex: number;
  visibleAvailableItems: Item[];
};

export const LeftPanel = ({
  availableItemsView,
  draggingAvailableItemId,
  error,
  hasMore,
  isLoading,
  isMutating,
  listRef,
  onAdd,
  onAvailableDragEnd,
  onAvailableDragStart,
  onScroll,
  onSearchChange,
  onSelect,
  searchValue,
  virtualStartIndex,
  visibleAvailableItems
}: LeftPanelProps) => {
  return (
    <Panel description="Все элементы, которых нет в выбранном списке" title="Доступные элементы">
      <div className="panel-controls">
        <SearchBar label="Фильтр по ID" onChange={onSearchChange} value={searchValue} />
        <AddItemForm busy={isMutating} onSubmit={onAdd} />
      </div>

      <div className="list-shell" data-testid="available-list" onScroll={onScroll} ref={listRef}>
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
                top: (virtualStartIndex + index) * VIRTUAL_ITEM_HEIGHT
              }}
            >
              <DraggableAvailableRow
                disabled={isMutating}
                isDragging={draggingAvailableItemId === item.id}
                item={item}
                onDragEnd={onAvailableDragEnd}
                onDragStart={onAvailableDragStart}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
        {!isLoading && availableItemsView.length === 0 ? (
          <div className="empty-state">Ничего не найдено по текущему фильтру.</div>
        ) : null}
        {error ? <div className="error-state">{error}</div> : null}
        <div className="list-footer">
          {isLoading ? "Загрузка..." : hasMore ? "Прокрутите вниз для подгрузки" : "Конец списка"}
        </div>
      </div>
    </Panel>
  );
};
