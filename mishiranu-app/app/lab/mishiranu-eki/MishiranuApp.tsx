"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GUIDE_COLOR,
  GUIDE_LABEL,
  GUIDE_ORDER,
  STATIONS,
  TIME_OPTIONS,
  pickSecret,
  spotGuide,
  spotsForTime,
  type GuideKind,
  type Spot,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";
import type { TourCopy } from "@/lib/mishiranu-copy";
import "./mishiranu.css";

const StationMap = dynamic(() => import("./StationMap"), {
  ssr: false,
  loading: () => (
    <div className="mishiranu-map mishiranu-map--live" aria-hidden="true">
      <div className="mishiranu-leaflet" />
    </div>
  ),
});

type Step = "hero" | "pick" | "tour";
type ChatPhase = "station" | "time" | "focus" | "ready";

type ChatMsg = {
  id: string;
  role: "guide" | "you";
  text: string;
};

type FocusChoice = GuideKind | "all";

function seedTourCopy(station: StationSeed): TourCopy {
  return {
    tourTitle: station.tourTitle,
    catchCopy: station.catchCopy,
    emptyHeadline: station.emptyCopy?.headline,
    emptyBody: station.emptyCopy?.body,
    source: "seed",
  };
}

function focusLabel(focus: FocusChoice): string {
  if (focus === "all") return "おまかせ（全部）";
  return GUIDE_LABEL[focus];
}

function parseFocusList(raw: string[] | undefined): GuideKind[] {
  if (!raw || raw.length === 0) return [];
  const allowed = new Set<GuideKind>(GUIDE_ORDER);
  return raw.filter((f): f is GuideKind => allowed.has(f as GuideKind));
}

type Props = {
  initialStep?: Step;
  initialStationId?: string;
  initialTimeId?: TimeOptionId;
  initialFocus?: string[];
};

let chatSeq = 0;
function nextMsgId(prefix: string) {
  chatSeq += 1;
  return `${prefix}-${chatSeq}`;
}

