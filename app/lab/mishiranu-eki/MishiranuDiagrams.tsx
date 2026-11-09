/** 簡単な図解（会話の流れ / 3案ループ / 徒歩圏） */

export function FlowDiagram() {
  return (
    <figure className="mishiranu-diagram" aria-label="使い方の図解">
      <svg
        className="mishiranu-diagram-svg mishiranu-diagram-svg--flow"
        viewBox="0 0 392 64"
        role="img"
        aria-labelledby="flow-diagram-title"
      >
        <title id="flow-diagram-title">駅から時間、重点、物語までの流れ</title>
        <BoxNode x={8} y={16} w={72} label="駅" />
        <RightArrow x1={86} x2={104} y={32} />
        <BoxNode x={104} y={16} w={72} label="時間" />
        <RightArrow x1={182} x2={200} y={32} />
        <BoxNode x={200} y={16} w={72} label="重点" />
        <RightArrow x1={278} x2={296} y={32} />
        <BoxNode x={296} y={16} w={88} label="物語" warm />
      </svg>
      <figcaption className="mishiranu-diagram-cap">
        会話で3つ答えると、徒歩圏の案内が開きます
      </figcaption>
    </figure>
  );
}

/** 3案 → 選ぶ → 作る → 感想で磨く → また3案へ（プログラミング風ループ） */
export function PolishLoopDiagram() {
  return (
    <figure className="mishiranu-diagram mishiranu-diagram--code" aria-label="磨き方の図解">
      <p className="mishiranu-diagram-code-label" aria-hidden="true">
        while (磨く)
      </p>
      <svg
        className="mishiranu-diagram-svg mishiranu-diagram-svg--loop"
        viewBox="0 0 360 168"
        role="img"
        aria-labelledby="polish-loop-title"
      >
        <title id="polish-loop-title">
          3案を出して選び、作り、感想で磨いてまた戻るループ
        </title>
        <defs>
          <marker
            id="mk-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="mishiranu-diagram-marker" />
          </marker>
        </defs>

        <BoxNode x={18} y={18} w={88} label="3案" />
        <path
          className="mishiranu-diagram-arrow-line"
          d="M106 36 H132"
          markerEnd="url(#mk-arrow)"
        />
        <BoxNode x={132} y={18} w={88} label="選ぶ" />
        <path
          className="mishiranu-diagram-arrow-line"
          d="M220 36 H246"
          markerEnd="url(#mk-arrow)"
        />
        <BoxNode x={246} y={18} w={96} label="作る" warm />

        {/* 下へ */}
        <path
          className="mishiranu-diagram-arrow-line"
          d="M294 54 V78"
          markerEnd="url(#mk-arrow)"
        />

        <BoxNode x={214} y={86} w={128} label="感想で磨く" />

        {/* 左へ戻って 3案 の下へ、上向き矢印でループ */}
        <path
          className="mishiranu-diagram-arrow-line"
          d="M214 110 H62 V54"
          markerEnd="url(#mk-arrow)"
        />

        <text className="mishiranu-diagram-loop-tag" x={118} y={142}>
          ← loop
        </text>
      </svg>
      <figcaption className="mishiranu-diagram-cap">
        3案を出して選び、作って、感想でまた前に戻る
      </figcaption>
    </figure>
  );
}

export function RadiusDiagram({
  stationName,
  radiusKm,
}: {
  stationName: string;
  radiusKm: number;
}) {
  return (
    <figure className="mishiranu-diagram" aria-label="徒歩圏の図解">
      <svg
        className="mishiranu-diagram-svg mishiranu-diagram-svg--radius"
        viewBox="0 0 280 168"
        role="img"
        aria-labelledby="radius-diagram-title"
      >
        <title id="radius-diagram-title">
          {stationName}駅を中心にした徒歩約{radiusKm}キロの案内
        </title>
        <circle
          className="mishiranu-diagram-ring mishiranu-diagram-ring--outer"
          cx="140"
          cy="88"
          r="62"
        />
        <circle className="mishiranu-diagram-ring" cx="140" cy="88" r="38" />
        <circle className="mishiranu-diagram-station" cx="140" cy="88" r="7" />
        <text className="mishiranu-diagram-station-label" x="140" y="110">
          {stationName}
        </text>
        <GuideDot cx={108} cy={58} fill="#e85a2f" />
        <GuideDot cx={168} cy={52} fill="#4f8f7a" />
        <GuideDot cx={178} cy={98} fill="#5b7cfa" />
        <GuideDot cx={112} cy={118} fill="#c47a2c" />
        <GuideDot cx={152} cy={124} fill="#8a6bb5" />
        <text className="mishiranu-diagram-km" x="204" y="38">
          約 {radiusKm} km
        </text>
      </svg>
      <figcaption className="mishiranu-diagram-cap">
        駅を中心に、徒歩圏だけを色つきピンで案内します
      </figcaption>
    </figure>
  );
}

function BoxNode({
  x,
  y,
  w,
  label,
  warm = false,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  warm?: boolean;
}) {
  const h = 36;
  return (
    <g>
      <rect
        className={
          warm
            ? "mishiranu-diagram-box mishiranu-diagram-box--warm"
            : "mishiranu-diagram-box"
        }
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
      />
      <text
        className={
          warm
            ? "mishiranu-diagram-box-label mishiranu-diagram-box-label--on-warm"
            : "mishiranu-diagram-box-label"
        }
        x={x + w / 2}
        y={y + h / 2 + 4}
      >
        {label}
      </text>
    </g>
  );
}

function RightArrow({
  x1,
  x2,
  y,
}: {
  x1: number;
  x2: number;
  y: number;
}) {
  return (
    <path
      className="mishiranu-diagram-arrow"
      d={`M${x1} ${y} L${x2 - 6} ${y} M${x2 - 10} ${y - 5} L${x2} ${y} L${x2 - 10} ${y + 5}`}
      fill="none"
    />
  );
}

function GuideDot({
  cx,
  cy,
  fill,
}: {
  cx: number;
  cy: number;
  fill: string;
}) {
  return <circle cx={cx} cy={cy} r={5.5} fill={fill} opacity={0.92} />;
}
