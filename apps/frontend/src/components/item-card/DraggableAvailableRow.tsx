import type { Item } from "../../types/item";

type DraggableAvailableRowProps = {
  disabled?: boolean;
  isDragging: boolean;
  item: Item;
  onDragEnd: () => void;
  onDragStart: (item: Item) => void;
  onSelect: (item: Item) => void;
};

export const DraggableAvailableRow = ({
  disabled,
  isDragging,
  item,
  onDragEnd,
  onDragStart,
  onSelect
}: DraggableAvailableRowProps) => {
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
