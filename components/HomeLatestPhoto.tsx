"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhotoViewer from "@/components/PhotoViewer";
import { catalogDisplayTitle, categoryBasePath, categoryLabel } from "@/lib/category";
import { assetUrl } from "@/lib/asset-path";
import { pickHomePhotos, replaceHomePhotoSlot, type LatestEntry } from "@/lib/home-latest";
import { isLolipopMinimal } from "@/lib/site-mode";

type HomeLatestPhotoProps = {
  candidates: LatestEntry[];
};

const AUTO_PLAY_MS = 5000;

function entrySlides(entries: LatestEntry[]) {
  return entries.map((entry) => ({
    itemId: entry.item.id,
    imageSrc: assetUrl(entry.item.images[0]),
    title: entry.item.title,
    imageIndex: 0,
    category: entry.category,
  }));
}

function PlaceCopy({ entry }: { entry: LatestEntry }) {
  const placeName = catalogDisplayTitle(entry.item, entry.category);

  return (
    <div className="home-latest-place-copy">
      {placeName ? <p className="home-latest-place-name">{placeName}</p> : null}
      <p className="home-latest-place-category">{categoryLabel(entry.category)}</p>
    </div>
  );
}

export default function HomeLatestPhoto({ candidates }: HomeLatestPhotoProps) {
  const [entries, setEntries] = useState<LatestEntry[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [duoReady, setDuoReady] = useState(false);
  const nextSlotRef = useRef<0 | 1>(0);
  const candidatesRef = useRef(candidates);

  candidatesRef.current = candidates;

  useEffect(() => {
    const initial = pickHomePhotos(candidates, 2);
    if (initial.length < 2) {
      setEntries(initial);
      setDuoReady(false);
      return;
    }

    const firstSlot: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    nextSlotRef.current = firstSlot === 0 ? 1 : 0;
    setEntries(replaceHomePhotoSlot(candidates, initial, firstSlot));
    setDuoReady(true);
  }, [candidates]);

  useEffect(() => {
    const onVisibilityChange = () => {
      setPageVisible(document.visibilityState === "visible");
    };

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const advanceAlternatingPhoto = useCallback(() => {
    const slot = nextSlotRef.current;
    nextSlotRef.current = slot === 0 ? 1 : 0;

    setViewerIndex(null);
    setEntries((current) => {
      if (!current || current.length < 2) return current;
      return replaceHomePhotoSlot(candidatesRef.current, current, slot);
    });
  }, []);

  useEffect(() => {
    if (!autoPlay || !pageVisible || viewerIndex !== null || !duoReady) return;

    const timer = window.setInterval(advanceAlternatingPhoto, AUTO_PLAY_MS);
    return () => window.clearInterval(timer);
  }, [autoPlay, pageVisible, viewerIndex, duoReady, advanceAlternatingPhoto]);

  const viewerEntries = useMemo(
    () => (entries ?? []).filter((entry) => entry.category !== "antiques"),
    [entries],
  );
  const slides = useMemo(() => entrySlides(viewerEntries), [viewerEntries]);

  function openViewer(entry: LatestEntry) {
    const index = viewerEntries.findIndex((candidate) => candidate.item.id === entry.item.id);
    if (index >= 0) setViewerIndex(index);
  }

  const autoRunning = autoPlay && pageVisible && viewerIndex === null && duoReady;
  const autoStandby = autoPlay && !autoRunning;

  if (!entries) {
    return <div className="home-latest-duo home-latest-duo--loading" aria-hidden />;
  }

  const isSingle = entries.length < 2;

  return (
    <>
      <div className={`home-latest-shell${isSingle ? " home-latest-shell--single" : ""}`}>
        <div className={`home-latest-duo${isSingle ? " home-latest-duo--single" : ""}`}>
          {entries.map((entry, index) => {
            const placeName = catalogDisplayTitle(entry.item, entry.category);
            const isAntique = entry.category === "antiques";
            const detailHref = `${categoryBasePath(entry.category)}/${entry.item.id}`;
            const imageSrc = assetUrl(entry.item.images[0]);
            const useDetailLink = isAntique && !isLolipopMinimal;

            return (
              <article key={`home-col-${index}`} className="home-latest-column">
                <div className="home-photo-stage">
                  {useDetailLink ? (
                    <Link
                      href={detailHref}
                      className="home-latest-photo"
                      aria-label={`${placeName} の詳細を見る`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img key={imageSrc} src={imageSrc} alt="" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="home-latest-photo"
                      onClick={() => openViewer(entry)}
                      aria-label={`${placeName} を大きく見る`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img key={imageSrc} src={imageSrc} alt="" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div
          className={`home-latest-footer${isSingle ? " home-latest-footer--single" : ""}`}
        >
          {entries.map((entry, index) => (
            <div key={`home-place-${index}`} className="home-latest-place">
              <PlaceCopy entry={entry} />
            </div>
          ))}
          <div className="home-latest-controls">
            <button
              type="button"
              className="home-latest-shuffle"
              onClick={advanceAlternatingPhoto}
              aria-label="写真を1枚進める"
              title="1枚進める"
              disabled={!duoReady}
            >
              →
            </button>
            <button
              type="button"
              className={[
                "home-latest-autoplay",
                autoRunning
                  ? "home-latest-autoplay--running"
                  : autoStandby
                    ? "home-latest-autoplay--standby"
                    : "home-latest-autoplay--off",
              ].join(" ")}
              onClick={() => setAutoPlay((current) => !current)}
              aria-pressed={autoPlay}
              aria-label={
                autoRunning
                  ? "自動再生中。タップで停止"
                  : autoStandby
                    ? "自動再生はオン。タップでオフ"
                    : "自動再生を始める"
              }
              title={
                autoRunning
                  ? "自動再生中（タップで停止）"
                  : autoStandby
                    ? "自動再生オン・待機中（タップでオフ）"
                    : "自動再生を始める"
              }
              disabled={!duoReady}
            >
              <span className="home-latest-autoplay-icon" aria-hidden>
                {autoPlay ? "⏸" : "▶▶"}
              </span>
              {autoRunning ? (
                <span className="home-latest-autoplay-dot" aria-hidden />
              ) : null}
            </button>
          </div>
        </div>
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
