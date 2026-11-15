"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { TUTORIAL_PAGES } from "../tutorial-copy";

/** 4つの想起の言葉。色は黒と紙色だけ。 */
const STYLES = [
  {
    id: "window",
    name: "窓",
    blurb: "横に流れる光。駅名が窓の外を通り過ぎる。",
  },
  {
    id: "peel",
    name: "剥離",
    blurb: "貼られた名前が薄れ、形だけが残る。",
  },
  {
    id: "dots",
    name: "点",
    blurb: "線は引かない。灯りだけが順に立つ。",
  },
  {
    id: "ear",
    name: "耳",
    blurb: "声の輪郭。円がゆっくり拡がる。",
  },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

function pageLabel(i: number) {
  const p = TUTORIAL_PAGES[i];
  if (p.verseLines?.length) return "詩 · 帰りの電車";
  if (p.kicker) return `${p.kicker} · ${p.title}`;
  return p.title;
}

function pageHint(i: number) {
  const p = TUTORIAL_PAGES[i];
  if (p.verseLines?.length) return p.verseLines.join(" / ");
  if (p.quote) return p.quote.slice(0, 42) + "…";
  return p.bodies[0] ?? p.title;
}

export default function TutorialMotionSamples() {
  const [style, setStyle] = useState<StyleId>("window");
  const [page, setPage] = useState(0);
  const [tick, setTick] = useState(0);
  const replay = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    replay();
  }, [style, page, replay]);

  return (
    <div className="tm4-shell">
      <header className="tm4-head">
        <p className="tm4-kicker">見知らぬ駅 · ラボ</p>
        <h1 className="tm4-title">チュートリアル想起アニメ · 4案</h1>
        <p className="tm4-lede">
          モノクロだけ。ページの文を、小さな動きで思い出させる案です。言葉を選んでからページを送ってください。
        </p>
      </header>

      <div className="tm4-styles" role="tablist" aria-label="アニメの言葉">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={style === s.id}
            className={
              style === s.id ? "tm4-style tm4-style--on" : "tm4-style"
            }
            onClick={() => setStyle(s.id)}
          >
            <span className="tm4-style-name">{s.name}</span>
            <span className="tm4-style-blurb">{s.blurb}</span>
          </button>
        ))}
      </div>

      <div className="tm4-stage">
        <div className="tm4-phone" key={`${style}-${page}-${tick}`}>
          <MotionScene style={style} page={page} />
        </div>
        <aside className="tm4-aside">
          <p className="tm4-page-label">{pageLabel(page)}</p>
          <p className="tm4-page-hint">{pageHint(page)}</p>
          <p className="tm4-style-now">
            いまの言葉 · <strong>{STYLES.find((s) => s.id === style)?.name}</strong>
          </p>
          <button type="button" className="tm4-replay" onClick={replay}>
            もう一度見る
          </button>
        </aside>
      </div>

      <nav className="tm4-pages" aria-label="チュートリアルページ">
        {TUTORIAL_PAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            className={i === page ? "tm4-dot tm4-dot--on" : "tm4-dot"}
            aria-label={pageLabel(i)}
            aria-current={i === page ? "true" : undefined}
            onClick={() => setPage(i)}
          />
        ))}
      </nav>
      <div className="tm4-page-nav">
        <button
          type="button"
          className="tm4-navbtn"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          前のページ
        </button>
        <button
          type="button"
          className="tm4-navbtn"
          disabled={page >= TUTORIAL_PAGES.length - 1}
          onClick={() =>
            setPage((p) => Math.min(TUTORIAL_PAGES.length - 1, p + 1))
          }
        >
          次のページ
        </button>
      </div>
    </div>
  );
}

function MotionScene({ style, page }: { style: StyleId; page: number }) {
  const uid = useId().replace(/:/g, "");
  // ページの主題（0詩 1降りる 2名前 3ホーム 4聴く 5歩く 6帰る）
  const motif =
    page === 0
      ? "train"
      : page === 1 || page === 3
        ? "door"
        : page === 2
          ? "name"
          : page === 4
            ? "listen"
            : page === 5
              ? "walk"
              : "return";

  return (
    <svg
      className={`tm4-svg tm4-svg--${style} tm4-motif--${motif}`}
      viewBox="0 0 240 420"
      role="img"
      aria-label={`${STYLES.find((s) => s.id === style)?.name}のアニメ`}
    >
      <rect width="240" height="420" fill="#f7f4ec" />
      {style === "window" && <WindowScene motif={motif} uid={uid} />}
      {style === "peel" && <PeelScene motif={motif} />}
      {style === "dots" && <DotsScene motif={motif} />}
      {style === "ear" && <EarScene motif={motif} />}
    </svg>
  );
}

