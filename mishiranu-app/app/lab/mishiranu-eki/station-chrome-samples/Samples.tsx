"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** 実機スクショの二ノ瀬を正本に。 */
const s = {
  name: "二ノ瀬",
  prefecture: "京都府",
  line: "叡山電鉄鞍馬線",
  dayPart: "夕方",
  stay: "1時間",
  course: "散歩中心",
  pinCount: 8,
  catchCopy: "山あいの駅、貴船川のせせらぎと紅葉のトンネルに抱かれて。",
};

type SampleId = "bar" | "quiet" | "pill";
type TabId = "map" | "place" | "walk";

const SAMPLES: Array<{ id: SampleId; name: string; blurb: string }> = [
  {
    id: "bar",
    name: "A · 一行バー",
    blurb:
      "←｜二ノ瀬｜夕方・1時間｜ピン。文言は駅名と時刻だけ。戻るは記号のみ。",
  },
  {
    id: "quiet",
    name: "B · 静かな二行",
    blurb:
      "← と路線を薄く。駅名は小さめ、その下にコース名一行。余白を減らしてシンプルに。",
  },
  {
    id: "pill",
    name: "C · 駅名ピル",
    blurb:
      "←｜【二ノ瀬】コース名。ラベルをピル一つにまとめ、メタは一行だけ。",
  },
];

/** 駅探し直しは記号だけ（スクリーンリーダー用に aria-label）。 */
function BackSymbol() {
  return (
    <button type="button" className="sc-back" aria-label="駅を探し直す">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z"
        />
      </svg>
    </button>
  );
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "map", label: "地図" },
  { id: "place", label: "土地" },
  { id: "walk", label: "歩く" },
];

function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="sc-phone">
      <div className="sc-phone-bezel" aria-label={label}>
        <div className="sc-phone-notch" aria-hidden />
        <div className="sc-phone-screen">{children}</div>
      </div>
      <figcaption className="sc-phone-cap">{label}</figcaption>
    </figure>
  );
}

function TabBar({ active }: { active: TabId }) {
  const items = [
    { id: "map" as const, label: "地図", icon: "/ejp/B_destination.svg" },
    { id: "place" as const, label: "土地", icon: "/ejp/B_history.svg" },
    { id: "walk" as const, label: "歩く", icon: "/ejp/A_trekking.svg" },
    { id: "guide" as const, label: "案内", icon: "/ejp/B_information.svg" },
    { id: "more" as const, label: "設定", icon: "/ejp/B_hamburger-menu.svg" },
  ];
  return (
    <nav className="sc-tabs" aria-label="案内のページ">
      {items.map((t) => (
        <span
          key={t.id}
          className={t.id === active ? "sc-tab sc-tab--on" : "sc-tab"}
        >
          <img src={t.icon} alt="" width={22} height={22} />
          {t.label}
        </span>
      ))}
    </nav>
  );
}

function ChromeA() {
  return (
    <header className="sc-chrome sc-chrome--bar">
      <BackSymbol />
      <div className="sc-chrome-mid">
        <p className="sc-name">{s.name}</p>
        <p className="sc-meta">
          {s.dayPart} · {s.stay}
        </p>
      </div>
      <span className="sc-pins" aria-label={`案内ピン ${s.pinCount} 件`}>
        {s.pinCount}
      </span>
    </header>
  );
}

function ChromeB() {
  return (
    <header className="sc-chrome sc-chrome--quiet">
      <div className="sc-quiet-top">
        <BackSymbol />
        <p className="sc-meta sc-meta--end">{s.line}</p>
      </div>
      <div className="sc-quiet-bottom">
        <div className="sc-quiet-title-row">
          <h1 className="sc-name sc-name--quiet">{s.name}</h1>
          <p className="sc-meta">
            {s.dayPart} · {s.stay}
          </p>
        </div>
        <p className="sc-course">{s.course}</p>
      </div>
    </header>
  );
}

function ChromeC() {
  return (
    <header className="sc-chrome sc-chrome--pill">
      <div className="sc-pill-top">
        <BackSymbol />
        <span className="sc-station-pill">{s.name}</span>
        <span className="sc-course-soft">{s.course}</span>
      </div>
      <p className="sc-meta">
        {s.dayPart} · {s.stay}
      </p>
    </header>
  );
}

function Chrome({ id }: { id: SampleId }) {
  if (id === "quiet") return <ChromeB />;
  if (id === "pill") return <ChromeC />;
  return <ChromeA />;
}

