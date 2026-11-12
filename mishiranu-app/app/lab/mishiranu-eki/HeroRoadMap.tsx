/** 採用: 道網。川は「控えめな風」（左右になびく・弱め）。配置は left / top / width の％だけ。 */

import type { CSSProperties } from "react";
import { HERO_MAP_LAYOUT, type HeroMapLayout } from "./heroMapLayout";

const VIEW = { w: 160, h: 168 };

const WEST = "M52 4 C50 28, 52 48, 56 64 C60 76, 64 84, 70 90";
const EAST = "M148 20 C128 34, 108 50, 90 68 C82 76, 76 84, 70 90";
const SOUTH = "M70 90 C72 108, 74 126, 76 144 C77 154, 78 160, 80 168";

const WEST_L = "M52 4 C48 28, 50 48, 54 64 C58 76, 63 84, 70 90";
const EAST_L = "M148 20 C126 34, 106 50, 88 68 C80 76, 75 84, 70 90";
const SOUTH_L = "M70 90 C70 108, 72 126, 74 144 C76 154, 77 160, 80 168";

const WEST_R = "M52 4 C52 28, 54 48, 58 64 C62 76, 65 84, 70 90";
const EAST_R = "M148 20 C130 34, 110 50, 92 68 C84 76, 77 84, 70 90";
const SOUTH_R = "M70 90 C74 108, 76 126, 78 144 C78 154, 79 160, 80 168";

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

const WIND_DUR = "7.5s";

function SoftWindRiver({
  rest,
  left,
  right,
}: {
  rest: string;
  left: string;
  right: string;
}) {
  return (
    <path className="mhm-bank" d={rest}>
      <animate
        attributeName="d"
        values={`${rest};${left};${rest};${right};${rest}`}
        keyTimes="0;0.25;0.5;0.75;1"
        dur={WIND_DUR}
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
      />
    </path>
  );
}

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
        <SoftWindRiver rest={WEST} left={WEST_L} right={WEST_R} />
        <SoftWindRiver rest={EAST} left={EAST_L} right={EAST_R} />
        <SoftWindRiver rest={SOUTH} left={SOUTH_L} right={SOUTH_R} />
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
