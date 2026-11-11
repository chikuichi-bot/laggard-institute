/** 採用: 道網。配置は left / top / width の％だけ。 */

import type { CSSProperties } from "react";
import { HERO_MAP_LAYOUT, type HeroMapLayout } from "./heroMapLayout";

const VIEW = { w: 160, h: 168 };

const RIVERS =
  "M52 4 C50 28, 52 48, 56 64 C60 76, 64 84, 70 90 M148 20 C128 34, 108 50, 90 68 C82 76, 76 84, 70 90 M70 90 C72 108, 74 126, 76 144 C77 154, 78 160, 80 168";

const ROADS = [
  "M2 132 H158",
  "M34 4 V164",
  "M142 4 V164",
  "M88 98 V164",
  "M6 36 H48",
  "M6 58 H50",
  "M6 82 H52",
  "M6 108 H54",
  "M100 40 H140",
  "M98 62 H144",
  "M96 88 H146",
  "M100 112 H148",
  "M18 8 V128",
  "M46 8 V128",
  "M108 8 V128",
  "M128 8 V160",
];

const STATION = { x: 92, y: 82, size: 7 };

export default function HeroRoadMap({
  layout = HERO_MAP_LAYOUT,
  className,
}: {
  layout?: HeroMapLayout;
  className?: string;
}) {
  const figStyle: CSSProperties = {
    position: "absolute",
    left: `${layout.leftPct}%`,
    top: `${layout.topPct}%`,
    width: `${layout.widthPct}%`,
    height: "auto",
  };

  return (
    <div
      className={["mishiranu-hero-map", className].filter(Boolean).join(" ")}
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="mishiranu-hero-map-fig"
        style={figStyle}
      >
        <path className="mhm-bank" d={RIVERS} />
        {ROADS.map((d) => (
          <path key={d} className="mhm-road" d={d} />
        ))}
        <rect
          className="mhm-station"
          x={STATION.x - STATION.size / 2}
          y={STATION.y - STATION.size / 2}
          width={STATION.size}
          height={STATION.size}
          rx="1"
        />
      </svg>
    </div>
  );
}
