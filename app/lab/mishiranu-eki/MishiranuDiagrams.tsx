/** 簡単な図解（会話の流れ / 徒歩圏の見方） */

export function FlowDiagram() {
  return (
    <figure className="mishiranu-diagram" aria-label="使い方の図解">
      <svg
        className="mishiranu-diagram-svg mishiranu-diagram-svg--flow"
        viewBox="0 0 360 72"
        role="img"
        aria-labelledby="flow-diagram-title"
      >
        <title id="flow-diagram-title">駅から時間、重点、物語までの流れ</title>
        <FlowStep x={28} label="駅" />
        <Chevron x={64} />
        <FlowStep x={124} label="時間" />
        <Chevron x={160} />
        <FlowStep x={220} label="重点" />
        <Chevron x={256} />
        <FlowStep x={316} label="物語" warm />
      </svg>
      <figcaption className="mishiranu-diagram-cap">
        会話で3つ答えると、徒歩圏の案内が開きます
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

function FlowStep({
  x,
  label,
  warm = false,
}: {
  x: number;
  label: string;
  warm?: boolean;
}) {
  return (
    <g>
      <circle
        className={
          warm
            ? "mishiranu-diagram-node mishiranu-diagram-node--warm"
            : "mishiranu-diagram-node"
        }
        cx={x}
        cy={28}
        r={18}
      />
      <text
        className={
          warm
            ? "mishiranu-diagram-node-label mishiranu-diagram-node-label--on-warm"
            : "mishiranu-diagram-node-label"
        }
        x={x}
        y={32}
      >
        {label}
      </text>
    </g>
  );
}

function Chevron({ x }: { x: number }) {
  return (
    <path
      className="mishiranu-diagram-arrow"
      d={`M${x} 22 L${x + 10} 28 L${x} 34`}
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
