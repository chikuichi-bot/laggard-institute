"use client";

/** 駅ヘッド。地図・土地・歩く／案内／設定で共通。「京阪電車　出町柳駅」だけ。 */
export function StationChrome({
  label,
  onBack,
  titleId = "tour-title",
}: {
  label: string;
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
          {label}
        </span>
      </div>
    </header>
  );
}

/** 「京阪電車　出町柳駅」形式。 */
export function chromeStationLabel(name: string, line: string): string {
  const bare = name.endsWith("駅") ? name.slice(0, -1) : name;
  const primary =
    line
      .split(/[\/・,]/)
      .map((part) => part.trim())
      .find((part) => part && part !== "路線情報は要確認") ?? "";
  const linePart = primary.endsWith("本線")
    ? `${primary.slice(0, -2)}電車`
    : primary;
  if (!linePart) return `${bare}駅`;
  return `${linePart}　${bare}駅`;
}
