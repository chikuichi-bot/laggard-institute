/** サーバーのみ。JS不要 — 兄弟ラジオ + label[for] + :checked ~ */
import { TUTORIAL_PAGES } from "../tutorial-copy";

const PAGES = TUTORIAL_PAGES.map((p, i) => {
  if (p.verseLines?.length) {
    return {
      id: `p${i}`,
      tab: "詩",
      title: "帰りの電車 · 詩",
      story: p.verseLines.join(" · "),
    };
  }
  return {
    id: `p${i}`,
    tab: p.kicker?.replace(/·.*/, "").trim() || String(i + 1),
    title: p.title,
    story: p.quote
      ? p.quote.slice(0, 48) + "…"
      : (p.bodies[0] ?? p.title),
  };
});

/** タブ短縮名（物語に合う一言） */
const TAB_NAMES = [
  "詩",
  "降りる",
  "名前",
  "ホーム",
  "聴く",
  "歩く",
  "帰る",
] as const;

export default function TutorialStorySamples() {
  return (
    <div className="ts7-shell">
      <header className="ts7-head">
        <p className="ts7-kicker">見知らぬ駅 · ラボ</p>
        <h1 className="ts7-title">チュートリアル · 物語アニメ</h1>
        <p className="ts7-lede">
          1ページに1本。そのページの言葉の物語を、モノクロの小さな動きで見せます。上の言葉を押すと切り替わります（JS不要）。
        </p>
      </header>

      <div className="ts7-switch">
        {PAGES.map((p, i) => (
          <input
            key={p.id}
            type="radio"
            name="ts7-page"
            id={`ts7-${p.id}`}
            className={`ts7-radio ts7-radio--${i}`}
            defaultChecked={i === 0}
          />
        ))}

        <div className="ts7-tabs" role="radiogroup" aria-label="チュートリアルページ">
          {PAGES.map((p, i) => (
            <label
              key={p.id}
              htmlFor={`ts7-${p.id}`}
              className={`ts7-tab ts7-tab--${i}`}
            >
              <span className="ts7-tab-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="ts7-tab-name">{TAB_NAMES[i]}</span>
            </label>
          ))}
        </div>

        <div className="ts7-stage">
          <div className="ts7-phone">
            <svg
              className="ts7-svg"
              viewBox="0 0 240 420"
              role="img"
              aria-label="チュートリアル物語アニメ"
            >
              <rect width="240" height="420" fill="#f7f4ec" />
              <Scene0 />
              <Scene1 />
              <Scene2 />
              <Scene3 />
              <Scene4 />
              <Scene5 />
              <Scene6 />
            </svg>
          </div>

          <aside className="ts7-aside">
            {PAGES.map((p, i) => (
              <div key={p.id} className={`ts7-aside-panel ts7-aside-panel--${i}`}>
                <p className="ts7-now">
                  ページ {i + 1} · <strong>{p.title}</strong>
                </p>
                <p className="ts7-hint">{p.story}</p>
                <p className="ts7-motif">{MOTIFS[i]}</p>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}

const MOTIFS = [
  "窓の外を流れる明かりと、特急の揺れ。",
  "空っぽの駅名から、足がホームへ降り立つ。",
  "ラベルが貼られた瞬間、鳥（土地）は見えなくなる。",
  "ドアが開き、物語のひとかけらが届く。",
  "声の輪が拡がり、川と坂が目の前に重なる。",
  "点だけが灯り、線のない道を歩く。",
  "同じ駅名に、自分の散歩道が戻ってくる。",
] as const;

/* —— 0 詩：夜の京阪 · 窓の明かり —— */
function Scene0() {
  return (
    <g className="ts7-panel ts7-panel--0">
      <rect x="18" y="36" width="204" height="348" fill="none" stroke="#111" strokeWidth="2" />
      <rect x="28" y="56" width="130" height="200" fill="none" stroke="#111" strokeWidth="1.4" />
      <line x1="93" y1="56" x2="93" y2="256" stroke="#111" strokeWidth="1" opacity="0.35" />
      <defs>
        <clipPath id="ts7-win0">
          <rect x="28" y="56" width="130" height="200" />
        </clipPath>
      </defs>
      <g clipPath="url(#ts7-win0)">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect
            key={i}
            className="ts7-s0-light"
            x={-30}
            y={68 + i * 26}
            width={14 + (i % 3) * 12}
            height="2"
            fill="#111"
            opacity={0.4}
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
        <text
          className="ts7-s0-station"
          x="160"
          y="140"
          fill="#111"
          fontSize="11"
          fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
          opacity="0.55"
        >
          通過
        </text>
      </g>
      <path d="M165 250 H214 V328 H165 Z" fill="none" stroke="#111" strokeWidth="1.3" />
      <g className="ts7-s0-body">
        <circle cx="190" cy="175" r="14" fill="none" stroke="#111" strokeWidth="1.7" />
        <path
          d="M190 191 C182 204 176 230 178 262 L202 262 C204 230 198 204 190 191 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.7"
        />
      </g>
      <text
        x="120"
        y="370"
        textAnchor="middle"
        fill="#111"
        fontSize="10"
        opacity="0.55"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        夜の京阪 · 明かりが流れる
      </text>
    </g>
  );
}

/* —— 1 降りる：空っぽの名 → 足が降りる —— */
function Scene1() {
  return (
    <g className="ts7-panel ts7-panel--1">
      <rect x="18" y="36" width="204" height="348" fill="none" stroke="#111" strokeWidth="2" />
      <rect
        className="ts7-s1-plate"
        x="48"
        y="72"
        width="144"
        height="44"
        fill="none"
        stroke="#111"
        strokeWidth="1.5"
      />
      <text
        className="ts7-s1-name"
        x="120"
        y="100"
        textAnchor="middle"
        fill="#111"
        fontSize="16"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
        letterSpacing="0.35em"
      >
        駅
      </text>
      {/* ホーム */}
      <line x1="36" y1="300" x2="204" y2="300" stroke="#111" strokeWidth="1.4" />
      <g className="ts7-s1-figure">
        <circle cx="120" cy="210" r="12" fill="none" stroke="#111" strokeWidth="1.6" />
        <path
          d="M120 224 C112 240 110 268 112 292 L128 292 C130 268 128 240 120 224 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.6"
        />
        <path
          className="ts7-s1-legs"
          d="M114 292 L108 318 M126 292 L132 318"
          fill="none"
          stroke="#111"
          strokeWidth="1.5"
        />
      </g>
      {/* 散歩の点 */}
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          className="ts7-s1-dot"
          cx={70 + i * 32}
          cy={340}
          r="3"
          fill="#111"
          style={{ animationDelay: `${1.2 + i * 0.25}s` }}
        />
      ))}
      <text
        x="120"
        y="380"
        textAnchor="middle"
        fill="#111"
        fontSize="10"
        opacity="0.55"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        名前だけ → 散歩道
      </text>
    </g>
  );
}

/* —— 2 名前：ラベルが貼られ、鳥が見えなくなる —— */
function Scene2() {
  return (
    <g className="ts7-panel ts7-panel--2">
      <rect x="18" y="36" width="204" height="348" fill="none" stroke="#111" strokeWidth="2" />
      <g className="ts7-s2-bird">
        <path
          d="M70 200 Q95 160 120 190 Q145 160 170 200 Q145 185 120 210 Q95 185 70 200 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.6"
        />
        <circle cx="148" cy="178" r="2.5" fill="#111" />
      </g>
      <g className="ts7-s2-label">
        <rect x="88" y="168" width="64" height="28" fill="#f7f4ec" stroke="#111" strokeWidth="1.4" />
        <text
          x="120"
          y="187"
          textAnchor="middle"
          fill="#111"
          fontSize="13"
          fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
        >
          鳥
        </text>
      </g>
      <text
        className="ts7-s2-fade"
        x="120"
        y="280"
        textAnchor="middle"
        fill="#111"
        fontSize="12"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
        opacity="0.7"
      >
        名前を知って、見なくなった
      </text>
      <line
        className="ts7-s2-strike"
        x1="55"
        y1="275"
        x2="185"
        y2="275"
        stroke="#111"
        strokeWidth="1"
      />
      <text
        x="120"
        y="370"
        textAnchor="middle"
        fill="#111"
        fontSize="10"
        opacity="0.55"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        クリシュナムルティの鳥
      </text>
    </g>
  );
}

/* —— 3 ホーム：ドアが開き、ひとかけら —— */
function Scene3() {
  return (
    <g className="ts7-panel ts7-panel--3">
      <rect x="18" y="36" width="204" height="348" fill="none" stroke="#111" strokeWidth="2" />
      {/* 電車枠 */}
      <rect x="40" y="80" width="160" height="200" fill="none" stroke="#111" strokeWidth="1.5" />
      <g className="ts7-s3-door-l">
        <rect x="40" y="80" width="80" height="200" fill="#f7f4ec" stroke="#111" strokeWidth="1.4" />
        <line x1="110" y1="100" x2="110" y2="260" stroke="#111" strokeWidth="1" opacity="0.35" />
      </g>
      <g className="ts7-s3-door-r">
        <rect x="120" y="80" width="80" height="200" fill="#f7f4ec" stroke="#111" strokeWidth="1.4" />
        <line x1="130" y1="100" x2="130" y2="260" stroke="#111" strokeWidth="1" opacity="0.35" />
      </g>
      <g className="ts7-s3-figure">
        <circle cx="120" cy="200" r="11" fill="none" stroke="#111" strokeWidth="1.5" />
        <path
          d="M120 213 C114 228 112 250 114 270 L126 270 C128 250 126 228 120 213 Z"
          fill="none"
          stroke="#111"
          strokeWidth="1.5"
        />
      </g>
      {/* 物語のかけら */}
      <g className="ts7-s3-scrap">
        <rect x="72" y="300" width="96" height="36" fill="none" stroke="#111" strokeWidth="1.2" />
        <line x1="84" y1="314" x2="156" y2="314" stroke="#111" strokeWidth="1" opacity="0.5" />
        <line x1="84" y1="324" x2="140" y2="324" stroke="#111" strokeWidth="1" opacity="0.35" />
      </g>
      <text
        x="120"
        y="370"
        textAnchor="middle"
        fill="#111"
        fontSize="10"
        opacity="0.55"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        ドアが開く · ゆかりひとかけら
      </text>
    </g>
  );
}

/* —— 4 聴く：声の輪と川・坂 —— */
function Scene4() {
  return (
    <g className="ts7-panel ts7-panel--4">
      <rect x="18" y="36" width="204" height="348" fill="none" stroke="#111" strokeWidth="2" />
      {/* 川 */}
      <path
        className="ts7-s4-river"
        d="M30 220 Q80 200 120 230 T210 210"
        fill="none"
        stroke="#111"
        strokeWidth="1.4"
      />
      <path
        className="ts7-s4-slope"
        d="M40 310 L100 250 L160 290 L210 240"
        fill="none"
        stroke="#111"
        strokeWidth="1.3"
        opacity="0.7"
      />
      {/* 耳・声 */}
      <circle cx="120" cy="140" r="16" fill="none" stroke="#111" strokeWidth="1.6" />
      <path
        d="M108 140 Q100 140 100 148 Q100 156 112 156"
        fill="none"
        stroke="#111"
        strokeWidth="1.4"
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          className="ts7-s4-ring"
          cx="120"
          cy="140"
          r={28 + i * 18}
          fill="none"
          stroke="#111"
          strokeWidth="1"
          style={{ animationDelay: `${i * 0.55}s` }}
        />
      ))}
      {/* ポケットへ沈むスマホ */}
      <rect
        className="ts7-s4-phone"
        x="168"
        y="300"
        width="28"
        height="48"
        rx="4"
        fill="none"
        stroke="#111"
        strokeWidth="1.3"
      />
      <text
        x="120"
        y="370"
        textAnchor="middle"
        fill="#111"
        fontSize="10"
        opacity="0.55"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        顔を上げて、声で土地を聴く
      </text>
    </g>
  );
}

