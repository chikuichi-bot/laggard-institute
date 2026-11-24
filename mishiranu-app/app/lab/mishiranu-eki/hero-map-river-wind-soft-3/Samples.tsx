"use client";

const VIEW = { w: 160, h: 168 };

/** 平常（採用地図） */
const WEST = "M52 4 C50 28, 52 48, 56 64 C60 76, 64 84, 70 90";
const EAST = "M148 20 C128 34, 108 50, 90 68 C82 76, 76 84, 70 90";
const SOUTH = "M70 90 C72 108, 74 126, 76 144 C77 154, 78 160, 80 168";

/**
 * 02「風に流される」よりずっと弱い左右なびき。
 * 制御点のずれは 1〜2px 程度。
 */
const WEST_L1 = "M52 4 C48 28, 50 48, 54 64 C58 76, 63 84, 70 90";
const EAST_L1 = "M148 20 C126 34, 106 50, 88 68 C80 76, 75 84, 70 90";
const SOUTH_L1 = "M70 90 C70 108, 72 126, 74 144 C76 154, 77 160, 80 168";

const WEST_R1 = "M52 4 C52 28, 54 48, 58 64 C62 76, 65 84, 70 90";
const EAST_R1 = "M148 20 C130 34, 110 50, 92 68 C84 76, 77 84, 70 90";
const SOUTH_R1 = "M70 90 C74 108, 76 126, 78 144 C78 154, 79 160, 80 168";

/** さらに弱い */
const WEST_L2 = "M52 4 C49 28, 51 48, 55 64 C59 76, 63.5 84, 70 90";
const EAST_L2 = "M148 20 C127 34, 107 50, 89 68 C81 76, 75.5 84, 70 90";
const SOUTH_L2 = "M70 90 C71 108, 73 126, 75 144 C76.5 154, 77.5 160, 80 168";

const WEST_R2 = "M52 4 C51 28, 53 48, 57 64 C61 76, 64.5 84, 70 90";
const EAST_R2 = "M148 20 C129 34, 109 50, 91 68 C83 76, 76.5 84, 70 90";
const SOUTH_R2 = "M70 90 C73 108, 75 126, 77 144 C77.5 154, 78.5 160, 80 168";

/** 中流だけわずかに（上流・河口はほぼ固定） */
const WEST_L3 = "M52 4 C50 28, 50 48, 54 64 C59 76, 64 84, 70 90";
const EAST_L3 = "M148 20 C128 34, 106 50, 89 68 C81 76, 76 84, 70 90";
const SOUTH_L3 = "M70 90 C71 108, 73 126, 75.5 144 C77 154, 78 160, 80 168";

const WEST_R3 = "M52 4 C50 28, 54 48, 58 64 C61 76, 64 84, 70 90";
const EAST_R3 = "M148 20 C128 34, 110 50, 91 68 C83 76, 76 84, 70 90";
const SOUTH_R3 = "M70 90 C73 108, 75 126, 76.5 144 C77 154, 78 160, 80 168";

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

type SoftId = "soft-a" | "soft-b" | "soft-c";

const SAMPLES: Array<{
  id: SoftId;
  name: string;
  look: string;
  craft: string;
  blurb: string;
}> = [
  {
    id: "soft-a",
    name: "控えめな風",
    look: "川が左右へ、ほんの少し寄るところ",
    craft: "工夫: 02と同じ左右なびきを、ずれ幅だけ小さくした",
    blurb:
      "02の動きそのものですが、曲がりの変化をかなり弱くしています。じっと見るとなびいているのがわかります。",
  },
  {
    id: "soft-b",
    name: "ほぼ静止に近い",
    look: "川の線の、ごく弱い揺れ",
    craft: "工夫: さらに弱くし、周期も長くした",
    blurb:
      "いちばん弱い案です。チラッと見ただけでは止まりに見えて、眺めていると線がわずかに寄ります。",
  },
  {
    id: "soft-c",
    name: "中流だけなびく",
    look: "合流の手前〜下流のあたり",
    craft: "工夫: 端はほぼ止め、真ん中だけ左右へ",
    blurb:
      "川の両端はほとんど動かず、中ほどだけが風に流されるように寄ります。動きの場所が限られるので目立ちにくいです。",
  },
];

function RoadsAndStation() {
  return (
    <>
      {ROADS.map((d) => (
        <path key={d} className="hrw-road" d={d} />
      ))}
      <rect
        className="hrw-station"
        x={STATION.x - STATION.size / 2}
        y={STATION.y - STATION.size / 2}
        width={STATION.size}
        height={STATION.size}
        rx="1"
      />
    </>
  );
}

function MorphPath({
  from,
  left,
  right,
  dur,
}: {
  from: string;
  left: string;
  right: string;
  dur: string;
}) {
  return (
    <path className="hrw-bank" d={from}>
      <animate
        attributeName="d"
        values={`${from};${left};${from};${right};${from}`}
        keyTimes="0;0.25;0.5;0.75;1"
        dur={dur}
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
      />
    </path>
  );
}

function RiverMap({ id }: { id: SoftId }) {
  if (id === "soft-a") {
    return (
      <g>
        <MorphPath from={WEST} left={WEST_L1} right={WEST_R1} dur="7.5s" />
        <MorphPath from={EAST} left={EAST_L1} right={EAST_R1} dur="7.5s" />
        <MorphPath from={SOUTH} left={SOUTH_L1} right={SOUTH_R1} dur="7.5s" />
        <RoadsAndStation />
      </g>
    );
  }

  if (id === "soft-b") {
    return (
      <g>
        <MorphPath from={WEST} left={WEST_L2} right={WEST_R2} dur="11s" />
        <MorphPath from={EAST} left={EAST_L2} right={EAST_R2} dur="11s" />
        <MorphPath from={SOUTH} left={SOUTH_L2} right={SOUTH_R2} dur="11s" />
        <RoadsAndStation />
      </g>
    );
  }

  return (
    <g>
      <MorphPath from={WEST} left={WEST_L3} right={WEST_R3} dur="8.5s" />
      <MorphPath from={EAST} left={EAST_L3} right={EAST_R3} dur="8.5s" />
      <MorphPath from={SOUTH} left={SOUTH_L3} right={SOUTH_R3} dur="8.5s" />
      <RoadsAndStation />
    </g>
  );
}

export default function Samples() {
  return (
    <main className="hrw-page">
      <header className="hrw-head">
        <p className="hrw-kicker">見知らぬ駅 · トップ抽象地図</p>
        <h1 className="hrw-title">風に流される · 控えめ3案</h1>
        <p className="hrw-lead">
          先の02「風に流される」を、もっと目立たない強さにしたものです。左右になびく考え方はそのまま、揺れ幅だけを抑えています。気に入った番号を教えてください。
        </p>
      </header>
      <div className="hrw-grid">
        {SAMPLES.map((sample, index) => (
          <article key={sample.id} className="hrw-card">
            <div className="hrw-slot">
              <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden>
                <RiverMap id={sample.id} />
              </svg>
            </div>
            <h2>
              <span className="hrw-num">
                {String(index + 1).padStart(2, "0")}
              </span>
              {sample.name}
            </h2>
            <p className="hrw-look">
              見てほしいところ：<strong>{sample.look}</strong>
            </p>
            <p className="hrw-look">{sample.craft}</p>
            <p>{sample.blurb}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
