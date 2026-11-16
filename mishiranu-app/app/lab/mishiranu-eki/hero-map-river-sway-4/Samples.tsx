"use client";

const VIEW = { w: 160, h: 168 };

/** 平常の川（採用地図と同じ） */
const WEST = "M52 4 C50 28, 52 48, 56 64 C60 76, 64 84, 70 90";
const EAST = "M148 20 C128 34, 108 50, 90 68 C82 76, 76 84, 70 90";
const SOUTH = "M70 90 C72 108, 74 126, 76 144 C77 154, 78 160, 80 168";

/** 左へなびく */
const WEST_L = "M52 4 C44 30, 46 50, 52 66 C56 78, 62 86, 70 90";
const EAST_L = "M148 20 C122 36, 102 52, 84 70 C76 78, 72 86, 70 90";
const SOUTH_L = "M70 90 C66 110, 68 128, 70 146 C72 156, 74 162, 80 168";

/** 右へなびく */
const WEST_R = "M52 4 C56 28, 58 48, 60 64 C64 76, 68 84, 70 90";
const EAST_R = "M148 20 C134 32, 114 48, 96 66 C88 74, 80 84, 70 90";
const SOUTH_R = "M70 90 C78 108, 80 126, 82 144 C82 154, 82 162, 80 168";

/** うねりA（左右に山） */
const WEST_A = "M52 4 C42 26, 58 46, 50 64 C62 74, 58 86, 70 90";
const EAST_A = "M148 20 C136 28, 100 54, 94 66 C78 74, 74 86, 70 90";
const SOUTH_A = "M70 90 C62 108, 80 124, 70 144 C78 154, 74 162, 80 168";

/** うねりB（逆位相） */
const WEST_B = "M52 4 C58 26, 44 48, 60 64 C54 78, 66 86, 70 90";
const EAST_B = "M148 20 C120 40, 116 48, 86 70 C90 76, 72 84, 70 90";
const SOUTH_B = "M70 90 C78 106, 66 128, 82 144 C72 156, 82 160, 80 168";

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

type SwayId = "ribbon" | "wind" | "travel" | "soft";

const SAMPLES: Array<{
  id: SwayId;
  name: string;
  look: string;
  craft: string;
  blurb: string;
}> = [
  {
    id: "ribbon",
    name: "リボンのように",
    look: "川の線の形そのもの",
    craft: "工夫: 線の形を、うねった形へ行き来させる",
    blurb:
      "川の線が、布のリボンみたいに左右へうねります。地図全体は動かず、線の曲がり方だけが変わります。",
  },
  {
    id: "wind",
    name: "風に流される",
    look: "川が左右どちらへ寄るか",
    craft: "工夫: 三本まとめて、左へなびく形 ↔ 右へなびく形",
    blurb:
      "川全体が、左へ寄ったり右へ寄ったりします。一本の草が風でなびく感じに近いです。",
  },
  {
    id: "travel",
    name: "波が下へ流れる",
    look: "うねりの山が下流へ進む様子",
    craft: "工夫: 西・東・南で、なびくタイミングをずらす",
    blurb:
      "上流が先にうねり、少し遅れて下流がうねります。波が川を下っていくように見えます。",
  },
  {
    id: "soft",
    name: "太い影も一緒に",
    look: "濃い線と、その横の薄い線",
    craft: "工夫: 薄い太い川と濃い細い川を、少しずらしてなびかせる",
    blurb:
      "薄い影の川と、はっきりした川が、少し違うタイミングでなびきます。水の厚みがある感じです。",
  },
];

function RoadsAndStation() {
  return (
    <>
      {ROADS.map((d) => (
        <path key={d} className="hrs-road" d={d} />
      ))}
      <rect
        className="hrs-station"
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
  className,
  from,
  mid,
  to,
  dur,
  begin = "0s",
}: {
  className: string;
  from: string;
  mid: string;
  to: string;
  dur: string;
  begin?: string;
}) {
  return (
    <path className={className} d={from}>
      <animate
        attributeName="d"
        values={`${from};${mid};${to};${mid};${from}`}
        keyTimes="0;0.25;0.5;0.75;1"
        dur={dur}
        begin={begin}
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
      />
    </path>
  );
}