function WindowScene({
  motif,
  uid,
}: {
  motif: string;
  uid: string;
}) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-streak`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#111" stopOpacity="0" />
          <stop offset="45%" stopColor="#111" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#111" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-pane`}>
          <rect x="28" y="48" width="184" height="300" rx="2" />
        </clipPath>
      </defs>
      {/* 窓枠 */}
      <rect
        x="24"
        y="44"
        width="192"
        height="308"
        fill="none"
        stroke="#111"
        strokeWidth="2"
      />
      <g clipPath={`url(#${uid}-pane)`}>
        {/* 流れる光条 */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            className="tm4-streak"
            x={-40}
            y={70 + i * 52}
            width="70"
            height="2"
            fill={`url(#${uid}-streak)`}
            style={{ animationDelay: `${i * 0.35}s` }}
          />
        ))}
        {/* 駅名のシルエットが流れる */}
        <g className="tm4-pass-names">
          <text x="260" y="120" className="tm4-glyph">
            淀
          </text>
          <text x="320" y="200" className="tm4-glyph">
            中書島
          </text>
          <text x="400" y="280" className="tm4-glyph">
            枚方
          </text>
        </g>
        {motif === "door" && (
          <g className="tm4-doors">
            <rect className="tm4-door tm4-door--l" x="28" y="140" width="92" height="160" fill="#111" />
            <rect className="tm4-door tm4-door--r" x="120" y="140" width="92" height="160" fill="#111" />
          </g>
        )}
        {motif === "listen" && (
          <circle className="tm4-ear-ring" cx="120" cy="200" r="20" fill="none" stroke="#111" />
        )}
        {motif === "walk" && (
          <g className="tm4-walk-dots">
            {[0, 1, 2, 3].map((i) => (
              <circle
                key={i}
                className="tm4-dot-pop"
                cx={70 + i * 28}
                cy={220 + (i % 2) * 12}
                r="4"
                style={{ animationDelay: `${0.4 + i * 0.25}s` }}
              />
            ))}
          </g>
        )}
        {motif === "return" && (
          <text className="tm4-name-fill" x="120" y="210" textAnchor="middle">
            駅
          </text>
        )}
        {motif === "name" && (
          <text className="tm4-name-fade" x="120" y="210" textAnchor="middle">
            名前
          </text>
        )}
      </g>
      <line x1="120" y1="44" x2="120" y2="352" stroke="#111" strokeWidth="1" opacity="0.25" />
    </g>
  );
}

function PeelScene({ motif }: { motif: string }) {
  return (
    <g>
      {/* ラベルがはがれる */}
      <g className="tm4-label-stack">
        <rect className="tm4-label tm4-label--1" x="52" y="150" width="136" height="36" rx="2" />
        <text className="tm4-label-text tm4-label-text--1" x="120" y="174" textAnchor="middle">
          駅名
        </text>
        <rect className="tm4-label tm4-label--2" x="64" y="210" width="112" height="32" rx="2" />
        <text className="tm4-label-text tm4-label-text--2" x="120" y="232" textAnchor="middle">
          わかったつもり
        </text>
      </g>
      {/* はがれたあと、輪郭だけ */}
      <circle
        className="tm4-after-form"
        cx="120"
        cy="250"
        r="48"
        fill="none"
        stroke="#111"
        strokeWidth="1.2"
      />
      {motif === "door" && (
        <path
          className="tm4-gap"
          d="M120 160 V320"
          stroke="#111"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
      {motif === "listen" && (
        <g className="tm4-listen-arcs">
          {[28, 44, 60].map((r, i) => (
            <circle
              key={r}
              className="tm4-arc"
              cx="120"
              cy="250"
              r={r}
              fill="none"
              stroke="#111"
              style={{ animationDelay: `${0.5 + i * 0.35}s` }}
            />
          ))}
        </g>
      )}
      {motif === "walk" && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              className="tm4-dot-pop"
              cx={60 + i * 30}
              cy={320}
              r="3.5"
              style={{ animationDelay: `${0.8 + i * 0.18}s` }}
            />
          ))}
        </g>
      )}
      {motif === "train" && (
        <g className="tm4-pass-thin">
          <rect className="tm4-thin-bar" x="0" y="100" width="40" height="1.5" />
          <rect className="tm4-thin-bar" x="0" y="180" width="56" height="1.5" style={{ animationDelay: "0.4s" }} />
          <rect className="tm4-thin-bar" x="0" y="260" width="48" height="1.5" style={{ animationDelay: "0.8s" }} />
        </g>
      )}
    </g>
  );
}

