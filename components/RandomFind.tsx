"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import PhotoViewer from "@/components/PhotoViewer";
import { assetUrl } from "@/lib/asset-path";
import { catalogDisplayTitle, categoryLabel } from "@/lib/category";
import type { CatalogItem, ItemCategory } from "@/lib/types";
import { buildViewerSlides, slideIndexForItem } from "@/lib/viewer-slides";

type RandomFindProps = {
  category: ItemCategory;
  items: CatalogItem[];
};

function pickRandomItem(items: CatalogItem[], excludeId?: string) {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  const pool = excludeId ? items.filter((item) => item.id !== excludeId) : items;
  const choices = pool.length > 0 ? pool : items;
  return choices[Math.floor(Math.random() * choices.length)] ?? null;
}

export default function RandomFind({ category, items }: RandomFindProps) {
  const visibleItems = useMemo(
    () => items.filter((item) => Boolean(item.images[0])),
    [items],
  );
  const slides = useMemo(() => buildViewerSlides(visibleItems), [visibleItems]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      startTransition(() => {
        setCurrentId(pickRandomItem(visibleItems)?.id ?? null);
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visibleItems]);

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

  const current =
    visibleItems.find((item) => item.id === currentId) ?? null;

  if (!current) {
    return <div className="random-find random-find--loading" aria-hidden />;
  }

  const label = catalogDisplayTitle(current, category);
  const imageSrc = assetUrl(current.images[0]);

  return (
    <>
      <div className="random-find">
        <article className="random-find-card">
          <button
            type="button"
            className="random-find-photo"
            onClick={() => setViewerIndex(slideIndexForItem(slides, current.id, 0))}
            aria-label={`${label} を大きく見る`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={imageSrc} src={imageSrc} alt="" />
          </button>

          {label ? (
            <footer className="random-find-meta">
              <p className="random-find-place">{label}</p>
              <p className="random-find-category">{categoryLabel(category)}</p>
            </footer>
          ) : null}
        </article>

        <div className="random-find-controls">
          <button
            type="button"
            className="action-btn random-find-next"
            onClick={() => {
              setViewerIndex(null);
              setCurrentId(pickRandomItem(visibleItems, current.id)?.id ?? null);
            }}
            disabled={visibleItems.length < 2}
          >
            次の一枚
          </button>
          <p className="random-find-hint">もう一枚、拾い直す。</p>
        </div>
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
