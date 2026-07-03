"use client";

import { useState } from "react";

type SortableImageListProps = {
  images: string[];
  onReorder: (images: string[]) => void;
  onRemove: (url: string) => void;
  disabled?: boolean;
};

function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function SortableImageList({
  images,
  onReorder,
  onRemove,
  disabled = false,
}: SortableImageListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [pointerDrag, setPointerDrag] = useState<{
    index: number;
    pointerId: number;
  } | null>(null);

  function finishReorder(from: number, to: number) {
    if (disabled) return;
    onReorder(reorderList(images, from, to));
  }

  function resetDrag() {
    setDragIndex(null);
    setOverIndex(null);
    setPointerDrag(null);
  }

  return (
    <div className="photo-picker-previews photo-picker-previews--existing sortable-image-list">
      {images.map((url, index) => (
        <div
          key={url}
          data-sort-index={index}
          className={[
            "photo-existing-wrap",
            "sortable-image-item",
            dragIndex === index ? "sortable-image-item--dragging" : "",
            overIndex === index && dragIndex !== index ? "sortable-image-item--over" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          draggable={!disabled}
          onDragStart={(event) => {
            if (disabled) return;
            setDragIndex(index);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (disabled) return;
            setOverIndex(index);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex !== null) finishReorder(dragIndex, index);
            resetDrag();
          }}
          onDragEnd={resetDrag}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setPointerDrag({ index, pointerId: event.pointerId });
            setDragIndex(index);
          }}
          onPointerMove={(event) => {
            if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
            const target = document.elementFromPoint(event.clientX, event.clientY);
            const item = target?.closest("[data-sort-index]");
            if (!item) return;
            const to = Number((item as HTMLElement).dataset.sortIndex);
            if (!Number.isNaN(to)) setOverIndex(to);
          }}
          onPointerUp={(event) => {
            if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
            if (dragIndex !== null && overIndex !== null) {
              finishReorder(dragIndex, overIndex);
            }
            resetDrag();
          }}
          onPointerCancel={resetDrag}
        >
          <span className="sortable-image-index" aria-hidden>
            {index + 1}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} />
          <button
            type="button"
            className="photo-existing-remove"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onRemove(url)}
            disabled={disabled}
            aria-label="写真を削除する"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