function DotsScene({ motif }: { motif: string }) {
  const pins = [
    { x: 120, y: 200, d: 0 },
    { x: 88, y: 248, d: 0.25 },
    { x: 152, y: 268, d: 0.5 },
    { x: 108, y: 312, d: 0.75 },
    { x: 148, y: 340, d: 1 },
  ];
  return (
    <g>
      {/* 駅 */}
      <circle className="tm4-station" cx="120" cy="110" r="7" fill="#111" />
      <text x="120" y="92" textAnchor="middle" className="tm4-tiny">
        駅
      </text>
      {/* 線は描かない。点だけ */}
      {pins.map((p, i) => (
        <g key={i}>
          <circle
            className="tm4-dot-pop"
            cx={p.x}
            cy={p.y}
            r="5"
            fill="#111"
            style={{ animationDelay: `${0.3 + p.d}s` }}
          />
          {i === 0 && motif !== "listen" && (
            <text
              className="tm4-enter"
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              style={{ animationDelay: `${0.35 + p.d}s` }}
            >
              入
            </text>
          )}
        </g>
      ))}
      {motif === "listen" && (
        <circle
          className="tm4-ear-ring"
          cx="120"
          cy="250"
          r="36"
          fill="none"
          stroke="#111"
          strokeWidth="1"
        />
      )}
      {motif === "door" && (
        <g className="tm4-doors tm4-doors--thin">
          <rect className="tm4-door tm4-door--l" x="40" y="150" width="78" height="140" fill="none" stroke="#111" />
          <rect className="tm4-door tm4-door--r" x="122" y="150" width="78" height="140" fill="none" stroke="#111" />
        </g>
      )}
      {motif === "name" && (
        <text className="tm4-name-fade" x="120" y="170" textAnchor="middle">
          名前
        </text>
      )}
      {motif === "return" && (
        <circle className="tm4-home" cx="120" cy="110" r="14" fill="none" stroke="#111" />
      )}
    </g>
  );
}

function EarScene({ motif }: { motif: string }) {
  return (
    <g>
      <circle cx="120" cy="210" r="6" fill="#111" />
      {[40, 70, 100, 130].map((r, i) => (
        <circle
          key={r}
          className="tm4-wave"
          cx="120"
          cy="210"
          r={r}
          fill="none"
          stroke="#111"
          style={{ animationDelay: `${i * 0.45}s` }}
        />
      ))}
      {motif === "train" && (
        <g className="tm4-pass-names tm4-pass-names--soft">
          <text x="260" y="120" className="tm4-glyph">
            明かり
          </text>
        </g>
      )}
      {motif === "door" && (
        <path
          className="tm4-gap"
          d="M120 120 V300"
          stroke="#111"
          strokeWidth="2"
        />
      )}
      {motif === "walk" && (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              className="tm4-dot-pop"
              cx={70 + i * 32}
              cy={320}
              r="3.5"
              style={{ animationDelay: `${0.6 + i * 0.2}s` }}
            />
          ))}
        </g>
      )}
      {motif === "name" && (
        <text className="tm4-name-fade" x="120" y="210" textAnchor="middle">
          鳥
        </text>
      )}
      {motif === "return" && (
        <text className="tm4-name-fill" x="120" y="216" textAnchor="middle">
          道
        </text>
      )}
    </g>
  );
}
