"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  COMMUTE_VERSE_LINES,
  type TutorialVerseMotion,
} from "../tutorial-copy";

type MotionId = TutorialVerseMotion;

const MOTIONS: Array<{
  id: MotionId;
  name: string;
  blurb: string;
}> = [
  {
    id: "lines",
    name: "1 · 行ごと",
    blurb: "右の列から、一段ずつふわっと現れる。",
  },
  {
    id: "chars",
    name: "2 · 文字ごと",
    blurb: "読む順に、一字ずつ灯っていく。",
  },
  {
    id: "curtain",
    name: "3 · 上から幕",
    blurb: "各列が上から幕が開くように現れる。",
  },
  {
    id: "window",
    name: "4 · 窓の通過",
    blurb: "電車の窓のように、少し横へ流れながら現れる。",
  },
];

function VerseFace({
  motion,
  playKey,
}: {
  motion: MotionId;
  playKey: number;
}) {
  return (
    <div className="cv-phone">
      <div className="cv-notch" aria-hidden />
      <div className={`cv-screen cv-motion--${motion}`} key={playKey}>
        {/* 1ページ目想定：ブランド名は出さない（2ページ目から） */}
        <div className="cv-verse" lang="ja" aria-label="帰りの縦書き3列">
          {COMMUTE_VERSE_LINES.map((line, lineIndex) => (
            <p
              key={`${motion}-${lineIndex}-${line}`}
              className="cv-line"
              style={{ ["--i" as string]: lineIndex }}
            >
              {motion === "chars"
                ? Array.from(line).map((ch, charIndex) => (
                    <span
                      key={`${lineIndex}-${charIndex}`}
                      className="cv-ch"
                      style={{ ["--c" as string]: charIndex }}
                    >
                      {ch}
                    </span>
                  ))
                : line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CommuteVerseSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("m");
  const focus = MOTIONS.some((m) => m.id === raw) ? (raw as MotionId) : null;
  const shown = focus ? MOTIONS.filter((m) => m.id === focus) : MOTIONS;
  const [playKey, setPlayKey] = useState(0);

  const select = useCallback(
    (id: MotionId | null) => {
      const q = id ? `?m=${id}` : "";
      router.replace(`/lab/mishiranu-eki/commute-verse-4${q}`, {
        scroll: false,
      });
      setPlayKey((k) => k + 1);
    },
    [router],
  );

  useEffect(() => {
    setPlayKey((k) => k + 1);
  }, [focus]);

  return (
    <div className="cv-page">
      <header className="cv-head">
        <p className="cv-head-kicker">見知らぬ駅 · 1ページ目</p>
        <h1 className="cv-head-title">縦書き3列 · モーション4案</h1>
        <p className="cv-head-lead">
          原文を縦書き3列（右→左）。4案とも「2 · 文字ごと」と同じ速度です。ブランドは2ページ目から。動きを選んでください。
        </p>
        <div className="cv-tabs" role="tablist">
          <button
            type="button"
            className={focus ? "" : "is-on"}
            onClick={() => select(null)}
          >
            4つ並べる
          </button>
          {MOTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={focus === m.id ? "is-on" : ""}
              onClick={() => select(m.id)}
            >
              {m.name}
            </button>
          ))}
          <button
            type="button"
            className="cv-replay"
            onClick={() => setPlayKey((k) => k + 1)}
          >
            もう一度
          </button>
        </div>
      </header>

      <div className={focus ? "cv-grid cv-grid--one" : "cv-grid"}>
        {shown.map((m) => (
          <article key={m.id} className="cv-card">
            <VerseFace motion={m.id} playKey={playKey} />
            <div className="cv-card-copy">
              <h2>{m.name}</h2>
              <p>{m.blurb}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
