import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { SelectedItem } from "../../types/item";

type SortableSelectedRowProps = {
  disabled?: boolean;
  item: SelectedItem;
  onRemove: (item: SelectedItem) => void;
};

export const SortableSelectedRow = ({ disabled, item, onRemove }: SortableSelectedRowProps) => {
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
