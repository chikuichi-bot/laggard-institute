"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { sampleStation, sentences } from "./sample-data";

const s = sampleStation;
const intro = sentences(s.stationIntro);
const walk = sentences(s.walkGuide);

type SampleId = "board" | "wayfinding" | "kiosk";

const SAMPLES: Array<{ id: SampleId; name: string; blurb: string }> = [
  {
    id: "board",
    name: "A · 駅前案内板",
    blurb: "駅前の金属・琺瑯の案内板。見出し帯が強く、番号で拾える。",
  },
  {
    id: "wayfinding",
    name: "B · 道標パネル",
    blurb: "色帯の道標を積み重ねる。一目で「何の案内か」がわかる。",
  },
  {
    id: "kiosk",
    name: "C · 観光看板",
    blurb: "観光案内所の立て看板。要点チップと、読む順がはっきり。",
  },
];

function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="ps-phone">
      <div className="ps-phone-bezel" aria-label={label}>
        <div className="ps-phone-notch" aria-hidden />
        <div className="ps-phone-screen">{children}</div>
      </div>
      <figcaption className="ps-phone-cap">{label}</figcaption>
    </figure>
  );
}

function ListenChip({ tone = "light" }: { tone?: "light" | "dark" | "warm" }) {
  return (
    <button type="button" className={`ps-listen ps-listen--${tone}`}>
      <img src="/ejp/B_information.svg" alt="" width={18} height={18} />
      <span>
        <strong>土地案内を聞く</strong>
        <small>駅に着く前に、イヤホンで</small>
      </span>
    </button>
  );
}

function TabBar({ active = "place" }: { active?: string }) {
  const tabs = [
    { id: "map", label: "地図", icon: "/ejp/B_destination.svg" },
    { id: "place", label: "土地", icon: "/ejp/B_history.svg" },
    { id: "walk", label: "歩く", icon: "/ejp/A_trekking.svg" },
    { id: "guide", label: "案内", icon: "/ejp/B_information.svg" },
    { id: "more", label: "ほか", icon: "/ejp/B_hamburger-menu.svg" },
  ];
  return (
    <nav className="ps-tabs" aria-label="案内のページ">
      {tabs.map((t) => (
        <span
          key={t.id}
          className={t.id === active ? "ps-tab ps-tab--on" : "ps-tab"}
        >
          <img src={t.icon} alt="" width={22} height={22} />
          {t.label}
        </span>
      ))}
    </nav>
  );
}

