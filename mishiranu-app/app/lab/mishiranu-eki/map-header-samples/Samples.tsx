"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** いまの実機でごちゃついている情報の正本（出町柳）。 */
const s = {
  name: "出町柳",
  prefecture: "京都",
  line: "京阪本線 / 叡山電鉄",
  dayPart: "夕方",
  stay: "1時間",
  tourTitle: "鴨川の三角と、枡形の甘い匂いをたどる",
  catchCopy: "日常の駅前が、寄り道の入口になっている。",
  radiusKm: "1",
  pinCount: 18,
  courseTitle: null as string | null,
};

type SampleId = "strip" | "card" | "float";

const SAMPLES: Array<{ id: SampleId; name: string; blurb: string }> = [
  {
    id: "strip",
    name: "A · 一行ストリップ",
    blurb: "駅名だけを残し、メタは一行。キャッチとピン数は地図の下に薄く置く。",
  },
  {
    id: "card",
    name: "B · 一枚カード",
    blurb: "共通ヘッドと地図内カードを統合。駅名・キャッチ・統計を一度だけ。",
  },
  {
    id: "float",
    name: "C · 地図の上に浮く",
    blurb: "地図を全面に。駅名は半透明の帯、詳細は地図下端の短冊だけ。",
  },
];

function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="mh-phone">
      <div className="mh-phone-bezel" aria-label={label}>
        <div className="mh-phone-notch" aria-hidden />
        <div className="mh-phone-screen">{children}</div>
      </div>
      <figcaption className="mh-phone-cap">{label}</figcaption>
    </figure>
  );
}

function TabBar() {
  const tabs = [
    { id: "map", label: "地図", icon: "/ejp/B_destination.svg", on: true },
    { id: "place", label: "土地", icon: "/ejp/B_history.svg" },
    { id: "walk", label: "歩く", icon: "/ejp/A_trekking.svg" },
    { id: "guide", label: "案内", icon: "/ejp/B_information.svg" },
    { id: "more", label: "ほか", icon: "/ejp/B_hamburger-menu.svg" },
  ];
  return (
    <nav className="mh-tabs" aria-label="案内のページ">
      {tabs.map((t) => (
        <span key={t.id} className={t.on ? "mh-tab mh-tab--on" : "mh-tab"}>
          <img src={t.icon} alt="" width={22} height={22} />
          {t.label}
        </span>
      ))}
    </nav>
  );
}