export default function MishiranuApp({
  initialStep = "hero",
  initialStationId,
  initialTimeId = "1h",
  initialFocus,
}: Props) {
  const startStationId =
    initialStationId && STATIONS.some((s) => s.id === initialStationId)
      ? initialStationId
      : STATIONS[0].id;

  const [step] = useState<Step>(initialStep);
  const [stationId, setStationId] = useState<string>(startStationId);
  const [timeId, setTimeId] = useState<TimeOptionId>(initialTimeId);
  const [focusKinds, setFocusKinds] = useState<GuideKind[]>(() =>
    parseFocusList(initialFocus),
  );
  const [query, setQuery] = useState("");
  const [showStationSearch, setShowStationSearch] = useState(false);
  const [chatPhase, setChatPhase] = useState<ChatPhase>("station");
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    {
      id: "g-open",
      role: "guide",
      text: "降りた駅の、徒歩圏だけを、物語にします。いま、どの駅にいますか？",
    },
  ]);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [secret, setSecret] = useState<Spot | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const [copy, setCopy] = useState<TourCopy | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const station = useMemo(
    () => STATIONS.find((s) => s.id === stationId) ?? STATIONS[0],
    [stationId],
  );

  const filteredStations = useMemo(() => {
    const q = query.trim();
    return STATIONS.filter((s) => {
      if (!q) return true;
      return (
        s.name.includes(q) ||
        s.prefecture.includes(q) ||
        s.line.includes(q) ||
        s.tourTitle.includes(q)
      );
    }).slice(0, 8);
  }, [query]);

  const time = TIME_OPTIONS.find((t) => t.id === timeId) ?? TIME_OPTIONS[0];
  const spots = useMemo(() => {
    const within = spotsForTime(station, time.index);
    if (focusKinds.length === 0) return within;
    return within.filter((s) => focusKinds.includes(spotGuide(s)));
  }, [station, time.index, focusKinds]);
  const activeSpot =
    spots.find((s) => s.id === activeSpotId) ??
    (activeSpotId ? null : spots[0] ?? null);
  const shownCopy = copy ?? seedTourCopy(station);

  useEffect(() => {
    if (step !== "pick") return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, showStationSearch, chatPhase, step]);

  async function loadCopy(nextStation: StationSeed, nextTimeId: TimeOptionId) {
    setCopyLoading(true);
    setCopy(seedTourCopy(nextStation));
    try {
      const res = await fetch("/api/mishiranu/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId: nextStation.id,
          timeId: nextTimeId,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as TourCopy;
      if (data.tourTitle && data.catchCopy) {
        setCopy(data);
      }
    } catch {
      // keep seed fallback
    } finally {
      setCopyLoading(false);
    }
  }

  useEffect(() => {
    if (step !== "tour") return;
    void loadCopy(station, timeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering tour via URL/state
  }, [step, stationId, timeId]);

  function pushMessages(...next: Omit<ChatMsg, "id">[]) {
    setMessages((prev) => [
      ...prev,
      ...next.map((m) => ({ ...m, id: nextMsgId(m.role) })),
    ]);
  }

  function chooseStation(next: StationSeed, spoken?: string) {
    setStationId(next.id);
    setShowStationSearch(false);
    setQuery("");
    setChatPhase("time");
    pushMessages(
      { role: "you", text: spoken ?? `${next.name}駅です` },
      {
        role: "guide",
        text: `${next.name}ですね。${next.prefecture}・${next.line}。今日はどれくらい寄り道できますか？`,
      },
    );
  }

  function chooseTime(nextId: TimeOptionId) {
    const t = TIME_OPTIONS.find((opt) => opt.id === nextId) ?? TIME_OPTIONS[0];
    setTimeId(t.id);
    setChatPhase("focus");
    pushMessages(
      { role: "you", text: `${t.label}くらい` },
      {
        role: "guide",
        text: "わかりました。案内では、何を多めに集めましょうか？",
      },
    );
  }

  function chooseFocus(choice: FocusChoice) {
    const kinds = choice === "all" ? [] : [choice];
    setFocusKinds(kinds);
    setChatPhase("ready");
    const focusText = focusLabel(choice);
    pushMessages(
      { role: "you", text: focusText },
      {
        role: "guide",
        text: `では、${station.name}の徒歩圏で「${focusText}」を開きます。`,
      },
    );
    window.setTimeout(() => {
      goTour(stationId, timeId, kinds);
    }, 650);
  }

  function goTour(
    nextStationId: string,
    nextTimeId: TimeOptionId = timeId,
    kinds: GuideKind[] = focusKinds,
  ) {
    const params = new URLSearchParams({
      view: "tour",
      station: nextStationId,
      time: nextTimeId,
    });
    if (kinds.length > 0) {
      params.set("focus", kinds.join(","));
    }
    window.location.assign(`?${params.toString()}`);
  }

  function drawSecret() {
    const next = pickSecret(spots);
    setSecret(next ?? null);
    setSecretOpen(true);
    if (next) setActiveSpotId(next.id);
  }

  async function shareTour() {
    const lines = [
      `【見知らぬ駅】${station.name}`,
      shownCopy.tourTitle,
      shownCopy.catchCopy,
      `${time.label} · 徒歩圏 約 ${station.radiiKm[time.index]} km`,
    ];
    if (focusKinds.length > 0) {
      lines.push(`案内の重点: ${focusKinds.map((k) => GUIDE_LABEL[k]).join("・")}`);
    }
    if (secret) {
      lines.push(`シークレット: ${secret.name}`);
    }
    const text = lines.join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareNote("物語テキストをコピーしました");
        return;
      }
    } catch {
      // fall through
    }
    setShareNote(text);
  }

  const guideBoardKinds =
    focusKinds.length > 0
      ? GUIDE_ORDER.filter((k) => focusKinds.includes(k))
      : GUIDE_ORDER;

  return (
    <div className="mishiranu">
      <div className="mishiranu-shell">
        {step === "hero" ? (
          <section className="mishiranu-hero" aria-label="見知らぬ駅">
            <div className="mishiranu-hero-copy">
              <p className="mishiranu-kicker">LAGADO LAB</p>
              <h1 className="mishiranu-brand">見知らぬ駅</h1>
              <p className="mishiranu-lead">
                降りた駅の、徒歩圏だけを、物語にする。予定のない寄り道を、いまここから。
              </p>
              <div className="mishiranu-cta-row">
                <a
                  className="mishiranu-btn mishiranu-btn--primary"
                  href="?view=pick"
                >
                  会話ではじめる
                </a>
                <a
                  className="mishiranu-btn"
                  href="?view=tour&station=demachiyanagi&time=1h"
                >
                  出町柳ですぐ見る
                </a>
              </div>
              <p className="mishiranu-fallback-links">
                押せないとき:{" "}
                <a href="?view=tour&station=demachiyanagi&time=1h">出町柳の物語へ</a>
              </p>
            </div>
          </section>
        ) : null}

        {step === "pick" ? (
          <section className="mishiranu-section mishiranu-chat" aria-labelledby="chat-title">
            <p className="mishiranu-kicker">CONVERSATION · 編集 {STATIONS.length} 駅</p>
            <h2 id="chat-title" className="mishiranu-h2">
              案内を、会話でつくる
            </h2>
            <p className="mishiranu-note">
              駅 → 時間 → 重点の順に答えれば、観光案内マップが開きます。
            </p>

            <div className="mishiranu-chat-thread" role="log" aria-live="polite">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.role === "guide"
                      ? "mishiranu-chat-bubble mishiranu-chat-bubble--guide"
                      : "mishiranu-chat-bubble mishiranu-chat-bubble--you"
                  }
                >
                  <span className="mishiranu-chat-role">
                    {msg.role === "guide" ? "案内" : "あなた"}
                  </span>
                  <p>{msg.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {chatPhase === "station" ? (
              <div className="mishiranu-chat-replies" aria-label="駅の答え">
                <button
                  type="button"
                  className="mishiranu-chat-chip mishiranu-chat-chip--primary"
                  onClick={() =>
                    chooseStation(
                      STATIONS.find((s) => s.id === "demachiyanagi") ??
                        STATIONS[0],
                      "出町柳にいます",
                    )
                  }
                >
                  出町柳にいます
                </button>
                <button
                  type="button"
                  className="mishiranu-chat-chip"
                  onClick={() => setShowStationSearch((v) => !v)}
                >
                  駅名で探す
                </button>
                {showStationSearch ? (
                  <div className="mishiranu-chat-search">
                    <label className="mishiranu-search">
                      <span className="mishiranu-search-label">駅名・路線</span>
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="例: 出町柳 / 叡山 / 京都"
                        autoComplete="off"
                        autoFocus
                      />
                    </label>
                    <ul className="mishiranu-chat-station-list">
                      {filteredStations.map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => chooseStation(s)}>
                            <span className="mishiranu-station-name">{s.name}</span>
                            <span className="mishiranu-station-meta">
                              {s.prefecture} · {s.line}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {filteredStations.length === 0 ? (
                      <p className="mishiranu-note">該当する駅がありません。</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {chatPhase === "time" ? (
              <div className="mishiranu-chat-replies" aria-label="時間の答え">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="mishiranu-chat-chip"
                    onClick={() => chooseTime(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}

            {chatPhase === "focus" ? (
              <div className="mishiranu-chat-replies" aria-label="重点の答え">
                <button
                  type="button"
                  className="mishiranu-chat-chip mishiranu-chat-chip--primary"
                  onClick={() => chooseFocus("all")}
                >
                  おまかせ
                </button>
                {GUIDE_ORDER.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="mishiranu-chat-chip"
                    onClick={() => chooseFocus(kind)}
                  >
                    <span
                      className="mishiranu-guide-dot"
                      style={{ background: GUIDE_COLOR[kind] }}
                      aria-hidden
                    />
                    {GUIDE_LABEL[kind]}
                  </button>
                ))}
              </div>
            ) : null}

            {chatPhase === "ready" ? (
              <p className="mishiranu-chat-opening">案内を開いています…</p>
            ) : null}

            <div className="mishiranu-actions">
              <a className="mishiranu-btn mishiranu-btn--ghost" href="?view=hero">
                はじめに戻る
              </a>
            </div>
          </section>
        ) : null}

        {step === "tour" ? (
          <section className="mishiranu-section" aria-labelledby="tour-title">
            <p className="mishiranu-kicker">
              {station.prefecture} · {station.line} · {time.label}
              {focusKinds.length > 0
                ? ` · ${focusKinds.map((k) => GUIDE_LABEL[k]).join("・")}`
                : ""}
              {copyLoading
                ? " · コピー生成中"
                : shownCopy.source === "ai"
                  ? " · Gemini 3.1 Flash-Lite"
                  : " · 編集コピー"}
            </p>
            <div className="mishiranu-tour">
              <p className="mishiranu-guide-eyebrow">{station.name}駅 · 観光案内</p>
              <h2
                id="tour-title"
                className={`mishiranu-tour-title${copyLoading ? " mishiranu-tour-title--loading" : ""}`}
              >
                {shownCopy.tourTitle}
              </h2>
              <p className="mishiranu-tour-catch">{shownCopy.catchCopy}</p>
              {station.stationIntro ? (
                <p className="mishiranu-station-intro">{station.stationIntro}</p>
              ) : null}
              <p className="mishiranu-radius">
                徒歩圏 約 {station.radiiKm[time.index]} km · 案内ピン{" "}
                {spots.length} 件
              </p>
            </div>

            {station.mood === "empty" &&
            (shownCopy.emptyHeadline || shownCopy.emptyBody) ? (
              <div className="mishiranu-empty">
                {shownCopy.emptyHeadline ? (
                  <h3>{shownCopy.emptyHeadline}</h3>
                ) : null}
                {shownCopy.emptyBody ? <p>{shownCopy.emptyBody}</p> : null}
              </div>
            ) : null}

            <StationMap
              station={station}
              spots={spots}
              radiusKm={station.radiiKm[time.index]}
              activeSpotId={activeSpotId ?? activeSpot?.id ?? null}
              onSelect={setActiveSpotId}
            />

            <ul className="mishiranu-legend">
              {guideBoardKinds.map((kind) => (
                <li key={kind}>
                  <span style={{ background: GUIDE_COLOR[kind] }} />
                  {GUIDE_LABEL[kind]}
                </li>
              ))}
            </ul>

            <div className="mishiranu-guide-board">
              {guideBoardKinds.map((kind) => {
                const items = spots.filter((s) => spotGuide(s) === kind);
                if (items.length === 0) return null;
                return (
                  <section
                    key={kind}
                    className="mishiranu-guide-col"
                    aria-labelledby={`guide-${kind}`}
                  >
                    <h3 id={`guide-${kind}`} className="mishiranu-guide-col-title">
                      <span
                        className="mishiranu-guide-dot"
                        style={{ background: GUIDE_COLOR[kind] }}
                      />
                      {GUIDE_LABEL[kind]}
                    </h3>
                    <ul className="mishiranu-guide-list">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={
                              activeSpotId === item.id
                                ? "mishiranu-guide-item mishiranu-guide-item--active"
                                : "mishiranu-guide-item"
                            }
                            aria-pressed={activeSpotId === item.id}
                            onClick={() => setActiveSpotId(item.id)}
                          >
                            <span className="mishiranu-guide-item-name">
                              {item.name}
                            </span>
                            <span className="mishiranu-guide-item-meta">
                              徒歩約 {item.walkMinutes} 分
                            </span>
                            <span className="mishiranu-guide-item-blurb">
                              {item.blurb}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            {activeSpot ? (
              <div className="mishiranu-spot-panel">
                <p className="mishiranu-spot-genre">
                  {GUIDE_LABEL[spotGuide(activeSpot)]} · 徒歩約{" "}
                  {activeSpot.walkMinutes} 分
                </p>
                <h3 className="mishiranu-spot-name">{activeSpot.name}</h3>
                <p className="mishiranu-spot-blurb">{activeSpot.blurb}</p>
              </div>
            ) : null}

            <div className="mishiranu-actions">
              <button
                type="button"
                className="mishiranu-btn mishiranu-btn--primary"
                onClick={drawSecret}
              >
                とりあえずここに行け
              </button>
              <button
                type="button"
                className="mishiranu-btn"
                disabled={copyLoading}
                onClick={() => void loadCopy(station, timeId)}
              >
                コピーを引き直す
              </button>
              <button
                type="button"
                className="mishiranu-btn"
                onClick={() => void shareTour()}
              >
                物語をコピー
              </button>
              <a className="mishiranu-btn mishiranu-btn--ghost" href="?view=pick">
                会話をやり直す
              </a>
            </div>

            {shareNote ? (
              <p className="mishiranu-share-note" aria-live="polite">
                {shareNote}
              </p>
            ) : null}

            {secretOpen && secret ? (
              <div className="mishiranu-secret" aria-live="polite">
                <p className="mishiranu-secret-label">SECRET DESTINATION</p>
                <h3 className="mishiranu-spot-name">{secret.name}</h3>
                <p className="mishiranu-spot-blurb">{secret.blurb}</p>
                <div className="mishiranu-actions">
                  <button
                    type="button"
                    className="mishiranu-btn"
                    onClick={drawSecret}
                  >
                    もう一回ひく
                  </button>
                </div>
              </div>
            ) : null}

            <p className="mishiranu-foot">
              地図は OpenStreetMap。出町柳ピンは実座標寄り。
              GEMINI_API_KEY があれば Gemini 3.1 Flash-Lite、なければ編集文です。
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
