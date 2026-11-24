"use client";

import { useRouter, useSearchParams } from "next/navigation";

type MapId =
  | "ink"
  | "wash"
  | "hatch"
  | "breath"
  | "dash"
  | "weight"
  | "ring"
  | "dots"
  | "low"
  | "mark";

const SAMPLES: Array<{ id: MapId; name: string; blurb: string }> = [
  {
    id: "ink",
    name: "1 · 街区",
    blurb: "川幅と区画と道。駅は西岸の小さな四角。",
  },
  {
    id: "wash",
    name: "2 · 川の帯",
    blurb: "合流を帯で塗り、通りは岸に沿わせる。",
  },
  {
    id: "hatch",
    name: "3 · 水面のハッチ",
    blurb: "水だけ挿絵の線。区画は輪郭のまま。",
  },
  {
    id: "breath",
    name: "4 · 薄い格子",
    blurb: "街区の格子を川が断ち切る。駅は交点。",
  },
  {
    id: "dash",
    name: "5 · 橋が一本",
    blurb: "岸と橋と駅。道は必要な数だけ。",
  },
  {
    id: "weight",
    name: "6 · 南の川幅",
    blurb: "上流は細く、合流後の川だけ幅を持たせる。",
  },
  {
    id: "ring",
    name: "7 · 破線の路地",
    blurb: "大通りは実線、路地は破線。川は帯。",
  },
  {
    id: "dots",
    name: "8 · 点の区画",
    blurb: "建物を点の集まりに。川と駅だけ線で残す。",
  },
  {
    id: "low",
    name: "9 · 淡い市街",
    blurb: "区画をごく薄く、川と駅を先に読ませる。",
  },
  {
    id: "mark",
    name: "10 · 駅を大きく",
    blurb: "同じ地図で、駅の印だけを一回り大きく。",
  },
];

const RIVER = "M36 10 C50 40, 66 68, 78 94 M124 8 C110 40, 94 68, 82 94 M80 96 C84 118, 90 138, 98 158";
const HATCH = [
  "M28 16 L70 88",
  "M36 12 L74 86",
  "M44 14 L76 90",
  "M132 12 L90 88",
  "M124 10 L86 86",
  "M116 14 L84 92",
  "M74 100 L96 156",
  "M82 98 L102 154",
  "M88 102 L108 152",
];
const BLOCKS: Array<[number, number, number, number]> = [
  [8, 20, 26, 14],
  [10, 42, 30, 16],
  [14, 66, 22, 14],
  [116, 16, 30, 14],
  [110, 40, 34, 16],
  [106, 64, 28, 14],
  [16, 112, 32, 14],
  [52, 120, 14, 18],
  [108, 114, 30, 16],
  [120, 138, 20, 12],
];
const STREETS = ["M4 38 H48", "M112 36 H156", "M6 68 H42", "M112 70 H156", "M24 6 V34", "M140 6 V32", "M8 108 H62", "M102 110 H154"];
const ALLEYS = ["M8 54 H36", "M120 54 H154", "M18 128 H46", "M112 132 H148"];

function MapSvg({ id }: { id: MapId }) {
  const riverClass =
    id === "weight"
      ? "hm-river hm-river--south"
      : id === "wash" || id === "low"
        ? "hm-river hm-river--pale"
        : "hm-river";
  const streetClass = id === "ring" ? "hm-street" : id === "breath" ? "hm-street hm-street--faint" : "hm-street";
  const blockClass = id === "low" ? "hm-block hm-block--faint" : "hm-block";
  const station = id === "mark" ? 11 : 7;
  const showBlocks = id !== "dots";
  const showHatch = id === "hatch";
  const showBridge = id === "dash" || id === "ink" || id === "mark" || id === "weight";
  const showAlleys = id === "ring" || id === "ink" || id === "breath";

  return (
    <svg viewBox="0 0 160 168" className={`hm-fig hm-fig--${id}`} aria-hidden>
      {id === "weight" ? (
        <>
          <path className="hm-river hm-river--thin" d="M36 10 C50 40, 66 68, 78 94 M124 8 C110 40, 94 68, 82 94" />
          <path className="hm-river hm-river--wide" d="M80 96 C84 118, 90 138, 98 158" />
        </>
      ) : (
        <path className={riverClass} d={RIVER} />
      )}
      {showHatch
        ? HATCH.map((d) => <path key={d} className="hm-hatch" d={d} />)
        : null}
      <path className="hm-bank" d={RIVER} />
      {STREETS.map((d) => (
        <path key={d} className={streetClass} d={d} />
      ))}
      {showAlleys
        ? ALLEYS.map((d) => <path key={d} className="hm-street hm-street--dash" d={d} />)
        : null}
      {showBridge ? <path className="hm-bridge" d="M64 104 L98 112" /> : null}
      {showBlocks
        ? BLOCKS.map(([x, y, w, h]) => (
            <rect key={`${x}-${y}`} className={blockClass} x={x} y={y} width={w} height={h} rx="1.2" />
          ))
        : BLOCKS.map(([x, y, w, h]) => (
            <g key={`${x}-${y}`}>
              <circle className="hm-parcel" cx={x + 4} cy={y + 4} r="1.15" />
              <circle className="hm-parcel" cx={x + w * 0.55} cy={y + h * 0.45} r="1.15" />
              <circle className="hm-parcel" cx={x + w * 0.8} cy={y + h * 0.72} r="1.05" />
            </g>
          ))}
      <rect
        className="hm-station"
        x={70 - station / 2}
        y={96 - station / 2}
        width={station}
        height={station}
        rx="1"
      />
    </svg>
  );
}

function Face({ id }: { id: MapId }) {
  return (
    <div className="hm-phone">
      <div className="hm-notch" aria-hidden />
      <div className="hm-screen">
        <div className="hm-hero">
          <h1>見知らぬ駅</h1>
          <div className="hm-map-slot">
            <MapSvg id={id} />
          </div>
          <div className="hm-dock">
            <button type="button">この場所</button>
            <form onSubmit={(e) => e.preventDefault()}>
              <label>
                <span>駅名</span>
                <input aria-label="駅名" placeholder="例：藤森 / 出町柳" readOnly />
              </label>
            </form>
            <p className="hm-hero-foot">保存 6 駅・検索バーをタップすると一覧が出ます</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroMapSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("map");
  const focus = SAMPLES.some((s) => s.id === raw) ? (raw as MapId) : null;
  const shown = focus ? SAMPLES.filter((s) => s.id === focus) : SAMPLES;

  function select(id: MapId | null) {
    const q = id ? `?map=${id}` : "";
    router.replace(`/lab/mishiranu-eki/hero-map-samples${q}`, { scroll: false });
  }

  return (
    <div className="hm-page">
      <header className="hm-head">
        <p className="hm-head-kicker">見知らぬ駅 · トップ余白</p>
        <h1 className="hm-head-title">出町柳の抽象地図 · 10案</h1>
        <p className="hm-head-lead">
          題字とボタンのあいだに、川・道・区画が読める抽象地図を10種置いています。実在の道路図ではありません。
        </p>
        <div className="hm-tabs" role="tablist">
          <button type="button" className={focus ? "" : "is-on"} onClick={() => select(null)}>
            10こ並べる
          </button>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={focus === s.id ? "is-on" : ""}
              onClick={() => select(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </header>
      <div className={focus ? "hm-grid hm-grid--one" : "hm-grid"}>
        {shown.map((sample) => (
          <article key={sample.id} className="hm-card">
            <Face id={sample.id} />
            <div className="hm-card-copy">
              <h2>{sample.name}</h2>
              <p>{sample.blurb}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
