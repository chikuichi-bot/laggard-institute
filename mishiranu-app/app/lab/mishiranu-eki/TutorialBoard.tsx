"use client";

import Image from "next/image";
import { useState } from "react";
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
  /** 設定内では戻る、初回オーバーレイではとばす */
  showSkip?: boolean;
  onBack?: () => void;
};

export default function TutorialBoard({
  onFinished,
  finishLabel = "はじめる",
  showSkip = false,
  onBack,
}: Props) {
  const [page, setPage] = useState(0);
  const item = TUTORIAL_PAGES[page]!;
  const isLast = page >= TUTORIAL_PAGES.length - 1;

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
            className="mishiranu-tutorial-textbtn"
            onClick={onFinished}
          >
            とばす
          </button>
        ) : (
          <span />
        )}
      </div>

      <div className="mishiranu-tutorial-slide" key={page}>
        <div className="mishiranu-tutorial-slide-inner">
          {item.kicker ? (
            <p className="mishiranu-tutorial-kicker">{item.kicker}</p>
          ) : null}
          {item.showBrand ? (
            <p className="mishiranu-tutorial-brand">見知らぬ駅</p>
          ) : null}
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
                <cite className="mishiranu-tutorial-quote-by">{item.quoteBy}</cite>
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
            onClick={() => setPage(i)}
          />
        ))}
      </div>

      <div className="mishiranu-tutorial-bar">
        {page > 0 ? (
          <button
            type="button"
            className="mishiranu-tutorial-btn mishiranu-tutorial-btn--ghost"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            戻る
          </button>
        ) : null}
        <button
          type="button"
          className="mishiranu-tutorial-btn mishiranu-tutorial-btn--warm"
          onClick={() => {
            if (isLast) {
              onFinished?.();
            } else {
              setPage((p) => Math.min(TUTORIAL_PAGES.length - 1, p + 1));
            }
          }}
        >
          {isLast ? finishLabel : "つぎへ"}
        </button>
      </div>
    </div>
  );
}
