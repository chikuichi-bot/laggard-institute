"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PhotoViewer from "@/components/PhotoViewer";
import { catalogDisplayTitle, categoryBasePath, categoryLabel } from "@/lib/category";
import { pickHomePhotos, type LatestEntry } from "@/lib/home-latest";

type HomeLatestPhotoProps = {
  candidates: LatestEntry[];
};

function entrySlides(entries: LatestEntry[]) {
  return entries.map((entry) => ({
    itemId: entry.item.id,
    imageSrc: entry.item.images[0],
    title: entry.item.title,
    imageIndex: 0,
    category: entry.category,
  }));
}

export default function HomeLatestPhoto({ candidates }: HomeLatestPhotoProps) {
  const [entries, setEntries] = useState<LatestEntry[] | null>(null);

  useEffect(() => {
    setEntries(pickHomePhotos(candidates, 2));
  }, [candidates]);

  const viewerEntries = useMemo(
    () => (entries ?? []).filter((entry) => entry.category !== "antiques"),
    [entries],
  );
  const slides = useMemo(() => entrySlides(viewerEntries), [viewerEntries]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  function openViewer(entry: LatestEntry) {
    const index = viewerEntries.findIndex((candidate) => candidate.item.id === entry.item.id);
    if (index >= 0) setViewerIndex(index);
  }

  if (!entries) {
    return <div className="home-latest-duo home-latest-duo--loading" aria-hidden />;
  }

  return (
    <>
      <div
        className={`home-latest-duo${entries.length < 2 ? " home-latest-duo--single" : ""}`}
      >
        {entries.map((entry) => {
          const placeName = catalogDisplayTitle(entry.item, entry.category);
          const isAntique = entry.category === "antiques";
          const detailHref = `${categoryBasePath(entry.category)}/${entry.item.id}`;

          return (
            <article key={entry.item.id} className="home-latest-column">
              <div className="home-photo-stage">
                {isAntique ? (
                  <Link
                    href={detailHref}
                    className="home-latest-photo"
                    aria-label={`${placeName} の詳細を見る`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.item.images[0]} alt="" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="home-latest-photo"
                    onClick={() => openViewer(entry)}
                    aria-label={`${placeName} を大きく見る`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.item.images[0]} alt="" />
                  </button>
                )}
              </div>
              <div className="home-latest-place">
                <div className="home-latest-place-copy">
                  {placeName ? (
                    <p className="home-latest-place-name">{placeName}</p>
                  ) : null}
                  <p className="home-latest-place-category">
                    {categoryLabel(entry.category)}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {viewerIndex !== null ? (
        <PhotoViewer
          slides={slides}
          index={viewerIndex}
          category={viewerEntries[viewerIndex]?.category ?? "city"}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </>
  );
}