/** A: 駅前の案内板 — 濃い見出し帯 + 番号インデックス */
function SampleBoard() {
  return (
    <div className="ps-app ps-a">
      <header className="ps-a-top">
        <p className="ps-meta">
          {s.prefecture} · {s.line}
        </p>
        <div className="ps-a-signhead">
          <span className="ps-a-badge">土地案内</span>
          <h1>{s.name}</h1>
          <p>{s.tourTitle}</p>
        </div>
      </header>
      <div className="ps-scroll">
        <ListenChip tone="warm" />
        <ol className="ps-a-index" aria-label="この案内の目次">
          <li>
            <b>01</b>この駅
          </li>
          <li>
            <b>02</b>歩き方
          </li>
          <li>
            <b>03</b>歴史
          </li>
          <li>
            <b>04</b>観光
          </li>
        </ol>
        <section className="ps-a-panel">
          <div className="ps-a-panel-head">
            <span className="ps-a-num">01</span>
            <h2>この駅のこと</h2>
          </div>
          {intro.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        <section className="ps-a-panel ps-a-panel--moss">
          <div className="ps-a-panel-head">
            <span className="ps-a-num">02</span>
            <img src="/ejp/A_trekking.svg" alt="" width={18} height={18} />
            <h2>歩き方の目安</h2>
          </div>
          {walk.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        <section className="ps-a-panel">
          <div className="ps-a-panel-head">
            <span className="ps-a-num">03</span>
            <img src="/ejp/B_history.svg" alt="" width={18} height={18} />
            <h2>このエリアのこと・歴史</h2>
          </div>
          {s.areaAbout.map((p) => (
            <p key={p.slice(0, 12)}>{p}</p>
          ))}
          <ol className="ps-a-notes">
            {s.historyNotes.map((n, i) => (
              <li key={n.title}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="ps-a-panel">
          <div className="ps-a-panel-head">
            <span className="ps-a-num">04</span>
            <img src="/ejp/B_photo-spot.svg" alt="" width={18} height={18} />
            <h2>観光案内メモ</h2>
          </div>
          <ol className="ps-a-notes">
            {s.sightseeingNotes.map((n, i) => (
              <li key={n.title}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <TabBar />
    </div>
  );
}

/** B: 道標パネル — 色帯の刃を積む */
function SampleWayfinding() {
  return (
    <div className="ps-app ps-b">
      <header className="ps-b-top">
        <p className="ps-meta">
          ← 駅を探し直す · {s.dayPart} · {s.stay}
        </p>
        <h1>{s.name}</h1>
        <p className="ps-b-sub">{s.tourTitle}</p>
      </header>
      <div className="ps-scroll">
        <div className="ps-b-blade ps-b-blade--listen">
          <ListenChip tone="light" />
        </div>
        <section className="ps-b-blade ps-b-blade--ink">
          <div className="ps-b-flag">
            <img src="/ejp/T_train.svg" alt="" width={20} height={20} />
            <span>この駅</span>
          </div>
          {intro.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        <section className="ps-b-blade ps-b-blade--moss">
          <div className="ps-b-flag">
            <img src="/ejp/A_trekking.svg" alt="" width={20} height={20} />
            <span>歩き方</span>
          </div>
          {walk.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        <section className="ps-b-blade ps-b-blade--gold">
          <div className="ps-b-flag">
            <img src="/ejp/B_history.svg" alt="" width={20} height={20} />
            <span>歴史</span>
          </div>
          {s.areaAbout.slice(0, 1).map((p) => (
            <p key={p.slice(0, 12)}>{p}</p>
          ))}
          <ul className="ps-b-list">
            {s.historyNotes.map((n) => (
              <li key={n.title}>
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="ps-b-blade ps-b-blade--river">
          <div className="ps-b-flag">
            <img src="/ejp/B_photo-spot.svg" alt="" width={20} height={20} />
            <span>観光メモ</span>
          </div>
          <ul className="ps-b-list">
            {s.sightseeingNotes.map((n) => (
              <li key={n.title}>
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <TabBar />
    </div>
  );
}

/** C: 観光看板 — 要点チップ + 読む順が明確 */
function SampleKiosk() {
  return (
    <div className="ps-app ps-c">
      <header className="ps-c-top">
        <p className="ps-meta">
          {s.prefecture} · {s.line} · {s.dayPart} · {s.stay}
        </p>
        <p className="ps-c-kicker">見知らぬ駅 · 土地案内</p>
        <h1>{s.name}</h1>
        <p className="ps-c-lead">{s.tourTitle}</p>
      </header>
      <div className="ps-scroll">
        <div className="ps-c-board">
          <ListenChip tone="warm" />
          <div className="ps-c-points" aria-label="この土地の要点">
            {s.points.map((p, i) => (
              <span key={p} className="ps-c-chip">
                <b>{String(i + 1).padStart(2, "0")}</b>
                {p}
              </span>
            ))}
          </div>
          <section className="ps-c-block">
            <h2>
              <img src="/ejp/T_train.svg" alt="" width={18} height={18} />
              はじめに
            </h2>
            {intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
          <section className="ps-c-block ps-c-block--tint">
            <h2>
              <img src="/ejp/A_trekking.svg" alt="" width={18} height={18} />
              歩き方の目安
            </h2>
            {walk.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
          <section className="ps-c-block">
            <h2>
              <img src="/ejp/B_history.svg" alt="" width={18} height={18} />
              歴史
            </h2>
            {s.areaAbout.map((p) => (
              <p key={p.slice(0, 12)}>{p}</p>
            ))}
            <div className="ps-c-cards">
              {s.historyNotes.map((n, i) => (
                <article key={n.title}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="ps-c-block">
            <h2>
              <img src="/ejp/B_photo-spot.svg" alt="" width={18} height={18} />
              観光案内メモ
            </h2>
            <div className="ps-c-cards">
              {s.sightseeingNotes.map((n, i) => (
                <article key={n.title}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
      <TabBar />
    </div>
  );
}

export default function PlaceSamples() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("v");
  const active: SampleId =
    raw === "wayfinding" || raw === "kiosk" || raw === "board" ? raw : "board";

  function select(id: SampleId) {
    router.replace(`?v=${id}`, { scroll: false });
  }

  return (
    <div className="ps">
      <header className="ps-hero">
        <p className="ps-hero-kicker">見知らぬ駅 · UI サンプル</p>
        <h1>土地ページを、観光案内の標識みたいに</h1>
        <p className="ps-hero-lead">
          採用：A · 駅前案内板。濃い見出し帯と番号索引の型を、iPhone
          の土地ページに反映しています。
        </p>
        <div className="ps-picker" role="tablist" aria-label="サンプル切替">
          {SAMPLES.map((item) => (
            <a
              key={item.id}
              role="tab"
              href={`?v=${item.id}`}
              aria-selected={active === item.id}
              className={
                active === item.id ? "ps-pick ps-pick--on" : "ps-pick"
              }
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
      </header>

      <div className="ps-stage">
        <div className="ps-stage-mobile">
          <Phone label={SAMPLES.find((x) => x.id === active)!.name}>
            {active === "board" ? (
              <SampleBoard />
            ) : active === "wayfinding" ? (
              <SampleWayfinding />
            ) : (
              <SampleKiosk />
            )}
          </Phone>
        </div>
        <div className="ps-stage-desktop" aria-label="三案の一覧">
          <Phone label="A · 駅前案内板">
            <SampleBoard />
          </Phone>
          <Phone label="B · 道標パネル">
            <SampleWayfinding />
          </Phone>
          <Phone label="C · 観光看板">
            <SampleKiosk />
          </Phone>
        </div>
      </div>
    </div>
  );
}
