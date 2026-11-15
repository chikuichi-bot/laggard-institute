/** サーバーのみ。JS不要 — 兄弟ラジオ + label[for] + :checked ~ で切替 */
import type { ReactNode } from "react";

const STYLES = [
  {
    id: "sway",
    name: "揺れ",
    blurb: "特急の揺れに合わせて、肩と頭が小さく左右する。",
  },
  {
    id: "gaze",
    name: "眺める",
    blurb: "窓の外へ視線をやる。明かりだけが後ろへ流れる。",
  },
  {
    id: "breath",
    name: "息",
    blurb: "ほとんど動かない。胸の線だけがゆっくり上下する。",
  },
  {
    id: "strap",
    name: "つり革",
    blurb: "立ってつり革を持つ。足もとと手が同じ拍子で揺れる。",
  },
] as const;

export default function TrainRiderSamples() {
  return (
    <div className="tr4-shell">
      <header className="tr4-head">
        <p className="tr4-kicker">見知らぬ駅 · ラボ</p>
        <h1 className="tr4-title">電車の人 · モーション4案</h1>
        <p className="tr4-lede">
          モノクロだけ。夜の京阪の車内で、人が動いている様子を4通りです。上の言葉を押すと切り替わります。
        </p>
      </header>

      {/* ラジオはパネルの兄弟。label は for で結ぶ（中に input を入れない） */}
      <div className="tr4-switch">
        {STYLES.map((s, i) => (
          <input
            key={s.id}
            type="radio"
            name="tr4-style"
            id={`tr4-${s.id}`}
            className={`tr4-radio tr4-radio--${s.id}`}
            defaultChecked={i === 0}
          />
        ))}

        <div className="tr4-styles" role="radiogroup" aria-label="動きの言葉">
          {STYLES.map((s) => (
            <label
              key={s.id}
              htmlFor={`tr4-${s.id}`}
              className={`tr4-style tr4-style--${s.id}`}
            >
              <span className="tr4-style-name">{s.name}</span>
              <span className="tr4-style-blurb">{s.blurb}</span>
            </label>
          ))}
        </div>

        <div className="tr4-stage">
          <div className="tr4-phone">
            <CabinFrame>
              <g className="tr4-panel tr4-panel--sway">
                <SwayRider />
              </g>
              <g className="tr4-panel tr4-panel--gaze">
                <GazeRider />
              </g>
              <g className="tr4-panel tr4-panel--breath">
                <BreathRider />
              </g>
              <g className="tr4-panel tr4-panel--strap">
                <StrapRider />
              </g>
            </CabinFrame>
          </div>
          <aside className="tr4-aside">
            {STYLES.map((s) => (
              <div
                key={s.id}
                className={`tr4-aside-panel tr4-aside-panel--${s.id}`}
              >
                <p className="tr4-now">
                  いま · <strong>{s.name}</strong>
                </p>
                <p className="tr4-hint">{s.blurb}</p>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}

function CabinFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      className="tr4-svg"
      viewBox="0 0 240 420"
      role="img"
      aria-label="電車の人のアニメーション"
    >
      <rect width="240" height="420" fill="#f7f4ec" />
      <rect
        x="18"
        y="36"
        width="204"
        height="348"
        fill="none"
        stroke="#111"
        strokeWidth="2"
      />
      <rect
        x="28"
        y="56"
        width="120"
        height="200"
        fill="none"
        stroke="#111"
        strokeWidth="1.4"
      />
      <line
        x1="88"
        y1="56"
        x2="88"
        y2="256"
        stroke="#111"
        strokeWidth="1"
        opacity="0.35"
      />
      <defs>
        <clipPath id="tr4-win">
          <rect x="28" y="56" width="120" height="200" />
        </clipPath>
      </defs>
      <g className="tr4-lights" clipPath="url(#tr4-win)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            className="tr4-light"
            x={-20}
            y={70 + i * 30}
            width={18 + (i % 3) * 10}
            height="2"
            fill="#111"
            opacity={0.35}
            style={{ animationDelay: `${i * 0.28}s` }}
          />
        ))}
      </g>
      {children}
    </svg>
  );
}