function BodyMap() {
  return (
    <div className="sc-body">
      <div className="sc-map" aria-hidden>
        <div className="sc-map-green" />
        <span className="sc-map-pin" style={{ left: "42%", top: "48%" }}>
          1
        </span>
        <span className="sc-map-pin sc-map-pin--b" style={{ left: "58%", top: "40%" }}>
          3
        </span>
      </div>
      <div className="sc-foot">
        <p>{s.catchCopy}</p>
        <p className="sc-meta">徒歩圏 約 1 km · 線は「{s.course}」</p>
      </div>
    </div>
  );
}

function BodyPlace() {
  return (
    <div className="sc-body sc-body--place">
      <button type="button" className="sc-listen">
        土地案内を聞く
      </button>
      <div className="sc-place-grid">
        <span>01 この駅</span>
        <span>02 歩き方</span>
        <span>03 歴史</span>
        <span>04 観光</span>
      </div>
      <p className="sc-place-lead">01 この駅のこと</p>
      <p className="sc-place-copy">
        二ノ瀬は京都市左京区の静かな無人駅。山と川に囲まれ、電車の合間に空気が戻る。
      </p>
    </div>
  );
}

function BodyWalk() {
  return (
    <div className="sc-body sc-body--walk">
      <p className="sc-kicker">WALK</p>
      <h2 className="sc-walk-title">{s.course}</h2>
      <p className="sc-meta">景色と休みを多めに · 約46分 · 3か所</p>
      <ol className="sc-walk-stops">
        <li>
          <strong>17:05</strong> ニノ瀬の石垣
        </li>
        <li>
          <strong>17:18</strong> ニノ瀬の風景
        </li>
        <li>
          <strong>17:34</strong> 叡山電鉄鞍馬線
        </li>
      </ol>
    </div>
  );
}

function Screen({
  sample,
  tab,
}: {
  sample: SampleId;
  tab: TabId;
}) {
  return (
    <div className="sc-screen">
      <Chrome id={sample} />
      {tab === "map" ? <BodyMap /> : null}
      {tab === "place" ? <BodyPlace /> : null}
      {tab === "walk" ? <BodyWalk /> : null}
      <TabBar active={tab} />
    </div>
  );
}

export default function StationChromeSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const sample = (params.get("v") as SampleId) || "bar";
  const tab = (params.get("tab") as TabId) || "map";
  const active = SAMPLES.some((x) => x.id === sample) ? sample : "bar";
  const activeTab = TABS.some((x) => x.id === tab) ? tab : "map";
  const current = SAMPLES.find((x) => x.id === active)!;

  function setSample(id: SampleId) {
    const next = new URLSearchParams(params.toString());
    next.set("v", id);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  function setTab(id: TabId) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", id);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="sc-page">
      <header className="sc-hero">
        <p className="sc-eyebrow">見知らぬ駅 · UI lab</p>
        <h1>駅ヘッドを統一する · 3案</h1>
        <p>
          「探し直す」は文言をやめ、戻る記号だけにしました。駅名は小さく、同じ部品で地図・土地・歩くを揃えます。下のタブで3画面を切り替えられます。
        </p>
      </header>

      <div className="sc-switch" role="tablist" aria-label="案">
        {SAMPLES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            className={
              item.id === active ? "sc-switch-btn sc-switch-btn--on" : "sc-switch-btn"
            }
            onClick={() => setSample(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <p className="sc-blurb">{current.blurb}</p>

      <div className="sc-tab-switch" role="tablist" aria-label="画面">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === activeTab}
            className={
              item.id === activeTab
                ? "sc-tab-switch-btn sc-tab-switch-btn--on"
                : "sc-tab-switch-btn"
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="sc-gallery">
        <Phone label={`${current.name} · ${TABS.find((t) => t.id === activeTab)?.label}`}>
          <Screen sample={active} tab={activeTab} />
        </Phone>
        {SAMPLES.filter((x) => x.id !== active).map((item) => (
          <Phone key={item.id} label={`${item.name} · 地図`}>
            <Screen sample={item.id} tab="map" />
          </Phone>
        ))}
      </div>

      <footer className="sc-foot-note">
        <p>
          C · 駅名ピルを採用済み。Web / iOS の案内ヘッドは共通の StationChrome に統一しています。
        </p>
        <p>
          <a href="/lab/mishiranu-eki">見知らぬ駅ラボへ戻る</a>
        </p>
      </footer>
    </div>
  );
}
