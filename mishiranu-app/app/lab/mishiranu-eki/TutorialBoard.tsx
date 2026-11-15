"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  TUTORIAL_PAGES,
  type TutorialPageCopy,
} from "./tutorial-copy";

export type { TutorialPageCopy };

export { TUTORIAL_PAGES };

export const TUTORIAL_SEEN_KEY = "mishiranu.tutorialSeen";

type Props = {
  onFinished?: () => void;
  finishLabel?: string;
  /** 設定内では戻る、初回オーバーレイでは × でとばす */
  showSkip?: boolean;
  onBack?: () => void;
};

type Axis = "h" | "v" | null;

/** ラボ「ゆるく」: 消えて → 短い紙色 → 次が現れる（被らない） */
const TOTAL_MS = 560;
const BLANK_HOLD = 0.14;
const OUT_MS = Math.round(TOTAL_MS * ((1 - BLANK_HOLD) / 2));
const HOLD_MS = Math.round(TOTAL_MS * BLANK_HOLD);
const IN_MS = TOTAL_MS - OUT_MS - HOLD_MS;

function PageBody({
  item,
  isLast,
}: {
  item: TutorialPageCopy;
  isLast: boolean;
}) {
  return (
    <div className="mishiranu-tutorial-slide-inner">
      {item.kicker ? (
        <p className="mishiranu-tutorial-kicker">{item.kicker}</p>
      ) : null}
      {item.showBrand ? (
        <p className="mishiranu-tutorial-brand">見知らぬ駅</p>
      ) : null}
      {item.verseLines?.length ? (
        <div
          className={[
            "mishiranu-tutorial-verse",
            item.verseMotion
              ? `mishiranu-tutorial-verse--${item.verseMotion}`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          lang="ja"
          aria-label="帰りの縦書き3列"
        >
          {item.verseLines.map((line, i) => (
            <p
              key={line}
              className="mishiranu-tutorial-verse-line"
              style={{ ["--i" as string]: i }}
            >
              {item.verseMotion === "chars"
                ? Array.from(line).map((ch, c) => (
                    <span
                      key={`${i}-${c}`}
                      className="mishiranu-tutorial-verse-ch"
                      style={{ ["--c" as string]: c }}
                    >
                      {ch}
                    </span>
                  ))
                : line}
            </p>
          ))}
        </div>
      ) : (
        <>
          <h3
            className={
              item.showBrand
                ? "mishiranu-tutorial-title mishiranu-tutorial-title--center"
                : "mishiranu-tutorial-title"
            }
          >
            {item.title}
          </h3>
          {item.quote ? (
            <blockquote className="mishiranu-tutorial-quote">
              <p>{item.quote}</p>
              {item.quoteBy ? (
                <cite className="mishiranu-tutorial-quote-by">
                  {item.quoteBy}
                </cite>
              ) : null}
            </blockquote>
          ) : null}
          {item.bodies.map((body) => (
            <p
              key={body.slice(0, 24)}
              className={
                item.showBrand
                  ? "mishiranu-tutorial-body mishiranu-tutorial-body--center"
                  : "mishiranu-tutorial-body"
              }
            >
              {body}
            </p>
          ))}
        </>
      )}
      {item.imageSrc ? (
        <div className="mishiranu-tutorial-phone">
          <Image
            src={item.imageSrc}
            alt={item.imageAlt ?? ""}
            width={780}
            height={1688}
            sizes="220px"
          />
        </div>
      ) : null}
      {item.steps?.length ? (
        <ol className="mishiranu-tutorial-steps">
          {item.steps.map((step, i) => (
            <li key={step.title}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {isLast ? (
        <div className="mishiranu-tutorial-icon">
          <Image
            src="/story/orikata/app-icon.png"
            alt=""
            width={80}
            height={80}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function TutorialBoard({
  onFinished,
  finishLabel = "はじめる",
  showSkip = false,
  onBack,
}: Props) {
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [busy, setBusy] = useState(false);
  const axisRef = useRef<Axis>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const widthRef = useRef(320);
  const stageRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const pageRef = useRef(page);
  pageRef.current = page;
  busyRef.current = busy;

  const item = TUTORIAL_PAGES[shown]!;
  const isLast = page >= TUTORIAL_PAGES.length - 1;

  const goTo = useCallback((newPage: number) => {
    if (busyRef.current) return;
    if (newPage < 0 || newPage >= TUTORIAL_PAGES.length) return;
    if (newPage === pageRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setOpacity(0);

    window.setTimeout(() => {
      setShown(newPage);
      setPage(newPage);
      window.setTimeout(() => {
        requestAnimationFrame(() => setOpacity(1));
        window.setTimeout(() => {
          busyRef.current = false;
          setBusy(false);
        }, IN_MS);
      }, HOLD_MS);
    }, OUT_MS);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      widthRef.current = el.clientWidth || 320;
    });
    widthRef.current = el.clientWidth || 320;
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busyRef.current) return;
    axisRef.current = null;
    startRef.current = { x: e.clientX, y: e.clientY };
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
    const threshold = widthRef.current * 0.2;
    if (-dx > threshold && pageRef.current + 1 < TUTORIAL_PAGES.length) {
      goTo(pageRef.current + 1);
    } else if (dx > threshold && pageRef.current > 0) {
      goTo(pageRef.current - 1);
    }
  };

  return (
    <div className="mishiranu-tutorial" role="dialog" aria-label="見知らぬ駅のチュートリアル">
      <div className="mishiranu-tutorial-top">
        {onBack ? (
          <button
            type="button"
            className="mishiranu-tutorial-textbtn"
            onClick={onBack}
          >
            戻る
          </button>
        ) : (
          <span />
        )}
        {showSkip && onFinished && !isLast ? (
          <button
            type="button"
            className="mishiranu-tutorial-textbtn mishiranu-tutorial-close"
            onClick={onFinished}
            aria-label="とばす"
          >
            ×
          </button>
        ) : (
          <span />
        )}
      </div>

      <div
        ref={stageRef}
        className={[
          "mishiranu-tutorial-stage",
          busy ? "mishiranu-tutorial-stage--passing" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        style={{
          ["--fade-ms" as string]: `${OUT_MS}ms`,
        }}
      >
        <div
          className="mishiranu-tutorial-solo"
          style={{
            opacity,
            transition: `opacity var(--fade-ms) ease`,
          }}
        >
          <div className="mishiranu-tutorial-slide">
            <PageBody
              item={item}
              isLast={shown >= TUTORIAL_PAGES.length - 1}
            />
          </div>
        </div>
      </div>

      <div
        className="mishiranu-tutorial-dots"
        aria-label={`ページ ${page + 1} / ${TUTORIAL_PAGES.length}`}
      >
        {TUTORIAL_PAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            className={
              i === page
                ? "mishiranu-tutorial-dot mishiranu-tutorial-dot--on"
                : "mishiranu-tutorial-dot"
            }
            aria-label={`${i + 1}ページ目`}
            disabled={busy}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <div className="mishiranu-tutorial-bar">
        {page > 0 ? (
          <button
            type="button"
            className="mishiranu-tutorial-btn mishiranu-tutorial-btn--ghost"
            disabled={busy}
            onClick={() => goTo(page - 1)}
          >
            戻る
          </button>
        ) : null}
        <button
          type="button"
          className="mishiranu-tutorial-btn mishiranu-tutorial-btn--ghost mishiranu-tutorial-btn--next"
          disabled={busy && !isLast}
          onClick={() => {
            if (isLast) {
              onFinished?.();
            } else {
              goTo(page + 1);
            }
          }}
        >
          {isLast ? finishLabel : "つぎへ"}
        </button>
      </div>
    </div>
  );
}
