"use client";

import { useMemo, useState } from "react";
import PhotoViewer from "@/components/PhotoViewer";
import type { CatalogItem, ItemCategory } from "@/lib/types";
import { buildViewerSlides, slideIndexForItem } from "@/lib/viewer-slides";

type DetailPhotoViewerProps = {
  category: ItemCategory;
  item: CatalogItem;
  items: CatalogItem[];
};

function itemOnlySlides(item: CatalogItem, category: ItemCategory) {
  return item.images.map((imageSrc, imageIndex) => ({
    itemId: item.id,
    imageSrc,
    title: item.title,
    imageIndex,
    category,
  }));
}

export default function DetailPhotoViewer({ category, item, items }: DetailPhotoViewerProps) {
  const catalogSlides = useMemo(() => buildViewerSlides(items), [items]);
  const antiqueSlides = useMemo(() => itemOnlySlides(item, category), [item, category]);
  const slides = category === "antiques" ? antiqueSlides : catalogSlides;

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  function openAt(imageIndex: number) {
    if (category === "antiques") {
      setViewerIndex(imageIndex);
      return;
    }
    setViewerIndex(slideIndexForItem(catalogSlides, item.id, imageIndex));
  }

  if (item.images.length === 0) {
    return (
      <div className="detail-antique-photo-list">
        <div className="item-placeholder item-placeholder--hero" aria-hidden>
          <span>写真なし</span>
        </div>
      </div>
    );
  }

  if (category === "antiques") {
    return (
      <>
        <div className="detail-antique-photo-list" aria-label="写真">
          {item.images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              className="detail-antique-photo-item"
              onClick={() => openAt(index)}
              aria-label={`写真 ${index + 1} を大きく見る`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${item.title} ${index + 1}`} />
            </button>
          ))}
        </div>

        {viewerIndex !== null ? (
          <PhotoViewer
            slides={slides}
            index={viewerIndex}
            category={category}
            onClose={() => setViewerIndex(null)}
            onIndexChange={setViewerIndex}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="detail-antique-photo-list" aria-label="写真">
        {item.images.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            className="detail-antique-photo-item"
            onClick={() => openAt(index)}
            aria-label={`写真 ${index + 1} を大きく見る`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${item.title} ${index + 1}`} />
          </button>
        ))}
      </div>

      {viewerIndex !== null ? (
        <PhotoViewer
          slides={slides}
          index={viewerIndex}
          category={category}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </>
  );
}
