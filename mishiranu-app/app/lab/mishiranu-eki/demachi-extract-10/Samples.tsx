"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ALL_ROADS,
  BLOCKS,
  BRIDGES,
  DELTA,
  FOREST,
  HATCH,
  PLAZA,
  RAIL_EIZAN,
  RAIL_KEIHAN,
  RIVERS,
  ROAD_EAST_H,
  ROAD_EAST_V,
  ROAD_HIGASHIOJI,
  ROAD_IMADEGAWA,
  ROAD_KAWABATA,
  ROAD_KAWARAMACHI,
  ROAD_WEST_H,
  ROAD_WEST_V,
  STATION,
  VIEW,
} from "./geo";

type MapId =
  | "fabric"
  | "bridges"
  | "grid"
  | "banks"
  | "rails"
  | "forest"
  | "blocks"
  | "wash"
  | "lines"
  | "plaza";

const SAMPLES: Array<{ id: MapId; name: string; blurb: string }> = [
  {
    id: "fabric",
    name: "1 · 地紋",
    blurb: "吹き出しを除いた骨格。川・道網・森・駅・街区。",
  },
  {
    id: "bridges",
    name: "2 · 川と橋",
    blurb: "葵・河合・出町・賀茂大橋の四本と川。",
  },
  {
    id: "grid",
    name: "3 · 道網（採用）",
    blurb: "観光地図の道を線網だけに。本番トップに採用・左上寄せ。",
  },
  {
    id: "banks",
    name: "4 · 岸の輪郭",
    blurb: "水面ハッチと岸線。道は今出川だけ。",
  },
  {
    id: "rails",
    name: "5 · 鉄道",
    blurb: "叡山と京阪と駅。川は細い岸。",
  },
  {
    id: "forest",
    name: "6 · 森とデルタ",
    blurb: "糺の森と三角州を面で残す。",
  },
  {
    id: "blocks",
    name: "7 · 街区",
    blurb: "区画の輪郭と川。道は最小。",
  },
  {
    id: "wash",
    name: "8 · 淡い川",
    blurb: "観光地図の水色を薄い帯に置き換える。",
  },
  {
    id: "lines",
    name: "9 · 線だけ",
    blurb: "すべてを同系の細い線に揃える。",
  },
  {
    id: "plaza",
    name: "10 · 駅前",
    blurb: "駅前広場と叡山・橋を大きく。",
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

function RoadNet({ thin = false }: { thin?: boolean }) {
  const cls = thin ? "road road--net-thin" : "road road--net";
  return (
    <>
      {ALL_ROADS.map((d) => (
        <path key={d} className={cls} d={d} />
      ))}
    </>
  );
}

function Bridges() {
  return (
    <>
      {BRIDGES.map((d) => (
        <path key={d} className="bridge" d={d} />
      ))}
    </>
  );
}

function Blocks({ faint = true }: { faint?: boolean }) {
  return (
    <>
      {BLOCKS.map(([x, y, w, h]) => (
        <rect
          key={`${x}-${y}`}
          className={faint ? "block block--faint" : "block"}
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

function MapSvg({ id }: { id: MapId }) {
  const [px, py, pw, ph] = PLAZA;

  if (id === "bridges") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="river river--pale" d={RIVERS} />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.3 }} />
        <Bridges />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <StationMark />
      </svg>
    );
  }

  if (id === "grid") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <g transform="translate(-12 -14)">
          <path className="bank" d={RIVERS} style={{ strokeWidth: 1.1 }} />
          <RoadNet />
          <StationMark />
        </g>
      </svg>
    );
  }

  if (id === "banks") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        {HATCH.map((d) => (
          <path key={d} className="hatch" d={d} />
        ))}
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <Blocks />
        <StationMark />
      </svg>
    );
  }

  if (id === "rails") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.15 }} />
        <path className="rail" d={RAIL_EIZAN} />
        <path className="rail" d={RAIL_KEIHAN} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <StationMark size={9} />
      </svg>
    );
  }

  if (id === "forest") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="forest forest--solid" d={FOREST} />
        <path className="delta delta--mark" d={DELTA} />
        <path className="river river--thin" d={RIVERS} />
        <path className="bank" d={RIVERS} />
        <StationMark />
      </svg>
    );
  }

  if (id === "blocks") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.3 }} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <path className="road road--faint" d={ROAD_KAWARAMACHI} />
        <path className="road road--faint" d={ROAD_HIGASHIOJI} />
        <Blocks faint={false} />
        <StationMark />
      </svg>
    );
  }

  if (id === "wash") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path
          className="wash"
          d={RIVERS}
          style={{ stroke: "color-mix(in srgb, var(--river) 40%, transparent)", strokeWidth: 14, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}
        />
        <path className="bank" d={RIVERS} style={{ strokeWidth: 0.9 }} />
        <path className="forest" d={FOREST} />
        <RoadNet thin />
        <StationMark />
      </svg>
    );
  }

  if (id === "lines") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="line-only" d={RIVERS} />
        <path className="line-only" d={FOREST} />
        {[
          ROAD_IMADEGAWA,
          ROAD_KAWARAMACHI,
          ROAD_HIGASHIOJI,
          ROAD_KAWABATA,
          ...ROAD_WEST_H,
          ...ROAD_EAST_H,
          ...ROAD_WEST_V,
          ...ROAD_EAST_V,
          ...BRIDGES,
          RAIL_EIZAN,
          RAIL_KEIHAN,
        ].map((d) => (
          <path key={d} className="line-only" d={d} style={{ strokeWidth: 0.85 }} />
        ))}
        <StationMark />
      </svg>
    );
  }

  if (id === "plaza") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="river river--pale" d={RIVERS} />
        <path className="bank" d={RIVERS} />
        <rect className="plaza" x={px} y={py} width={pw} height={ph} rx="1.5" />
        <path className="rail" d={RAIL_EIZAN} />
        <path className="bridge" d={BRIDGES[2]} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <StationMark size={10} />
      </svg>
    );
  }

  // fabric — 地紋の総合
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
      <path className="forest" d={FOREST} />
      <path className="delta" d={DELTA} />
      <path className="river river--pale" d={RIVERS} />
      <path className="bank" d={RIVERS} style={{ strokeWidth: 1.15 }} />
      <RoadNet thin />
      <Bridges />
      <path className="rail" d={RAIL_EIZAN} />
      <path className="rail" d={RAIL_KEIHAN} />
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

export default function Extract10() {
  const router = useRouter();
  const params = useSearchParams();
  const focus = params.get("m") as MapId | null;
  const active = SAMPLES.some((s) => s.id === focus) ? focus : null;

  function go(id: MapId | null) {
    const q = id ? `?m=${id}` : "";
    router.replace(`/lab/mishiranu-eki/demachi-extract-10${q}`);
  }

  return (
    <div className="da10">
      <header className="da10-head">
        <p className="da10-kicker">見知らぬ駅 · トップ余白</p>
        <h1>観光地図の地紋だけ · 抽象10案</h1>
        <p className="da10-lead">
          写真・店名・吹き出しを除き、川・道・橋・駅・森・街区だけを抜き出して抽象にしています。気に入った番号を教えてください。
        </p>
      </header>

      <nav className="da10-tabs" aria-label="案の切り替え">
        <a
          href="/lab/mishiranu-eki/demachi-extract-10"
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
            href={`/lab/mishiranu-eki/demachi-extract-10?m=${s.id}`}
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
