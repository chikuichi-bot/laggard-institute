"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { categoryBasePath, isPhotoOnlyCategory } from "@/lib/category";
import type { ItemCategory } from "@/lib/types";
import type { ViewerSlide } from "@/lib/viewer-slides";

type PhotoViewerProps = {
  slides: ViewerSlide[];
  index: number;
  category: ItemCategory;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export default function PhotoViewer({
  slides,
  index,
  category,
  onClose,
  onIndexChange,
}: PhotoViewerProps) {
  const slide = slides[index];
  const slideCategory = slide.category ?? category;
  const base = categoryBasePath(slideCategory);
  const photoOnly = isPhotoOnlyCategory(slideCategory);

  const goNext = useCallback(() => {
    if (slides.length === 0) return;
    onIndexChange((index + 1) % slides.length);
  }, [index, onIndexChange, slides.length]);

  useEffect(() => {
    document.body.classList.add("photo-viewer-open");
    return () => {
      document.body.classList.remove("photo-viewer-open");
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, onClose]);

  if (!slide) return null;

  return createPortal(
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="写真ビューア">
      <div className="photo-viewer-chrome">
        <button type="button" className="photo-viewer-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
        <p className="photo-viewer-counter">
          {index + 1} / {slides.length}
        </p>
      </div>

      <button
        type="button"
        className="photo-viewer-stage"
        onClick={goNext}
        aria-label="次の写真へ"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.imageSrc} alt={slide.title} />
      </button>

      <footer className="photo-viewer-footer">
        {!photoOnly ? <p className="photo-viewer-title">{slide.title}</p> : null}
        <p className="photo-viewer-hint">タップで次へ</p>
        {!photoOnly ? (
          <Link href={`${base}/${slide.itemId}`} className="photo-viewer-detail" onClick={onClose}>
            詳しく見る
          </Link>
        ) : null}
      </footer>
    </div>,
    document.body,
  );
}