function SwayRider() {
  return (
    <g className="tr4-rider tr4-rider--sway">
      <path
        d="M150 250 H210 V330 H150 Z"
        fill="none"
        stroke="#111"
        strokeWidth="1.4"
      />
      <g className="tr4-body">
        <circle cx="178" cy="168" r="16" fill="none" stroke="#111" strokeWidth="1.8" />
        <path
          d="M178 186 C168 200 160 230 162 268 L194 268 C196 230 188 200 178 186 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.8"
        />
        <path
          d="M162 210 C150 220 148 245 152 268"
          fill="none"
          stroke="#111"
          strokeWidth="1.5"
        />
        <path
          d="M194 210 C204 222 206 245 202 268"
          fill="none"
          stroke="#111"
          strokeWidth="1.5"
        />
        <path
          d="M166 268 L160 312 M190 268 L196 312"
          fill="none"
          stroke="#111"
          strokeWidth="1.5"
        />
      </g>
    </g>
  );
}

function GazeRider() {
  return (
    <g className="tr4-rider tr4-rider--gaze">
      <path
        d="M150 250 H210 V330 H150 Z"
        fill="none"
        stroke="#111"
        strokeWidth="1.4"
      />
      <g className="tr4-torso">
        <path
          d="M178 190 C168 204 162 232 164 268 L192 268 C194 232 188 204 178 190 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.8"
        />
        <path
          d="M166 268 L160 312 M190 268 L196 312"
          fill="none"
          stroke="#111"
          strokeWidth="1.5"
        />
      </g>
      <g className="tr4-head">
        <circle cx="178" cy="168" r="16" fill="none" stroke="#111" strokeWidth="1.8" />
        <path
          className="tr4-gaze-line"
          d="M162 168 H40"
          fill="none"
          stroke="#111"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
      </g>
    </g>
  );
}

function BreathRider() {
  return (
    <g className="tr4-rider tr4-rider--breath">
      <path
        d="M150 250 H210 V330 H150 Z"
        fill="none"
        stroke="#111"
        strokeWidth="1.4"
      />
      <circle cx="178" cy="168" r="16" fill="none" stroke="#111" strokeWidth="1.8" />
      <g className="tr4-chest">
        <path
          d="M178 186 C168 200 160 230 162 268 L194 268 C196 230 188 200 178 186 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.8"
        />
      </g>
      <path
        d="M166 268 L160 312 M190 268 L196 312"
        fill="none"
        stroke="#111"
        strokeWidth="1.5"
      />
    </g>
  );
}

function StrapRider() {
  return (
    <g className="tr4-rider tr4-rider--strap">
      <line x1="120" y1="56" x2="120" y2="100" stroke="#111" strokeWidth="1.4" />
      <path
        className="tr4-strap"
        d="M108 100 Q120 118 132 100"
        fill="none"
        stroke="#111"
        strokeWidth="1.6"
      />
      <g className="tr4-stand">
        <circle cx="120" cy="150" r="15" fill="none" stroke="#111" strokeWidth="1.8" />
        <path
          d="M120 166 C112 180 108 220 110 270 L130 270 C132 220 128 180 120 166 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.8"
        />
        <path
          className="tr4-arm"
          d="M120 180 C118 150 118 125 120 105"
          fill="none"
          stroke="#111"
          strokeWidth="1.6"
        />
        <path
          className="tr4-legs"
          d="M112 270 L106 330 M128 270 L134 330"
          fill="none"
          stroke="#111"
          strokeWidth="1.6"
        />
      </g>
      <line
        className="tr4-floor"
        x1="40"
        y1="340"
        x2="200"
        y2="340"
        stroke="#111"
        strokeWidth="1"
        opacity="0.4"
      />
    </g>
  );
}
