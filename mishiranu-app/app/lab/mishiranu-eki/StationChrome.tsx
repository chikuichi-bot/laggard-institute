"use client";

/** C案 · 駅名ピル。地図・土地・歩く／案内／設定で共通。 */
export function StationChrome({
  stationName,
  courseTitle,
  metaLine,
  onBack,
  titleId = "tour-title",
}: {
  stationName: string;
  courseTitle: string;
  metaLine: string;
  onBack: () => void;
  titleId?: string;
}) {
  return (
    <header className="mishiranu-station-chrome">
      <div className="mishiranu-station-chrome-top">
        <button
          type="button"
          className="mishiranu-station-chrome-back"
          aria-label="駅を探し直す"
          onClick={onBack}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z"
            />
          </svg>
        </button>
        <span className="mishiranu-station-pill" id={titleId}>
          {stationName}
        </span>
        <span className="mishiranu-station-course">{courseTitle}</span>
      </div>
      <p className="mishiranu-station-chrome-meta">{metaLine}</p>
    </header>
  );
}