/* —— 5 歩く：点だけ · 線なし —— */
function Scene5() {
  const spots = [
    { x: 70, y: 120 },
    { x: 150, y: 150 },
    { x: 90, y: 210 },
    { x: 160, y: 250 },
    { x: 100, y: 300 },
  ];
  return (
    <g className="ts7-panel ts7-panel--5">
      <rect x="18" y="36" width="204" height="348" fill="none" stroke="#111" strokeWidth="2" />
      {/* 地図の薄い枠 */}
      <rect x="36" y="70" width="168" height="260" fill="none" stroke="#111" strokeWidth="1" opacity="0.25" />
      {spots.map((s, i) => (
        <g key={i}>
          <circle
            className="ts7-s5-spot"
            cx={s.x}
            cy={s.y}
            r="5"
            fill="none"
            stroke="#111"
            strokeWidth="1.5"
            style={{ animationDelay: `${i * 0.45}s` }}
          />
          <circle
            className="ts7-s5-spot-core"
            cx={s.x}
            cy={s.y}
            r="2"
            fill="#111"
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        </g>
      ))}
      <g className="ts7-s5-walker">
        <circle cx="70" cy="120" r="7" fill="none" stroke="#111" strokeWidth="1.4" />
        <line x1="70" y1="127" x2="70" y2="142" stroke="#111" strokeWidth="1.4" />
      </g>
      <text
        x="120"
        y="370"
        textAnchor="middle"
        fill="#111"
        fontSize="10"
        opacity="0.55"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        点はある · ナビの線はない
      </text>
    </g>
  );
}

