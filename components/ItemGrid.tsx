"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PhotoViewer from "@/components/PhotoViewer";
import { assetUrl } from "@/lib/asset-path";
import {
  catalogDisplayTitle,
  categoryBasePath,
  categoryLabel,
  isPhotoOnlyCategory,
} from "@/lib/category";
import type { CatalogItem, ItemCategory } from "@/lib/types";
import { buildViewerSlides, slideIndexForItem } from "@/lib/viewer-slides";

type ItemGridProps = {
  category: ItemCategory;
  items: CatalogItem[];
  compact?: boolean;
  /** 古道具一覧ページのみ：写真の下に品名・価格 */
  showAntiqueLabels?: boolean;
};

export default function ItemGrid({
  category,
  items,
  compact = false,
  showAntiqueLabels = false,
}: ItemGridProps) {
  const photoOnly = isPhotoOnlyCategory(category);
  const base = categoryBasePath(category);
  const visibleItems = photoOnly ? items.filter((item) => item.images[0]) : items;
  const slides = useMemo(() => buildViewerSlides(visibleItems), [visibleItems]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (visibleItems.length === 0) {
    return (
      <div className="horizontal-body empty-catalog">
        <p>まだ記録がありません。</p>
        <p className="empty-hint">
          iPhone で撮影したものは
          <Link href="/admin"> 作業ページ </Link>
          から送れます。
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={`item-grid${compact ? " item-grid--compact" : ""}${category === "antiques" ? " item-grid--antiques" : ""}`}
      >
        {visibleItems.map((item) => {
          const label = catalogDisplayTitle(item, category);
          const isAntique = category === "antiques";
          const image = item.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetUrl(item.images[0])} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="item-placeholder" aria-hidden>
              <span>{categoryLabel(category).slice(0, 2)}</span>
            </div>
          );

          return (
            <article key={item.id} className={`item-card${isAntique ? " item-card--antique" : ""}`}>
              {photoOnly ? (
                <button
                  type="button"
                  className="item-card-image item-card-image--tap"
                  onClick={() => {
                    if (item.images[0]) {
                      setViewerIndex(slideIndexForItem(slides, item.id, 0));
                    }
                  }}
                  aria-label={`${label} を大きく見る`}
                >
                  {image}
                </button>
              ) : (
                <Link
                  href={`${base}/${item.id}`}
                  className="item-card-image item-card-image--tap"
                  aria-label={`${label} の詳細を見る`}
                >
                  {image}
                </Link>
              )}
              {isAntique && showAntiqueLabels ? (
                <div className="item-card-body">
                  <Link href={`${base}/${item.id}`} className="item-card-title-link">
                    <h2>{item.title}</h2>
                  </Link>
                  {item.sold ? (
                    <p className="item-card-sold">売約済み</p>
                  ) : item.priceLabel ? (
                    <p className="item-card-price">{item.priceLabel}</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {photoOnly && viewerIndex !== null ? (
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
