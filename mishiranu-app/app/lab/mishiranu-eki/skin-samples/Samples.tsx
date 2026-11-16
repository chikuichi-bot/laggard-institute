"use client";

import { useRouter, useSearchParams } from "next/navigation";

type SkinId = "board" | "window" | "topo";
type ScreenId = "hero" | "map" | "place";

const SKINS: Array<{
  id: SkinId;
  name: string;
  blurb: string;
  why: string;
}> = [
  {
    id: "board",
    name: "A · ホームの時刻表",
    blurb: "駅の電光掲示・ホーム案内に近い。暗くて硬い。字は読みやすさ優先。",
    why: "「到着した」感覚が先。文学の紙ではなく、交通の情報板。",
  },
  {
    id: "window",
    name: "B · 車窓の霧",
    blurb: "窓ガラス越しの景色。青みの霧、余白多め、声は小さめ。",
    why: "降りた直後のぼんやりと、徒歩圏の静けさ。催促しないUI。",
  },
  {
    id: "topo",
    name: "C · ポケット地形図",
    blurb: "折り畳み地図・フィールドノート。オリーブと線。歩く道具。",
    why: "物語を読む机ではなく、いま歩くための地図帳。",
  },
];

const SCREENS: Array<{ id: ScreenId; label: string }> = [
  { id: "hero", label: "はじまり" },
  { id: "map", label: "地図" },
  { id: "place", label: "土地" },
];

const s = {
  name: "二ノ瀬",
  course: "散歩中心",
  meta: "夕方 · 1時間",
  catchCopy: "山あいの駅、貴船川のせせらぎと紅葉のトンネルに抱かれて。",
};

function Back() {
  return (
    <button type="button" className="sk-back" aria-label="駅を探し直す">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z"
        />
      </svg>
    </button>
  );
}

function Chrome() {
  return (
    <header className="sk-chrome">
      <div className="sk-chrome-top">
        <Back />
        <span className="sk-pill">{s.name}</span>
        <span className="sk-course">{s.course}</span>
      </div>
      <p className="sk-meta">{s.meta}</p>
    </header>
  );
}

function TabBar({ active }: { active: "map" | "place" }) {
  const items = [
    { id: "map", label: "地図" },
    { id: "place", label: "土地" },
    { id: "walk", label: "歩く" },
    { id: "guide", label: "案内" },
    { id: "more", label: "設定" },
  ] as const;
  return (
    <nav className="sk-tabs" aria-label="案内のページ">
      {items.map((t) => (
        <span
          key={t.id}
          className={t.id === active ? "sk-tab sk-tab--on" : "sk-tab"}
        >
          <i aria-hidden />
          {t.label}
        </span>
      ))}
    </nav>
  );
}

function HeroBody() {
  return (
    <div className="sk-hero">
      <p className="sk-eyebrow">LAGADO · 見知らぬ駅</p>
      <h1 className="sk-hero-title">見知らぬ駅</h1>
      <p className="sk-hero-lead">
        降りた駅の、徒歩圏だけを、物語にする。予定のない寄り道を、いまここから。
      </p>
      <button type="button" className="sk-cta">
        知らない駅に到着
      </button>
      <button type="button" className="sk-cta sk-cta--ghost">
        出町柳ですぐ見る
      </button>
    </div>
  );
}

function MapBody() {
  return (
    <div className="sk-body">
      <Chrome />
      <div className="sk-map" aria-hidden>
        <div className="sk-map-ring" />
        <span className="sk-pin" style={{ left: "42%", top: "48%" }}>
          1
        </span>
        <span className="sk-pin sk-pin--b" style={{ left: "58%", top: "38%" }}>
          3
        </span>
      </div>
      <div className="sk-foot">
        <p>{s.catchCopy}</p>
        <p className="sk-meta">徒歩圏 約 1 km · 線は「{s.course}」</p>
      </div>
      <TabBar active="map" />
    </div>
  );
}

function PlaceBody() {
  return (
    <div className="sk-body">
      <Chrome />
      <div className="sk-place">
        <button type="button" className="sk-listen">
          土地案内を聞く
        </button>
        <div className="sk-index">
          <span>01 この駅</span>
          <span>02 歩き方</span>
          <span>03 歴史</span>
          <span>04 観光</span>
        </div>
        <p className="sk-place-lead">01 この駅のこと</p>
        <p className="sk-place-copy">
          二ノ瀬は京都市左京区の静かな無人駅。山と川に囲まれ、電車の合間に空気が戻る。
        </p>
      </div>
      <TabBar active="place" />
    </div>
  );
}

function Phone({
  skin,
  screen,
  label,
}: {
  skin: SkinId;
  screen: ScreenId;
  label: string;
}) {
  return (
    <figure className={`sk-phone sk-phone--${skin}`}>
      <div className="sk-bezel" aria-label={label}>
        <div className="sk-notch" aria-hidden />
        <div className="sk-screen">
          {screen === "hero" ? <HeroBody /> : null}
          {screen === "map" ? <MapBody /> : null}
          {screen === "place" ? <PlaceBody /> : null}
        </div>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default function SkinSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const skin = (params.get("v") as SkinId) || "board";
  const screen = (params.get("screen") as ScreenId) || "map";
  const active = SKINS.some((x) => x.id === skin) ? skin : "board";
  const activeScreen = SCREENS.some((x) => x.id === screen) ? screen : "map";
  const current = SKINS.find((x) => x.id === active)!;

  function setSkin(id: SkinId) {
    const next = new URLSearchParams(params.toString());
    next.set("v", id);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  function setScreen(id: ScreenId) {
    const next = new URLSearchParams(params.toString());
    next.set("screen", id);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="sk-page">
      <header className="sk-page-hero">
        <p className="sk-page-eyebrow">見知らぬ駅 · UI lab</p>
        <h1>このアプリに合う見た目 · 3方向</h1>
        <p>
          おみくじ文庫の和紙・明朝・断片の空気は、ここでは借りない前提です。
          「降りた駅の徒歩圏」に合う、別の顔を3つ並べます。駅名ピル（C）の骨格はそのままです。
        </p>
      </header>

      <div className="sk-switch" role="tablist" aria-label="方向">
        {SKINS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            className={
              item.id === active ? "sk-switch-btn sk-switch-btn--on" : "sk-switch-btn"
            }
            onClick={() => setSkin(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="sk-explain">
        <p>{current.blurb}</p>
        <p className="sk-why">{current.why}</p>
      </div>

      <div className="sk-switch sk-switch--sub" role="tablist" aria-label="画面">
        {SCREENS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === activeScreen}
            className={
              item.id === activeScreen
                ? "sk-switch-btn sk-switch-btn--on"
                : "sk-switch-btn"
            }
            onClick={() => setScreen(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="sk-gallery">
        <Phone
          skin={active}
          screen={activeScreen}
          label={`${current.name} · ${SCREENS.find((x) => x.id === activeScreen)?.label}`}
        />
        {SKINS.filter((x) => x.id !== active).map((item) => (
          <Phone
            key={item.id}
            skin={item.id}
            screen="map"
            label={`${item.name} · 地図`}
          />
        ))}
      </div>

      <footer className="sk-note">
        <p>
          採用したら Web の CSS 変数と iOS Palette を、選んだ方向に差し替えます（部品の骨格は維持）。
        </p>
        <p>
          <a href="/lab/mishiranu-eki">見知らぬ駅ラボへ戻る</a>
          {" · "}
          <a href="/lab/mishiranu-eki/station-chrome-samples?v=pill&tab=map">
            駅ヘッド（C）
          </a>
        </p>
      </footer>
    </div>
  );
}
