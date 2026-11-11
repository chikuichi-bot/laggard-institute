"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  BLOCKS,
  BRIDGE,
  FOREST,
  GYOEN,
  HATCH_ALONG_RIVER,
  HATCH_CROSS,
  HATCH_DENSE,
  HATCH_SPARSE,
  RIVERS,
  RIVERS_OFFSET,
  ROAD_HIGASHIOJI,
  ROAD_IMADEGAWA,
  ROAD_KAWARAMACHI,
  STATION,
  VIEW,
} from "../demachi-abstract-10/geo";

type MapId =
  | "base"
  | "dense"
  | "sparse"
  | "cross"
  | "bankOnly"
  | "bridge"
  | "forest"
  | "avenues"
  | "twin"
  | "gyoen";

const SAMPLES: Array<{ id: MapId; name: string; blurb: string }> = [
  {
    id: "base",
    name: "9-1 · 原型",
    blurb: "実地図のY字・東岸の駅・西東の街区・南西御苑の位置。",
  },
  {
    id: "dense",
    name: "9-2 · 密なハッチ",
    blurb: "川筋に沿うハッチを細かく詰める。",
  },
  {
    id: "sparse",
    name: "9-3 · 疎なハッチ",
    blurb: "ハッチを間引き、岸線で川を読む。",
  },
  {
    id: "cross",
    name: "9-4 · 交差ハッチ",
    blurb: "川帯の斜線を交差させて水面の密度を出す。",
  },
  {
    id: "bankOnly",
    name: "9-5 · 岸だけ",
    blurb: "ハッチなし。岸線だけを太く。",
  },
  {
    id: "bridge",
    name: "9-6 · 岸と橋",
    blurb: "今出川付近の橋を一本足す。",
  },
  {
    id: "forest",
    name: "9-7 · 岸と森",
    blurb: "Yのあいだの糺の森を面で示す。",
  },
  {
    id: "avenues",
    name: "9-8 · 岸と大通り",
    blurb: "今出川・河原町・東大路を薄く重ねる。",
  },
  {
    id: "twin",
    name: "9-9 · 二重岸",
    blurb: "岸を二本ずらして川幅の気配を出す。",
  },
  {
    id: "gyoen",
    name: "9-10 · 岸と御苑",
    blurb: "南西の御苑を面で置き、岸と対比する。",
  },
];

function StationMark({ size = STATION.size }: { size?: number }) {
  return (
    <rect
      className="station"
      x={STATION.x - size / 2}
      y={STATION.y - size / 2}
      width={size}
      height={size}
      rx="1"
    />
  );
}

function Blocks() {
  return (
    <>
      {BLOCKS.map(([x, y, w, h]) => (
        <rect
          key={`${x}-${y}`}
          className="block block--faint"
          x={x}
          y={y}
          width={w}
          height={h}
          rx="1"
        />
      ))}
    </>
  );
}

function Hatch({
  paths,
  className = "hatch",
}: {
  paths: string[];
  className?: string;
}) {
  return (
    <>
      {paths.map((d) => (
        <path key={d} className={className} d={d} />
      ))}
    </>
  );
}

/** 全案共通の配置ガイド（実地図の骨格を薄く残す） */
function LayoutGhost({
  forestFill = false,
  gyoenFill = false,
  roads = false,
}: {
  forestFill?: boolean;
  gyoenFill?: boolean;
  roads?: boolean;
}) {
  const [gx, gy, gw, gh] = GYOEN;
  return (
    <>
      <path
        className={forestFill ? "forest forest--solid" : "forest"}
        d={FOREST}
        style={forestFill ? undefined : { fill: "color-mix(in srgb, var(--green) 7%, transparent)" }}
      />
      <rect
        className={gyoenFill ? "gyoen gyoen--bold" : "gyoen"}
        x={gx}
        y={gy}
        width={gw}
        height={gh}
        rx="1.2"
        style={
          gyoenFill
            ? undefined
            : { fill: "color-mix(in srgb, var(--green) 6%, transparent)" }
        }
      />
      {roads ? (
        <>
          <path className="road road--faint" d={ROAD_IMADEGAWA} />
          <path className="road road--faint" d={ROAD_KAWARAMACHI} />
          <path className="road road--faint" d={ROAD_HIGASHIOJI} />
        </>
      ) : (
        <path className="road road--faint" d={ROAD_IMADEGAWA} style={{ opacity: 0.45 }} />
      )}
    </>
  );
}

