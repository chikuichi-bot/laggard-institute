type Pt = { x: number; y: number };

const station: Pt = { x: 196, y: 286 };
const north: Pt[] = [
  station,
  { x: 190, y: 210 },
  { x: 186, y: 128 },
  { x: 184, y: 42 },
];
const toOne: Pt[] = [station, { x: 168, y: 300 }, { x: 142, y: 304 }];
const toTwo: Pt[] = [
  { x: 142, y: 304 },
  { x: 108, y: 292 },
  { x: 78, y: 278 },
  { x: 52, y: 268 },
];

const pin1: Pt = { x: 142, y: 304 };
const pin2: Pt = { x: 52, y: 268 };

type Mark = Pt & { deg: number };

function segLen(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointAt(pts: Pt[], dist: number): Mark | null {
  let left = dist;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = segLen(a, b);
    if (len < 0.5) continue;
    if (left <= len) {
      const t = left / len;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        deg: (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI,
      };
    }
    left -= len;
  }
  return null;
}

function lengthOf(pts: Pt[]) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += segLen(pts[i - 1], pts[i]);
  return n;
}

function marksAt(pts: Pt[], distances: number[]) {
  return distances
    .map((d) => pointAt(pts, d))
    .filter((m): m is Mark => m != null);
}

function marksEvery(pts: Pt[], step: number, inset: number) {
  const total = lengthOf(pts);
  const distances: number[] = [];
  for (let d = inset; d < total - 22; d += step) distances.push(d);
  return marksAt(pts, distances);
}

function d(pts: Pt[]) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function Chevron({ x, y, deg }: Mark) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`}>
      <polygon
        points="0,-9 7,6.4 -7,6.4"
        fill="#2a241c"
        stroke="#f8f5ee"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Route({ marks }: { marks: Mark[] }) {
  return (
    <g>
      <path d={d(north)} fill="none" stroke="#2a241c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d(toOne)} fill="none" stroke="#2a241c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d(toTwo)} fill="none" stroke="#2a241c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {marks.map((m, i) => (
        <Chevron key={i} {...m} />
      ))}
      <NumberPin at={pin1} n="1" fill="#c5a059" />
      <NumberPin at={pin2} n="2" fill="#9a7a8c" />
      <Shop at={{ x: 228, y: 312 }} fill="#b5493a" />
      <Shop at={{ x: 236, y: 262 }} fill="#c5a059" />
      <Station />
    </g>
  );
}

function NumberPin({ at, n, fill }: { at: Pt; n: string; fill: string }) {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r="13" fill={fill} stroke="#f8f5ee" strokeWidth="2" />
      <text
        x={at.x}
        y={at.y + 4}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#fff"
        fontFamily="ui-sans-serif, sans-serif"
      >
        {n}
      </text>
    </g>
  );
}

function Shop({ at, fill }: { at: Pt; fill: string }) {
  return <circle cx={at.x} cy={at.y} r="8" fill={fill} stroke="#f8f5ee" strokeWidth="2" />;
}

function Station() {
  return (
    <g>
      <rect x="168" y="248" width="54" height="20" rx="10" fill="#6b7c8a" stroke="#fff" strokeWidth="2" />
      <text
        x="195"
        y="262"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#fff"
        fontFamily="ui-rounded, ui-sans-serif, sans-serif"
      >
        start
      </text>
      <circle cx={station.x} cy={station.y} r="15" fill="#2a241c" stroke="#f8f5ee" strokeWidth="2" />
      <text
        x={station.x}
        y={station.y + 4}
        textAnchor="middle"
        fontSize="11"
        fill="#f8f5ee"
        fontFamily="ui-sans-serif, sans-serif"
      >
        駅
      </text>
    </g>
  );
}

function MapPlate({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 320 430" role="img" className="rd-map">
      <rect width="320" height="430" fill="#e4eee6" />
      <path d="M40 0 C70 80 48 160 62 240 C74 310 40 370 58 430 L0 430 L0 0 Z" fill="#d5e4ea" />
      <path d="M0 250 H320 M70 0 V430 M150 40 H300 M40 160 H280" fill="none" stroke="#fff" strokeWidth="7" opacity="0.7" />
      <circle cx={station.x} cy={station.y} r="78" fill="none" stroke="#6b7c8a" strokeOpacity="0.45" />
      {children}
    </svg>
  );
}

const northLen = lengthOf(north);
const oneLen = lengthOf(toOne);
const twoLen = lengthOf(toTwo);

const samples: Array<{ id: string; name: string; blurb: string; marks: Mark[] }> = [
  {
    id: "fork",
    name: "A · 駅を出た分岐",
    blurb: "北へ一つ、西へ一つ。駅のすぐ外だけ。道の途中には置きません。",
    marks: [...marksAt(north, [78]), ...marksAt(toOne, [28])],
  },
  {
    id: "mid",
    name: "B · 区間のまんなか（散歩コース）",
    blurb: "行きの道なり実線＋区間に三角一つ。密な矢羽は使わない。帰りは描かない。",
    marks: [
      ...marksAt(north, [northLen * 0.5]),
      ...marksAt(toOne, [oneLen * 0.55]),
      ...marksAt(toTwo, [twoLen * 0.45]),
    ],
  },
  {
    id: "feather",
    name: "C · 線上の矢羽",
    blurb: "行きの線に沿って、間隔をあけた三角だけ。丸印にはしません。",
    marks: [...marksEvery(north, 52, 36), ...marksEvery(toOne, 40, 26), ...marksEvery(toTwo, 40, 24)],
  },
  {
    id: "arrive",
    name: "D · 次の場所の手前",
    blurb: "北の端、1、2に着く直前だけ。途中の道には置きません。",
    marks: [
      ...marksAt(north, [northLen - 28]),
      ...marksAt(toOne, [oneLen - 22]),
      ...marksAt(toTwo, [twoLen - 26]),
    ],
  },
];

export default function RouteDirectionSamples() {
  return (
    <div className="rd">
      <header className="rd-hero">
        <p className="rd-kicker">見知らぬ駅 · 出町柳の線</p>
        <h1>動線の進行方向 · 4案</h1>
        <p>
          いまの画面と同じく、駅から北へ一本、西へ 1、その先に 2 がある線です。印は行きの向きだけ。
          帰りは同じ道なので、向かい合う矢印は置いていません。以前の丸い矢印にはしていません。
        </p>
      </header>
      <div className="rd-grid">
        {samples.map((sample) => (
          <figure key={sample.id} id={sample.id} className="rd-card">
            <MapPlate>
              <Route marks={sample.marks} />
            </MapPlate>
            <figcaption>
              <strong>{sample.name}</strong>
              <span>{sample.blurb}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
