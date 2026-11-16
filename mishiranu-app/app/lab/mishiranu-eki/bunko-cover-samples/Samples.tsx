"use client";

import { useRouter, useSearchParams } from "next/navigation";

type CoverId = "spine" | "band" | "ma" | "cloth";

const NAME = "見知らぬ駅";

const COVERS: Array<{
  id: CoverId;
  name: string;
  blurb: string;
}> = [
  {
    id: "spine",
    name: "1 · 背表紙",
    blurb: "右端に背の細い帯。タイトルは一列の縦書き。下は奥付のように小さく。",
  },
  {
    id: "band",
    name: "2 · 帯",
    blurb: "表紙の下に短い帯。書名は中央寄り。余白は紙のまま。",
  },
  {
    id: "ma",
    name: "3 · 余白",
    blurb: "ほとんど白紙。右上に書名だけ。操作はいちばん下へ。「駅の小説」は置かない。",
  },
  {
    id: "cloth",
    name: "4 · 布表紙",
    blurb: "暗い布地に金の書名。枠は細い線。夜の小説の感じ。",
  },
];

function CoverFace({ id }: { id: CoverId }) {
  return (
    <div className="bc-phone">
      <div className="bc-notch" aria-hidden />
      <div className={`bc-screen bc-cover bc-cover--${id}`}>
        <div className="bc-frame" aria-hidden />
        {id === "spine" ? <div className="bc-spine" aria-hidden /> : null}
        <h1 className="bc-title">{NAME}</h1>
        {id === "band" ? (
          <p className="bc-obi">知らない土地を、一冊のように開く</p>
        ) : null}
        <div className="bc-gap" />
        <div className="bc-colophon">
          <button type="button" className="bc-cta">
            この場所
          </button>
          <form className="bc-search" onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>駅名</span>
              <input aria-label="駅名" placeholder="例: 藤森 / 出町柳" />
            </label>
          </form>
          <p className="bc-imprint">LAGADO · 見知らぬ駅</p>
        </div>
      </div>
    </div>
  );
}

export default function BunkoSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("cover");
  const focus = COVERS.some((c) => c.id === raw) ? (raw as CoverId) : null;
  const shown = focus ? COVERS.filter((c) => c.id === focus) : COVERS;

  function select(id: CoverId | null) {
    const q = id ? `?cover=${id}` : "";
    router.replace(`/lab/mishiranu-eki/bunko-cover-samples${q}`, { scroll: false });
  }

  return (
    <div className="bc-page">
      <header className="bc-head">
        <p className="bc-head-kicker">見知らぬ駅 · トップ</p>
        <h1 className="bc-head-title">文庫本の表紙 · 4種</h1>
        <p className="bc-head-lead">
          小説の文庫を手に取ったときの表紙です。「見知らぬ駅」は改行せず一列。操作は奥付のように下へ置いています。
        </p>
        <div className="bc-tabs" role="tablist">
          <button type="button" className={focus ? "" : "is-on"} onClick={() => select(null)}>
            4つ並べる
          </button>
          {COVERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={focus === c.id ? "is-on" : ""}
              onClick={() => select(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>
      <div className={focus ? "bc-grid bc-grid--one" : "bc-grid"}>
        {shown.map((cover) => (
          <article key={cover.id} className="bc-card">
            <CoverFace id={cover.id} />
            <div className="bc-card-copy">
              <h2>{cover.name}</h2>
              <p>{cover.blurb}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