/** 地図モック（鴨川デルタの雰囲気だけ）。 */
function FakeMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mh-map mh-map--compact" : "mh-map"} aria-hidden>
      <div className="mh-map-river mh-map-river--w" />
      <div className="mh-map-river mh-map-river--e" />
      <div className="mh-map-delta" />
      <span className="mh-map-pin mh-map-pin--station" style={{ left: "48%", top: "52%" }}>
        駅
      </span>
      <span className="mh-map-pin mh-map-pin--sight" style={{ left: "38%", top: "40%" }} />
      <span className="mh-map-pin mh-map-pin--meal" style={{ left: "58%", top: "46%" }} />
      <span className="mh-map-pin mh-map-pin--gift" style={{ left: "44%", top: "62%" }} />
      <span className="mh-map-pin mh-map-pin--tip" style={{ left: "62%", top: "58%" }} />
      <span className="mh-map-pin mh-map-pin--rest" style={{ left: "34%", top: "58%" }} />
      <button type="button" className="mh-map-recenter" aria-label="現在地を表示">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-6a1 1 0 0 1 1 1v1.06A8.004 8.004 0 0 1 19.94 11H21a1 1 0 1 1 0 2h-1.06A8.004 8.004 0 0 1 13 19.94V21a1 1 0 1 1-2 0v-1.06A8.004 8.004 0 0 1 4.06 13H3a1 1 0 1 1 0-2h1.06A8.004 8.004 0 0 1 11 4.06V3a1 1 0 0 1 1-1Zm0 4a6 6 0 1 0 0 12A6 6 0 0 0 12 6Z"
          />
        </svg>
      </button>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "観光", color: "#5f7d6a", icon: "/ejp/B_photo-spot.svg" },
    { label: "ご飯", color: "#b5493a", icon: "/ejp/F_restaurant.svg" },
    { label: "お土産", color: "#9a7a8c", icon: "/ejp/B_gift.svg" },
    { label: "休む", color: "#c5a059", icon: "/ejp/B_waiting-area.svg" },
    { label: "寄り道", color: "#6b8cca", icon: "/ejp/C_ancient-road.svg" },
  ];
  return (
    <ul className="mh-legend">
      {items.map((it) => (
        <li key={it.label}>
          <img src={it.icon} alt="" width={14} height={14} style={{ color: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** いまの問題（比較用・採用しない）。 */
function SampleCurrent() {
  return (
    <div className="mh-app mh-current">
      <header className="mh-current-top">
        <button type="button" className="mh-back">
          ← 駅を探し直す
        </button>
        <p className="mh-meta">
          {s.prefecture} · {s.line} · {s.dayPart} · {s.stay}
        </p>
        <h1>{s.name}</h1>
        <p className="mh-sub">{s.courseTitle ?? s.tourTitle}</p>
      </header>
      <div className="mh-current-card">
        <p className="mh-eyebrow">{s.name}駅 · 観光案内</p>
        <h2>{s.tourTitle}</h2>
        <p className="mh-catch">{s.catchCopy}</p>
        <p className="mh-radius">
          徒歩圏 約 {s.radiusKm} km · 案内ピン {s.pinCount} 件
        </p>
      </div>
      <FakeMap compact />
      <div className="mh-footer">
        <Legend />
      </div>
      <TabBar />
    </div>
  );
}

/**
 * A · 一行ストリップ
 * 駅名は一度だけ。キャッチは地図下の一行に退避して、ヘッドの厚みを消す。
 */
function SampleStrip() {
  return (
    <div className="mh-app mh-a">
      <header className="mh-a-bar">
        <button type="button" className="mh-back">
          ← 探し直す
        </button>
        <div className="mh-a-title-wrap">
          <h1>{s.name}</h1>
          <p>
            {s.dayPart} · {s.stay}
          </p>
        </div>
        <span className="mh-a-pins">{s.pinCount}</span>
      </header>
      <FakeMap />
      <div className="mh-a-foot">
        <p className="mh-a-catch">{s.catchCopy}</p>
        <Legend />
      </div>
      <TabBar />
    </div>
  );
}

/**
 * B · 一枚カード
 * 共通ヘッドと地図カードを統合。tourTitle を主、駅名はラベル、重複ゼロ。
 */
function SampleCard() {
  return (
    <div className="mh-app mh-b">
      <header className="mh-b-card">
        <div className="mh-b-row">
          <button type="button" className="mh-back">
            ← 駅を探し直す
          </button>
          <span className="mh-b-chip">
            {s.dayPart} · {s.stay}
          </span>
        </div>
        <p className="mh-b-station">{s.name}</p>
        <h1>{s.courseTitle ?? s.tourTitle}</h1>
        <p className="mh-b-catch">{s.catchCopy}</p>
        <p className="mh-b-stats">
          <span>{s.prefecture}</span>
          <span>徒歩圏 約 {s.radiusKm} km</span>
          <span>ピン {s.pinCount}</span>
        </p>
      </header>
      <FakeMap />
      <div className="mh-footer">
        <Legend />
      </div>
      <TabBar />
    </div>
  );
}

/**
 * C · 地図の上に浮く
 * 地図を主役に。情報は半透明帯＋下端短冊だけ。ヘッドの紙面を消す。
 */
function SampleFloat() {
  return (
    <div className="mh-app mh-c">
      <div className="mh-c-mapwrap">
        <FakeMap />
        <header className="mh-c-float">
          <button type="button" className="mh-c-back">
            ←
          </button>
          <div>
            <h1>{s.name}</h1>
            <p>
              {s.dayPart} · {s.stay} · ピン {s.pinCount}
            </p>
          </div>
        </header>
        <aside className="mh-c-sheet">
          <p className="mh-c-catch">{s.catchCopy}</p>
          <Legend />
        </aside>
      </div>
      <TabBar />
    </div>
  );
}

export default function MapHeaderSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("v");
  const active: SampleId =
    raw === "card" || raw === "float" || raw === "strip" ? raw : "strip";
  const showCurrent = params.get("now") === "1";

  function select(id: SampleId) {
    router.replace(`?v=${id}`, { scroll: false });
  }

  return (
    <div className="mh">
      <header className="mh-hero">
        <p className="mh-hero-kicker">見知らぬ駅 · UI サンプル</p>
        <h1>地図ヘッドのごちゃつきを、整理する</h1>
        <p className="mh-hero-lead">
          いまは共通ヘッド（駅名＋キャッチ）の下に、地図ページでもう一度「駅・観光案内」カードが出て、同じ文が二重になっています。下の3案はいずれも
          <strong>駅名とキャッチを一度だけ</strong>
          にする前提です。採用した案を iPhone の地図タブへ降ろします。
        </p>
        <p className="mh-hero-now">
          <a href="?now=1">いまの問題形を見る</a>
          {showCurrent ? (
            <>
              {" · "}
              <a href="?v=strip">案に戻る</a>
            </>
          ) : null}
        </p>
        {!showCurrent ? (
          <div className="mh-picker" role="tablist" aria-label="サンプル切替">
            {SAMPLES.map((item) => (
              <a
                key={item.id}
                role="tab"
                href={`?v=${item.id}`}
                aria-selected={active === item.id}
                className={active === item.id ? "mh-pick mh-pick--on" : "mh-pick"}
                onClick={(e) => {
                  e.preventDefault();
                  select(item.id);
                }}
              >
                <strong>{item.name}</strong>
                <span>{item.blurb}</span>
              </a>
            ))}
          </div>
        ) : null}
      </header>

      <div className="mh-stage">
        {showCurrent ? (
          <div className="mh-stage-mobile">
            <Phone label="いま（問題形・二重表示）">
              <SampleCurrent />
            </Phone>
          </div>
        ) : (
          <>
            <div className="mh-stage-mobile">
              <Phone label={SAMPLES.find((x) => x.id === active)!.name}>
                {active === "strip" ? (
                  <SampleStrip />
                ) : active === "card" ? (
                  <SampleCard />
                ) : (
                  <SampleFloat />
                )}
              </Phone>
            </div>
            <div className="mh-stage-desktop" aria-label="三案の一覧">
              <Phone label="A · 一行ストリップ">
                <SampleStrip />
              </Phone>
              <Phone label="B · 一枚カード">
                <SampleCard />
              </Phone>
              <Phone label="C · 地図の上に浮く">
                <SampleFloat />
              </Phone>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
