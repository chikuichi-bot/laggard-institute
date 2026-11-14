"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ALLEYS,
  BLOCKS,
  BRIDGE,
  DELTA,
  FOREST,
  GYOEN,
  HATCH_ALONG_RIVER,
  RAIL_EIZAN,
  RAIL_KEIHAN,
  RIVERS,
  RIVER_EAST,
  RIVER_SOUTH,
  RIVER_WEST,
  ROAD_HIGASHIOJI,
  ROAD_IMADEGAWA,
  ROAD_KAWABATA,
  ROAD_KAWARAMACHI,
  STATION,
  VIEW,
} from "./geo";

type MapId =
  | "faithful"
  | "river"
  | "forest"
  | "avenues"
  | "rails"
  | "delta"
  | "parcels"
  | "gyoen"
  | "banks"
  | "plaza";

const SAMPLES: Array<{ id: MapId; name: string; blurb: string }> = [
  {
    id: "faithful",
    name: "1 · 実地に近い",
    blurb: "Y字の川、今出川・河原町・東大路、駅、糺の森、御苑の位置を保つ。",
  },
  {
    id: "river",
    name: "2 · 川だけ",
    blurb: "賀茂・高野・鴨の三本だけ。駅は合流の東岸。",
  },
  {
    id: "forest",
    name: "3 · 森と川",
    blurb: "Yのあいだを糺の森の面で埋める。市街は薄く。",
  },
  {
    id: "avenues",
    name: "4 · 大通り骨格",
    blurb: "今出川・河原町・東大路・川端を太く。川は帯。",
  },
  {
    id: "rails",
    name: "5 · 鉄道の糸",
    blurb: "京阪と叡山と駅。川は細い岸だけ。",
  },
  {
    id: "delta",
    name: "6 · デルタ",
    blurb: "合流の三角州を印に。橋と駅を近くに置く。",
  },
  {
    id: "parcels",
    name: "7 · 街区の粒子",
    blurb: "建物を点に分解。川と大通りだけ線で残す。",
  },
  {
    id: "gyoen",
    name: "8 · 御苑の矩形",
    blurb: "南西の大きな御苑を錨に、川と駅を読む。",
  },
  {
    id: "banks",
    name: "9 · 岸の輪郭",
    blurb: "水面をハッチ、岸線を主役。区画は輪郭だけ。",
  },
  {
    id: "plaza",
    name: "10 · 駅前広場",
    blurb: "駅前の広場と橋を大きく。周辺の道は最小。",
  },
];

function StationMark({ size = STATION.size, large = false }: { size?: number; large?: boolean }) {
  return (
    <rect
      className={large ? "station station--lg" : "station"}
      x={STATION.x - size / 2}
      y={STATION.y - size / 2}
      width={size}
      height={size}
      rx="1"
    />
  );
}

