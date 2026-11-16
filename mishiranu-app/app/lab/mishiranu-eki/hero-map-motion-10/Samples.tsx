"use client";

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

const SOFT_ROADS = ["M6 58 H50", "M100 40 H140", "M18 8 V128", "M96 88 H146"];

const STATION = { x: 92, y: 82, size: 7 };

const LAMPS: Array<[number, number]> = [
  [24, 44],
  [118, 52],
  [40, 118],
  [130, 126],
];

type MotionId =
  | "still"
  | "breath"
  | "flow"
  | "walker"
  | "ripple"
  | "mist"
  | "glint"
  | "alleys"
  | "sway"
  | "lamps"
  | "paper";

const SAMPLES: Array<{
  id: MotionId;
  name: string;
  look: string;
  blurb: string;
}> = [
  {
    id: "still",
    name: "基準（動きなし）",
    look: "比較用",
    blurb: "いまのトップと同じ、止まっている地図です。下の案と並べて見比べてください。",
  },
  {
    id: "breath",
    name: "駅の息",
    look: "中央の四角（駅）",
    blurb: "駅の四角が、息をするようにゆっくり小さくなったり戻ったりします。",
  },
  {
    id: "flow",
    name: "川の流れ",
    look: "太い川の線",
    blurb: "川の線の上を、破線が下へ流れていきます。水が動いている感じです。",
  },
  {
    id: "walker",
    name: "通りのひと粒",
    look: "下の横道",
    blurb: "地図の下の太い横道を、黒い点が左から右へ歩いていきます。",
  },
  {
    id: "ripple",
    name: "駅からの波紋",
    look: "中央の駅のまわり",
    blurb: "駅から薄い丸が広がって、消えます。石を落としたあとの波紋に近いです。",
  },
  {
    id: "mist",
    name: "薄い霧",
    look: "地図全体の白っぽさ",
    blurb: "白い霧が、左右にゆっくり移動します。景色がかすむ感じです。",
  },
  {
    id: "glint",
    name: "合流のきらめき",
    look: "川の線の上",
    blurb: "川の上を、小さな点が上流から下流へ流れていきます。",
  },
  {
    id: "alleys",
    name: "路地が薄く点く",
    look: "細い道の一部",
    blurb: "細い道が、交互に濃くなったり薄くなったりします。路地に明かりが点く感じです。",
  },
  {
    id: "sway",
    name: "風で揺れる",
    look: "地図全体",
    blurb: "地図全体が、紙のように左右へわずかに傾きます。",
  },
  {
    id: "lamps",
    name: "点の灯り",
    look: "四隅あたりの点",
    blurb: "街区のあちこちに点があり、順番に明るく点いて消えます。",
  },
  {
    id: "paper",
    name: "地図の呼吸",
    look: "地図全体の濃さ",
    blurb: "線も駅もまとめて、全体がゆっくり濃くなったり薄くなったりします。",
  },
];

function BaseMap({
  id,
  softRoads = false,
}: {
  id: MotionId;
  softRoads?: boolean;
}) {
  return (
    <g className="hmm-map-root">
      <path className="hmm-bank" d={RIVERS} />
      {ROADS.map((d) => {
        const soft = softRoads && SOFT_ROADS.includes(d);
        return (
          <path
            key={d}
            className={soft ? "hmm-road hmm-road-soft" : "hmm-road"}
            d={d}
          />
        );
      })}
      <rect
        className="hmm-station"
        x={STATION.x - STATION.size / 2}
        y={STATION.y - STATION.size / 2}
        width={STATION.size}
        height={STATION.size}
        rx="1"
      />
      {id === "walker" ? (
        <circle className="hmm-walker" r="2.1" cx="0" cy="0" />
      ) : null}
      {id === "ripple" ? (
        <circle className="hmm-ripple" cx={STATION.x} cy={STATION.y} r="6" />
      ) : null}
      {id === "glint" ? (
        <circle className="hmm-glint" r="2.2" cx="0" cy="0" />
      ) : null}
      {id === "lamps"
        ? LAMPS.map(([x, y], i) => (
            <circle
              key={`${x}-${y}`}
              className="hmm-lamp"
              cx={x}
              cy={y}
              r="2"
              style={{ animationDelay: `${i * 1.2}s` }}
            />
          ))
        : null}
      {id === "mist" ? (
        <g className="hmm-mist">
          <defs>
            <radialGradient id="mist-grad" cx="35%" cy="40%" r="58%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect
            x="0"
            y="0"
            width={VIEW.w}
            height={VIEW.h}
            fill="url(#mist-grad)"
          />
        </g>
      ) : null}
    </g>
  );
}

function Card({
  id,
  name,
  look,
  blurb,
  index,
}: {
  id: MotionId;
  name: string;
  look: string;
  blurb: string;
  index: number;
}) {
  const label = id === "still" ? "基準" : String(index).padStart(2, "0");
  return (
    <article className={`hmm-card hmm--${id}${id === "still" ? " hmm-card--still" : ""}`}>
      <div className="hmm-slot">
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden>
          <BaseMap id={id} softRoads={id === "alleys"} />
        </svg>
      </div>
      <h2>
        <span className="hmm-num">{label}</span>
        {name}
      </h2>
      <p className="hmm-look">
        見てほしいところ：<strong>{look}</strong>
      </p>
      <p>{blurb}</p>
    </article>
  );
}

export default function Samples() {
  return (
    <main className="hmm-page">
      <header className="hmm-head">
        <p className="hmm-kicker">見知らぬ駅 · トップ抽象地図</p>
        <h1 className="hmm-title">わずかな動き · 10案</h1>
        <p className="hmm-lead">
          いちばん上の「基準」が、いまの止まっている地図です。その下の10案は、どこが動くかを一文で書いてあります。気に入った番号を教えてください。
        </p>
      </header>
      <div className="hmm-grid">
        {SAMPLES.map((sample, index) => (
          <Card key={sample.id} {...sample} index={index} />
        ))}
      </div>
    </main>
  );
}
