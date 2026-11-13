"use client";

import Image from "next/image";
import { useState } from "react";

export type TutorialPageCopy = {
  kicker?: string;
  title: string;
  bodies: string[];
  quote?: string;
  quoteBy?: string;
  imageSrc?: string;
  imageAlt?: string;
  steps?: Array<{ title: string; body: string }>;
  showBrand?: boolean;
};

/** ホームページ（orikata）紹介と同じ趣旨のページ分けチュートリアル。 */
export const TUTORIAL_PAGES: TutorialPageCopy[] = [
  {
    showBrand: true,
    title: "知らない駅に降りる",
    bodies: [
      "名前だけ知っている駅に、私は降りる。",
      "空っぽの名前だった駅が、私の散歩道になる。",
    ],
  },
  {
    kicker: "はじまり",
    title: "名前を知って、見なくなった駅",
    quote:
      "子どもに「あれは鳥だよ」と言葉を教えたその日から、子どもはもう、あの鳥を見なくなってしまいます。",
    quoteBy: "── ジッドゥ・クリシュナムルティ",
    bodies: [
      "電車の窓に、知らない駅名が何度も流れます。私はその名前を読み、それで分かったつもりになって、降りません。",
      "名前だけが残り、その土地の姿を、私は一度も見ていない。駅は、私にとって存在しないもののようになっていました。",
    ],
  },
  {
    kicker: "なにができるか · 01",
    title: "ホームに、一度降りる",
    bodies: [
      "ドアが開く。知らない駅のホームに、私は一度降りる。次の電車まで、まだ少し時間がある。",
      "このアプリを開いて、いまいる駅を確かめる。まず届くのは、この土地にまつわる物語のゆかりがひとかけら。ここから、空っぽだった駅名が散歩道へと変わっていく。",
    ],
    imageSrc: "/story/orikata/arrive-yodo.png",
    imageAlt: "到着確認の画面",
  },
  {
    kicker: "なにができるか · 02",
    title: "名前の奥から、声が聞こえる",
    bodies: [
      "改札を出て、イヤホンをつける。散歩道の案内を開くと、この土地の成り立ちと、いまの空気を、声で読み上げてくれる。",
      "スマホはポケットにしまって、私は顔を上げる。聴いているうちに、ただの文字だった名前に、目の前の川や坂が重なっていく。",
    ],
    imageSrc: "/story/orikata/land-fujinomori.png",
    imageAlt: "土地の案内と読み上げ",
  },
  {
    kicker: "なにができるか · 03",
    title: "歩いたところが、道になる",
    bodies: [
      "地図をひとつ確かめて、少し回り道をする。橋や田畑の道、名前のついていないものが、ひとつずつ目に入ってくる。",
      "見たことがあるようで、見たことのない角を曲がり、駅へ戻る。歩いたぶんだけ、名前は散歩道になっていく。",
    ],
    imageSrc: "/story/orikata/map-yodo.png",
    imageAlt: "徒歩圏の地図と動線",
  },
  {
    kicker: "使い方",
    title: "同じ名前が、違って見える",
    bodies: [
      "帰りの電車で、私はその駅名をもう一度読む。同じ名前なのに、もう空っぽではない。そこには、私の歩いた散歩道がある。",
    ],
    steps: [
      {
        title: "知らない駅に降りる",
        body: "現在地から探すか、気になっていた駅名を入れる。",
      },
      {
        title: "物語のゆかりを読む",
        body: "土地にまつわるひとかけらを読む。ここまでは無料。",
      },
      {
        title: "散歩道を開く",
        body: "コインを1枚使って、徒歩圏の散歩道の案内をつくる。一度つくった駅は端末に残り、開き直しにコインはいらない。",
      },
      {
        title: "聴きながら歩き、駅へ帰る",
        body: "土地の歴史と今を耳でたどり、回り道をして同じ駅へ戻る。",
      },
    ],
  },
];

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