function MapSvg({ id }: { id: MapId }) {
  if (id === "dense") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost />
        <Hatch paths={HATCH_DENSE} className="hatch hatch--dense" />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "sparse") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost />
        <Hatch paths={HATCH_SPARSE} className="hatch hatch--sparse" />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "cross") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost />
        <Hatch paths={HATCH_CROSS} className="hatch hatch--cross" />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "bankOnly") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost />
        <path className="bank bank--heavy" d={RIVERS} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "bridge") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost />
        <Hatch paths={HATCH_ALONG_RIVER} />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <path className="bridge" d={BRIDGE} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "forest") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost forestFill />
        <Hatch paths={HATCH_ALONG_RIVER} className="hatch hatch--soft" />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "avenues") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost roads />
        <Hatch paths={HATCH_ALONG_RIVER} />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "twin") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost />
        <Hatch paths={HATCH_SPARSE} className="hatch hatch--soft" />
        <path className="bank bank--twin" d={RIVERS_OFFSET} />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "gyoen") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <LayoutGhost gyoenFill />
        <Hatch paths={HATCH_ALONG_RIVER} />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
      <LayoutGhost />
      <Hatch paths={HATCH_ALONG_RIVER} />
      <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
      <Blocks />
      <StationMark />
    </svg>
  );
}

function Face({ id }: { id: MapId }) {
  return (
    <div className="da10-phone">
      <div className="da10-notch" aria-hidden />
      <div className="da10-screen">
        <div className="da10-hero">
          <h1>見知らぬ駅</h1>
          <div className="da10-map-slot">
            <MapSvg id={id} />
          </div>
          <div className="da10-dock">
            <button type="button">この場所</button>
            <label>
              <span>駅名</span>
              <input readOnly placeholder="例：藤森 / 出町柳" />
            </label>
            <p className="da10-foot">保存 6 駅・検索バーをタップすると一覧が出ます</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Banks10() {
  const router = useRouter();
  const params = useSearchParams();
  const focus = params.get("m") as MapId | null;
  const active = SAMPLES.some((s) => s.id === focus) ? focus : null;

  function go(id: MapId | null) {
    const q = id ? `?m=${id}` : "";
    router.replace(`/lab/mishiranu-eki/demachi-banks-10${q}`);
  }

  return (
    <div className="da10">
      <header className="da10-head">
        <p className="da10-kicker">見知らぬ駅 · トップ余白 · 案9から</p>
        <h1>岸の輪郭 · 派生10案（提示地図の配置）</h1>
        <p className="da10-lead">
          提示いただいた地図どおり、広い糺の森・東岸の駅・南西の御苑・今出川の位置に合わせ直しています。気に入った番号を教えてください。
        </p>
      </header>

      <nav className="da10-tabs" aria-label="案の切り替え">
        <a
          href="/lab/mishiranu-eki/demachi-banks-10"
          className={!active ? "is-on" : ""}
          onClick={(e) => {
            e.preventDefault();
            go(null);
          }}
        >
          10こ並べる
        </a>
        {SAMPLES.map((s, i) => (
          <a
            key={s.id}
            href={`/lab/mishiranu-eki/demachi-banks-10?m=${s.id}`}
            className={active === s.id ? "is-on" : ""}
            onClick={(e) => {
              e.preventDefault();
              go(s.id);
            }}
          >
            {i + 1}
          </a>
        ))}
      </nav>

      {active ? (
        <div className="da10-solo">
          <article className="da10-card">
            <h2>{SAMPLES.find((s) => s.id === active)?.name}</h2>
            <p>{SAMPLES.find((s) => s.id === active)?.blurb}</p>
            <Face id={active} />
          </article>
        </div>
      ) : (
        <div className="da10-grid">
          {SAMPLES.map((s) => (
            <article key={s.id} className="da10-card">
              <h2>{s.name}</h2>
              <p>{s.blurb}</p>
              <Face id={s.id} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
