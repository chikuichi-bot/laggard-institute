"use client";

import { useRouter, useSearchParams } from "next/navigation";

type HeroId = "right" | "center" | "left" | "rule" | "night";

const NAME = "見知らぬ駅";

const HEROES: Array<{
  id: HeroId;
  name: string;
  blurb: string;
}> = [
  { id: "right", name: "1 · 右", blurb: "一列を右へ。下は塗りつぶしの丸。" },
  { id: "center", name: "2 · 中央", blurb: "一列を中央へ。下は下線だけ。" },
  { id: "left", name: "3 · 左", blurb: "一列を左へ。ボタンは角。" },
  { id: "rule", name: "4 · 罫", blurb: "一列のとなりに細い線。ボタンは枠だけ。" },
  { id: "night", name: "5 · 夜", blurb: "同じ一列。紙を暗くして字を金に。" },
];

function Face({ id }: { id: HeroId }) {
  return (
    <div className="hs-phone">
      <div className="hs-notch" aria-hidden />
      <div className={`hs-screen hs-col hs-col--${id}`}>
        <h1>{NAME}</h1>
        <div className="hs-gap" />
        <button type="button">この場所</button>
        <form onSubmit={(e) => e.preventDefault()}>
          <label>
            <span>駅名</span>
            <input aria-label="駅名" />
          </label>
        </form>
      </div>
    </div>
  );
}

export default function HeroSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("hero");
  const focus = HEROES.some((h) => h.id === raw) ? (raw as HeroId) : null;
  const shown = focus ? HEROES.filter((h) => h.id === focus) : HEROES;

  function select(id: HeroId | null) {
    const q = id ? `?hero=${id}` : "";
    router.replace(`/lab/mishiranu-eki/hero-samples${q}`, { scroll: false });
  }

  return (
    <div className="hs-page">
      <header className="hs-head">
        <p className="hs-head-kicker">見知らぬ駅 · トップ</p>
        <h1 className="hs-head-title">一列の縦書き、5種</h1>
        <p className="hs-head-lead">
          「見知らぬ駅」は改行せず、一列のままです。置き方と色だけを少し変えています。
        </p>
        <div className="hs-tabs" role="tablist">
          <button type="button" className={focus ? "" : "is-on"} onClick={() => select(null)}>
            5つ並べる
          </button>
          {HEROES.map((h) => (
            <button
              key={h.id}
              type="button"
              className={focus === h.id ? "is-on" : ""}
              onClick={() => select(h.id)}
            >
              {h.name}
            </button>
          ))}
        </div>
      </header>
      <div className={focus ? "hs-grid hs-grid--one" : "hs-grid"}>
        {shown.map((hero) => (
          <article key={hero.id} className="hs-card">
            <Face id={hero.id} />
            <div className="hs-card-copy">
              <h2>{hero.name}</h2>
              <p>{hero.blurb}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