function MapSvg({ id }: { id: MapId }) {
  const [gx, gy, gw, gh] = GYOEN;

  if (id === "river") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="river river--wide" d={RIVERS} />
        <path className="bank" d={RIVERS} />
        <StationMark />
      </svg>
    );
  }

  if (id === "forest") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="forest forest--solid" d={FOREST} />
        <path className="river" d={RIVERS} />
        <path className="bank" d={RIVERS} />
        {BLOCKS.slice(0, 6).map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} className="block block--faint" x={x} y={y} width={w} height={h} rx="1" />
        ))}
        <StationMark />
      </svg>
    );
  }

  if (id === "avenues") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="river river--pale" d={RIVERS} />
        <path className="road road--bold" d={ROAD_IMADEGAWA} />
        <path className="road road--bold" d={ROAD_KAWARAMACHI} />
        <path className="road road--bold" d={ROAD_HIGASHIOJI} />
        <path className="road" d={ROAD_KAWABATA} />
        <path className="bridge" d={BRIDGE} />
        <StationMark />
      </svg>
    );
  }

  if (id === "rails") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <path className="rail" d={RAIL_KEIHAN} />
        <path className="rail" d={RAIL_EIZAN} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <StationMark size={9} large />
      </svg>
    );
  }

  if (id === "delta") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="river river--thin" d={RIVER_WEST} />
        <path className="river river--thin" d={RIVER_EAST} />
        <path className="river" d={RIVER_SOUTH} />
        <path className="delta delta--mark" d={DELTA} />
        <path className="bridge" d={BRIDGE} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <StationMark size={8} />
      </svg>
    );
  }

  if (id === "parcels") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path className="river" d={RIVERS} />
        <path className="road" d={ROAD_IMADEGAWA} />
        <path className="road road--faint" d={ROAD_KAWARAMACHI} />
        {BLOCKS.map(([x, y, w, h]) => (
          <g key={`${x}-${y}`}>
            <circle className="parcel" cx={x + 4} cy={y + 4} r="1.1" />
            <circle className="parcel" cx={x + w * 0.55} cy={y + h * 0.4} r="1.05" />
            <circle className="parcel" cx={x + w * 0.8} cy={y + h * 0.72} r="0.95" />
          </g>
        ))}
        <StationMark />
      </svg>
    );
  }

  if (id === "gyoen") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <rect className="gyoen gyoen--bold" x={gx} y={gy} width={gw} height={gh} rx="1.5" />
        <path className="river" d={RIVERS} />
        <path className="bank" d={RIVERS} />
        <path className="forest" d={FOREST} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <StationMark />
      </svg>
    );
  }

  if (id === "banks") {
    return (
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
        <path
          className="forest"
          d={FOREST}
          style={{ fill: "color-mix(in srgb, var(--green) 7%, transparent)" }}
        />
        <rect
          className="gyoen"
          x={GYOEN[0]}
          y={GYOEN[1]}
          width={GYOEN[2]}
          height={GYOEN[3]}
          rx="1.2"
          style={{ fill: "color-mix(in srgb, var(--green) 6%, transparent)" }}
        />
        {HATCH_ALONG_RIVER.map((d) => (
          <path key={d} className="hatch" d={d} />
        ))}
        <path className="bank" d={RIVERS} style={{ strokeWidth: 1.4 }} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} style={{ opacity: 0.45 }} />
        {BLOCKS.map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} className="block block--faint" x={x} y={y} width={w} height={h} rx="1" />
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
        <rect className="plaza" x={90} y={68} width={22} height={16} rx="1.5" />
        <path className="bridge" d={BRIDGE} />
        <path className="rail" d={RAIL_EIZAN} />
        <path className="road road--faint" d={ROAD_IMADEGAWA} />
        <StationMark size={10} large />
      </svg>
    );
  }

  // faithful
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="da10-fig" aria-hidden>
      <path className="forest" d={FOREST} />
      <rect className="gyoen" x={gx} y={gy} width={gw} height={gh} rx="1.2" />
      <path className="delta" d={DELTA} />
      <path className="river" d={RIVERS} />
      <path className="bank" d={RIVERS} />
      <path className="road" d={ROAD_IMADEGAWA} />
      <path className="road" d={ROAD_KAWARAMACHI} />
      <path className="road road--faint" d={ROAD_HIGASHIOJI} />
      <path className="road road--faint" d={ROAD_KAWABATA} />
      {ALLEYS.map((d) => (
        <path key={d} className="alley" d={d} />
      ))}
      <path className="rail" d={RAIL_KEIHAN} />
      <path className="rail" d={RAIL_EIZAN} />
      <path className="bridge" d={BRIDGE} />
      {BLOCKS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} className="block" x={x} y={y} width={w} height={h} rx="1.1" />
      ))}
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

export default function DemachiAbstract10() {
  const router = useRouter();
  const params = useSearchParams();
  const focus = params.get("m") as MapId | null;
  const active = SAMPLES.some((s) => s.id === focus) ? focus : null;

  function go(id: MapId | null) {
    const q = id ? `?m=${id}` : "";
    router.replace(`/lab/mishiranu-eki/demachi-abstract-10${q}`);
  }

  return (
    <div className="da10">
      <header className="da10-head">
        <p className="da10-kicker">見知らぬ駅 · トップ余白</p>
        <h1>出町柳駅周辺の抽象地図 · 10案</h1>
        <p className="da10-lead">
          実地図のY字合流・出町柳駅・今出川通・糺の森・御苑の位置を土台に、抽象の仕方だけを変えています。気に入った番号を教えてください。
        </p>
      </header>

      <nav className="da10-tabs" aria-label="案の切り替え">
        <a
          href="/lab/mishiranu-eki/demachi-abstract-10"
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
            href={`/lab/mishiranu-eki/demachi-abstract-10?m=${s.id}`}
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