function RiverMap({ id }: { id: SwayId }) {
  if (id === "ribbon") {
    return (
      <g>
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={WEST}
          mid={WEST_A}
          to={WEST_B}
          dur="4.5s"
        />
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={EAST}
          mid={EAST_A}
          to={EAST_B}
          dur="4.5s"
        />
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={SOUTH}
          mid={SOUTH_A}
          to={SOUTH_B}
          dur="4.5s"
        />
        <RoadsAndStation />
      </g>
    );
  }

  if (id === "wind") {
    return (
      <g>
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={WEST}
          mid={WEST_L}
          to={WEST_R}
          dur="5.2s"
        />
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={EAST}
          mid={EAST_L}
          to={EAST_R}
          dur="5.2s"
        />
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={SOUTH}
          mid={SOUTH_L}
          to={SOUTH_R}
          dur="5.2s"
        />
        <RoadsAndStation />
      </g>
    );
  }

  if (id === "travel") {
    return (
      <g>
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={WEST}
          mid={WEST_A}
          to={WEST_B}
          dur="3.8s"
          begin="0s"
        />
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={EAST}
          mid={EAST_A}
          to={EAST_B}
          dur="3.8s"
          begin="0.35s"
        />
        <MorphPath
          className="hrs-bank hrs-bank--loud"
          from={SOUTH}
          mid={SOUTH_A}
          to={SOUTH_B}
          dur="3.8s"
          begin="0.85s"
        />
        <RoadsAndStation />
      </g>
    );
  }

  return (
    <g>
      <MorphPath
        className="hrs-bank hrs-bank--soft"
        from={WEST}
        mid={WEST_L}
        to={WEST_R}
        dur="5.8s"
        begin="0s"
      />
      <MorphPath
        className="hrs-bank hrs-bank--soft"
        from={EAST}
        mid={EAST_L}
        to={EAST_R}
        dur="5.8s"
        begin="0s"
      />
      <MorphPath
        className="hrs-bank hrs-bank--soft"
        from={SOUTH}
        mid={SOUTH_L}
        to={SOUTH_R}
        dur="5.8s"
        begin="0s"
      />
      <MorphPath
        className="hrs-bank hrs-bank--loud"
        from={WEST}
        mid={WEST_R}
        to={WEST_L}
        dur="5.8s"
        begin="0.4s"
      />
      <MorphPath
        className="hrs-bank hrs-bank--loud"
        from={EAST}
        mid={EAST_R}
        to={EAST_L}
        dur="5.8s"
        begin="0.4s"
      />
      <MorphPath
        className="hrs-bank hrs-bank--loud"
        from={SOUTH}
        mid={SOUTH_R}
        to={SOUTH_L}
        dur="5.8s"
        begin="0.4s"
      />
      <RoadsAndStation />
    </g>
  );
}

export default function Samples() {
  return (
    <main className="hrs-page">
      <header className="hrs-head">
        <p className="hrs-kicker">見知らぬ駅 · トップ抽象地図</p>
        <h1 className="hrs-title">川の線がなびく · 4案</h1>
        <p className="hrs-lead">
          道と駅は止めたまま、川の線の形だけが風になびくように変わります。地図が平行移動するのではなく、線そのものがうねります。気に入った番号を教えてください。
        </p>
      </header>
      <div className="hrs-grid">
        {SAMPLES.map((sample, index) => (
          <article key={sample.id} className={`hrs-card hrs--${sample.id}`}>
            <div className="hrs-slot">
              <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden>
                <RiverMap id={sample.id} />
              </svg>
            </div>
            <h2>
              <span className="hrs-num">
                {String(index + 1).padStart(2, "0")}
              </span>
              {sample.name}
            </h2>
            <p className="hrs-look">
              見てほしいところ：<strong>{sample.look}</strong>
            </p>
            <p className="hrs-look">{sample.craft}</p>
            <p>{sample.blurb}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
