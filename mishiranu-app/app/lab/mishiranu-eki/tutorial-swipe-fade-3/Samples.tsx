"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TUTORIAL_PAGES } from "../tutorial-copy";

/**
 * 被らない普通のフェード3種。
 * いまの頁が消えてから、次が同じ場所に現れる（同時に二枚出さない）。
 */
const STYLES = [
  {
    id: "quick",
    name: "さっと",
    blurb: "短く消えて、すぐ次。テンポ重視の普通フェード。",
    ms: 280,
  },
  {
    id: "plain",
    name: "ふつう",
    blurb: "いちばん普通。消えてから、同じ場所に次が現れる。",
    ms: 400,
  },
  {
    id: "soft",
    name: "ゆるく",
    blurb: "消えたあとに短い間、紙色だけ。それから次が現れる。",
    ms: 560,
  },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

const PAGES = TUTORIAL_PAGES;

function shortBody(i: number) {
  const p = PAGES[i]!;
  if (p.verseLines?.length) return p.verseLines.join("　");
  if (p.quote) return p.quote;
  return p.bodies[0] ?? "";
}

function SlideCard({ index }: { index: number }) {
  const p = PAGES[index]!;
  return (
    <div className="tsf3-card">
      {p.kicker ? <p className="tsf3-kicker">{p.kicker}</p> : null}
      {p.showBrand ? <p className="tsf3-brand">見知らぬ駅</p> : null}
      <h3 className="tsf3-card-title">
        {p.verseLines?.length ? "帰りの電車" : p.title}
      </h3>
      <p className="tsf3-card-body">{shortBody(index)}</p>
      <p className="tsf3-card-num">
        {index + 1} / {PAGES.length}
      </p>
    </div>
  );
}

function Pager({ styleId }: { styleId: StyleId }) {
  const meta = STYLES.find((s) => s.id === styleId)!;
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [busy, setBusy] = useState(false);
  const axisRef = useRef<"h" | "v" | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const widthRef = useRef(280);
  const stageRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const pageRef = useRef(0);
  pageRef.current = page;
  busyRef.current = busy;

  const goTo = useCallback(
    (newPage: number) => {
      if (busyRef.current) return;
      if (newPage < 0 || newPage >= PAGES.length) return;
      if (newPage === pageRef.current) return;

      const total = meta.ms;
      // soft だけ中央に短い空白。ほかは半分で切替
      const blankHold = styleId === "soft" ? 0.14 : 0;
      const half = (1 - blankHold) / 2;
      const outMs = Math.round(total * half);
      const holdMs = Math.round(total * blankHold);
      const inMs = total - outMs - holdMs;

      busyRef.current = true;
      setBusy(true);
      setOpacity(0);

      window.setTimeout(() => {
        setShown(newPage);
        setPage(newPage);
        if (holdMs > 0) {
          window.setTimeout(() => {
            requestAnimationFrame(() => setOpacity(1));
            window.setTimeout(() => {
              busyRef.current = false;
              setBusy(false);
            }, inMs);
          }, holdMs);
        } else {
          requestAnimationFrame(() => setOpacity(1));
          window.setTimeout(() => {
            busyRef.current = false;
            setBusy(false);
          }, inMs);
        }
      }, outMs);
    },
    [meta.ms, styleId],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busyRef.current) return;
    axisRef.current = null;
    startRef.current = { x: e.clientX, y: e.clientY };
    widthRef.current = stageRef.current?.clientWidth || 280;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busyRef.current || !startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (axisRef.current === null) {
      if (Math.abs(dx) > Math.abs(dy) + 6) axisRef.current = "h";
      else if (Math.abs(dy) > Math.abs(dx) + 6) axisRef.current = "v";
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const wasH = axisRef.current === "h";
    startRef.current = null;
    axisRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (busyRef.current || !wasH) return;
    const threshold = widthRef.current * 0.18;
    if (-dx > threshold && pageRef.current + 1 < PAGES.length) {
      goTo(pageRef.current + 1);
    } else if (dx > threshold && pageRef.current > 0) {
      goTo(pageRef.current - 1);
    }
  };

  const halfMs = Math.round(meta.ms * (styleId === "soft" ? 0.43 : 0.5));

  return (
    <div className="tsf3-pager">
      <div
        ref={stageRef}
        className={["tsf3-stage", busy ? "tsf3-stage--passing" : ""]
          .filter(Boolean)
          .join(" ")}
        style={{ ["--fade-ms" as string]: `${halfMs}ms` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className="tsf3-solo"
          style={{
            opacity,
            transition: `opacity var(--fade-ms) ease`,
          }}
        >
          <SlideCard index={shown} />
        </div>
      </div>

      <div className="tsf3-dots" aria-hidden>
        {PAGES.map((_, i) => (
          <span
            key={i}
            className={i === page ? "tsf3-dot tsf3-dot--on" : "tsf3-dot"}
          />
        ))}
      </div>

      <div className="tsf3-bar">
        <button
          type="button"
          className="tsf3-btn"
          disabled={busy || page === 0}
          onClick={() => goTo(page - 1)}
        >
          戻る
        </button>
        <button
          type="button"
          className="tsf3-btn tsf3-btn--next"
          disabled={busy || page >= PAGES.length - 1}
          onClick={() => goTo(page + 1)}
        >
          つぎへ
        </button>
      </div>
    </div>
  );
}

export default function TutorialSwipeFadeSamples() {
  return (
    <div className="tsf3-shell">
      <header className="tsf3-head">
        <p className="tsf3-eyebrow">見知らぬ駅 · ラボ</p>
        <h1 className="tsf3-title">チュートリアル送り · 普通のフェード3案</h1>
        <p className="tsf3-lede">
          スライドも被りもなし。いまの頁が消えてから、次が同じ場所に現れるだけの送り方です。
        </p>
      </header>

      <div className="tsf3-grid">
        {STYLES.map((s) => (
          <section key={s.id} className="tsf3-col">
            <h2 className="tsf3-col-name">{s.name}</h2>
            <p className="tsf3-col-blurb">{s.blurb}</p>
            <Pager styleId={s.id} />
          </section>
        ))}
      </div>
    </div>
  );
}