/* —— 6 帰る：同じ名が、散歩で満ちる —— */
function Scene6() {
  return (
    <g className="ts7-panel ts7-panel--6">
      <rect x="18" y="36" width="204" height="348" fill="none" stroke="#111" strokeWidth="2" />
      <text
        x="120"
        y="100"
        textAnchor="middle"
        fill="#111"
        fontSize="11"
        opacity="0.45"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        帰りの電車で
      </text>
      {/* 空っぽの名 */}
      <g className="ts7-s6-empty">
        <rect x="50" y="130" width="140" height="50" fill="none" stroke="#111" strokeWidth="1.4" opacity="0.35" />
        <text
          x="120"
          y="162"
          textAnchor="middle"
          fill="#111"
          fontSize="18"
          fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
          letterSpacing="0.4em"
          opacity="0.35"
        >
          駅名
        </text>
      </g>
      {/* 満ちた名 */}
      <g className="ts7-s6-full">
        <rect x="50" y="220" width="140" height="50" fill="none" stroke="#111" strokeWidth="1.6" />
        <text
          x="120"
          y="252"
          textAnchor="middle"
          fill="#111"
          fontSize="18"
          fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
          letterSpacing="0.4em"
        >
          駅名
        </text>
        {/* 名の中を通る散歩の点 */}
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            className="ts7-s6-dot"
            cx={70 + i * 25}
            cy={270}
            r="2.5"
            fill="#111"
            style={{ animationDelay: `${0.8 + i * 0.2}s` }}
          />
        ))}
      </g>
      <text
        x="120"
        y="360"
        textAnchor="middle"
        fill="#111"
        fontSize="10"
        opacity="0.55"
        fontFamily="Hiragino Mincho ProN, Yu Mincho, serif"
      >
        同じ名前なのに、空っぽではない
      </text>
    </g>
  );
}
