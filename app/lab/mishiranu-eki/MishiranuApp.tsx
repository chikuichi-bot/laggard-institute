"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  GUIDE_COLOR,
  GUIDE_LABEL,
  GUIDE_ORDER,
  STATIONS,
  TIME_OPTIONS,
  bikeRentalFor,
  pickSecret,
  spotGuide,
  spotsForTime,
  type GuideKind,
  type Spot,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";
import type { TourCopy } from "@/lib/mishiranu-copy";
import {
  FlowDiagram,
  PolishLoopDiagram,
  RadiusDiagram,
} from "./MishiranuDiagrams";
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

function matchStation(text: string): StationSeed | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const byName = STATIONS.find(
    (s) => t.includes(s.name) || s.name.includes(t.replace(/駅$/, "")),
  );
  if (byName) return byName;
  return STATIONS.find(
    (s) =>
      t.includes(s.prefecture) ||
      t.includes(s.line) ||
      s.line.split(/[\/・]/).some((part) => part && t.includes(part.trim())),
  );
}

function matchTime(text: string): TimeOptionId | undefined {
  const t = text.trim();
  if (/半日|午後いっぱい|半にち/.test(t)) return "half";
  if (/3\s*時間|三時間|さんじかん|半日未満|ゆっくり/.test(t)) return "3h";
  if (/1\s*時間|一時間|ひと時間|ちょっと|短め|すぐ/.test(t)) return "1h";
  const hit = TIME_OPTIONS.find((opt) => t.includes(opt.label));
  return hit?.id;
}

function matchFocus(text: string): FocusChoice | undefined {
  const t = text.trim();
  if (/おまかせ|全部|なんでも|どれでも|全体/.test(t)) return "all";
  if (/ご飯|ごはん|食事|ランチ|食べる|グルメ|飯/.test(t)) return "meal";
  if (/土産|みやげ|お土産|手土産/.test(t)) return "souvenir";
  if (/見所|みどころ|景色|観光|名所|歴史|昔|由来/.test(t)) return "sight";
  if (/休む|休憩|やすむ|カフェ休み|一休み|ベンチ/.test(t)) return "rest";
  if (/寄り道|よみち|暇つぶし|ひまつぶし/.test(t)) return "tip";
  return undefined;
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

const OPENING_GUIDE =
  "降りた駅の、徒歩圏だけを、物語にします。いま、どの駅にいますか？ ボタンでも、そのまま入力でも大丈夫です。";

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

  const [step, setStep] = useState<Step>(initialStep);
  const [stationId, setStationId] = useState<string>(startStationId);
  const [timeId, setTimeId] = useState<TimeOptionId>(initialTimeId);
  const [focusKinds, setFocusKinds] = useState<GuideKind[]>(() =>
    parseFocusList(initialFocus),
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showStationSearch, setShowStationSearch] = useState(false);
  const [chatPhase, setChatPhase] = useState<ChatPhase>("station");
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    {
      id: "g-open",
      role: "guide",
      text: OPENING_GUIDE,
    },
  ]);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [secret, setSecret] = useState<Spot | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const [copy, setCopy] = useState<TourCopy | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const stationIdRef = useRef(stationId);
  const timeIdRef = useRef(timeId);
  const urlBootstrapped = useRef(false);
  stationIdRef.current = stationId;
  timeIdRef.current = timeId;

  const station = useMemo(
    () => STATIONS.find((s) => s.id === stationId) ?? STATIONS[0],
    [stationId],
  );
  const bikeRental = useMemo(() => bikeRentalFor(station), [station]);

  // Static host (lagado.jp) では searchParams がビルド時固定なので、URL をクライアントで読む
  useEffect(() => {
    if (urlBootstrapped.current) return;
    urlBootstrapped.current = true;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const stationParam = params.get("station");
    const timeParam = params.get("time");
    const focusParam = params.get("focus");
    if (view === "hero" || view === "pick" || view === "tour") {
      setStep(view);
    }
    if (stationParam && STATIONS.some((s) => s.id === stationParam)) {
      setStationId(stationParam);
    }
    if (timeParam === "1h" || timeParam === "3h" || timeParam === "half") {
      setTimeId(timeParam);
    }
    if (focusParam) {
      setFocusKinds(
        parseFocusList(
          focusParam.split(",").map((f) => f.trim()).filter(Boolean),
        ),
      );
    }
  }, []);

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
  // ご飯・お土産・観光・休むところ・寄り道は常に全部出す（重点は並びだけ）
  const spots = useMemo(
    () => spotsForTime(station, time.index),
    [station, time.index],
  );
  const activeSpot =
    spots.find((s) => s.id === activeSpotId) ??
    (activeSpotId ? null : spots[0] ?? null);
  const shownCopy = copy ?? seedTourCopy(station);

  useEffect(() => {
    if (step !== "pick") return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, showStationSearch, chatPhase, step, draft]);

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

  function syncUrl(
    nextStep: Step,
    nextStationId: string,
    nextTimeId: TimeOptionId,
    kinds: GuideKind[],
  ) {
    const params = new URLSearchParams();
    params.set("view", nextStep);
    if (nextStep === "tour") {
      params.set("station", nextStationId);
      params.set("time", nextTimeId);
      if (kinds.length > 0) params.set("focus", kinds.join(","));
    }
    window.history.pushState({}, "", `?${params.toString()}`);
  }

  function goHero() {
    setStep("hero");
    syncUrl("hero", stationIdRef.current, timeIdRef.current, focusKinds);
  }

  function goChat(reset = false) {
    setStep("pick");
    if (reset) {
      setChatPhase("station");
      setShowStationSearch(false);
      setQuery("");
      setDraft("");
      setMessages([
        {
          id: nextMsgId("guide"),
          role: "guide",
          text: OPENING_GUIDE,
        },
      ]);
    }
    syncUrl("pick", stationIdRef.current, timeIdRef.current, focusKinds);
  }

  function chooseStation(next: StationSeed, spoken?: string) {
    setStationId(next.id);
    setShowStationSearch(false);
    setQuery("");
    setDraft("");
    setChatPhase("time");
    pushMessages(
      { role: "you", text: spoken ?? `${next.name}駅です` },
      {
        role: "guide",
        text: `${next.name}ですね。${next.prefecture}・${next.line}。今日はどれくらい寄り道できますか？`,
      },
    );
  }

  function chooseTime(nextId: TimeOptionId, spoken?: string) {
    const t = TIME_OPTIONS.find((opt) => opt.id === nextId) ?? TIME_OPTIONS[0];
    setTimeId(t.id);
    setDraft("");
    setChatPhase("focus");
    pushMessages(
      { role: "you", text: spoken ?? `${t.label}くらい` },
      {
        role: "guide",
        text: "わかりました。案内ではご飯・お土産・観光・休むところ・寄り道を必ず出します。とくに多めに見たいものはありますか？ なければおまかせでどうぞ。",
      },
    );
  }

  function chooseFocus(choice: FocusChoice, spoken?: string) {
    const kinds = choice === "all" ? [] : [choice];
    const nextStationId = stationIdRef.current;
    const nextTimeId = timeIdRef.current;
    setFocusKinds(kinds);
    setDraft("");
    setChatPhase("ready");
    const focusText = focusLabel(choice);
    const named =
      STATIONS.find((s) => s.id === nextStationId)?.name ?? station.name;
    pushMessages(
      { role: "you", text: spoken ?? focusText },
      {
        role: "guide",
        text:
          choice === "all"
            ? `では、${named}の徒歩圏で5つの案内を開きます。会話はこのまま残しておきますね。`
            : `では、${named}の徒歩圏を開きます。5つは全部出しつつ、「${focusText}」を先に見やすくします。`,
      },
    );
    window.setTimeout(() => {
      goTour(nextStationId, nextTimeId, kinds);
    }, 500);
  }

  function goTour(
    nextStationId: string,
    nextTimeId: TimeOptionId = timeIdRef.current,
    kinds: GuideKind[] = focusKinds,
  ) {
    setStationId(nextStationId);
    setTimeId(nextTimeId);
    setFocusKinds(kinds);
    setActiveSpotId(null);
    setSecret(null);
    setSecretOpen(false);
    setStep("tour");
    setChatPhase("ready");
    syncUrl("tour", nextStationId, nextTimeId, kinds);
  }

  function handleComposerSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || chatPhase === "ready") return;

    if (chatPhase === "station") {
      const hit = matchStation(text);
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "その駅名は、いまの編集リストに見つかりませんでした。出町柳や駅名の一部でもう一度どうぞ。",
          },
        );
        setDraft("");
        return;
      }
      chooseStation(hit, text);
      return;
    }

    if (chatPhase === "time") {
      const hit = matchTime(text);
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "時間は「1時間」「3時間」「半日」のどれかで教えてください。",
          },
        );
        setDraft("");
        return;
      }
      chooseTime(hit, text);
      return;
    }

    if (chatPhase === "focus") {
      const hit = matchFocus(text);
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "重点は「ご飯」「お土産」「観光」「休むところ」「寄り道」、または「おまかせ」でお願いします。5つはどれを選んでも全部出ます。",
          },
        );
        setDraft("");
        return;
      }
      chooseFocus(hit, text);
    }
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
      ? [
          ...focusKinds,
          ...GUIDE_ORDER.filter((k) => !focusKinds.includes(k)),
        ]
      : GUIDE_ORDER;

  const composerPlaceholder =
    chatPhase === "station"
      ? "例: 出町柳にいます"
      : chatPhase === "time"
        ? "例: 3時間くらい"
        : chatPhase === "focus"
          ? "例: 休むところ多めで / おまかせ"
          : "";

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
                <button
                  type="button"
                  className="mishiranu-btn mishiranu-btn--primary"
                  onClick={() => goChat(true)}
                >
                  会話ではじめる
                </button>
                <button
                  type="button"
                  className="mishiranu-btn"
                  onClick={() => goTour("demachiyanagi", "1h", [])}
                >
                  出町柳ですぐ見る
                </button>
              </div>
              <p className="mishiranu-fallback-links">
                押せないとき:{" "}
                <a href="?view=tour&station=demachiyanagi&time=1h">出町柳の物語へ</a>
                {" · "}
                <a href="?view=pick">会話へ</a>
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
              駅 → 時間 → 重点。チップでも、下の入力欄でも答えられます。案内を開いても会話は残ります。
            </p>
            <FlowDiagram />
            <PolishLoopDiagram />

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
            ) : (
              <form className="mishiranu-chat-composer" onSubmit={handleComposerSubmit}>
                <label className="mishiranu-search">
                  <span className="mishiranu-search-label">メッセージ</span>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={composerPlaceholder}
                    autoComplete="off"
                  />
                </label>
                <button
                  type="submit"
                  className="mishiranu-btn mishiranu-btn--primary"
                  disabled={!draft.trim()}
                >
                  送る
                </button>
              </form>
            )}

            <div className="mishiranu-actions">
              <button
                type="button"
                className="mishiranu-btn mishiranu-btn--ghost"
                onClick={goHero}
              >
                はじめに戻る
              </button>
            </div>
          </section>
        ) : null}

        {step === "tour" ? (
          <section className="mishiranu-section" aria-labelledby="tour-title">
            {messages.length > 1 ? (
              <details className="mishiranu-chat-summary">
                <summary>これまでの会話</summary>
                <div className="mishiranu-chat-thread mishiranu-chat-thread--compact">
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
                </div>
              </details>
            ) : null}

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

            <section
              className="mishiranu-bike-rental"
              aria-labelledby="bike-rental-title"
            >
              <p className="mishiranu-kicker">MOBILITY</p>
              <h3 id="bike-rental-title" className="mishiranu-bike-rental-title">
                レンタサイクル
              </h3>
              <p
                className={
                  bikeRental.available
                    ? "mishiranu-bike-rental-status mishiranu-bike-rental-status--yes"
                    : "mishiranu-bike-rental-status"
                }
              >
                {bikeRental.available
                  ? "駅周辺で借りられます"
                  : "いまは未確認／少なめ"}
              </p>
              <p className="mishiranu-bike-rental-summary">{bikeRental.summary}</p>
              {bikeRental.places && bikeRental.places.length > 0 ? (
                <ul className="mishiranu-bike-rental-places">
                  {bikeRental.places.map((place) => (
                    <li key={place.name}>
                      <span className="mishiranu-bike-rental-place-name">
                        {place.name}
                      </span>
                      {typeof place.walkMinutes === "number" ? (
                        <span className="mishiranu-bike-rental-place-meta">
                          徒歩約 {place.walkMinutes} 分
                        </span>
                      ) : null}
                      {place.note ? (
                        <span className="mishiranu-bike-rental-place-note">
                          {place.note}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {station.areaAbout ||
            (station.historyNotes && station.historyNotes.length > 0) ? (
              <section
                className="mishiranu-area-story"
                aria-labelledby="area-story-title"
              >
                <p className="mishiranu-kicker">AREA · HISTORY</p>
                <h3 id="area-story-title" className="mishiranu-area-story-title">
                  このエリアのこと
                </h3>
                {station.areaAbout ? (
                  <p className="mishiranu-area-about">{station.areaAbout}</p>
                ) : null}
                {station.historyNotes && station.historyNotes.length > 0 ? (
                  <ol className="mishiranu-history-list">
                    {station.historyNotes.map((note) => (
                      <li key={note.title}>
                        <h4>{note.title}</h4>
                        <p>{note.body}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ) : null}

            {station.mood === "empty" &&
            (shownCopy.emptyHeadline || shownCopy.emptyBody) ? (
              <div className="mishiranu-empty">
                {shownCopy.emptyHeadline ? (
                  <h3>{shownCopy.emptyHeadline}</h3>
                ) : null}
                {shownCopy.emptyBody ? <p>{shownCopy.emptyBody}</p> : null}
              </div>
            ) : null}

            <RadiusDiagram
              stationName={station.name}
              radiusKm={station.radiiKm[time.index]}
            />

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
                const prioritized = focusKinds.includes(kind);
                return (
                  <section
                    key={kind}
                    className={
                      prioritized
                        ? "mishiranu-guide-col mishiranu-guide-col--priority"
                        : "mishiranu-guide-col"
                    }
                    aria-labelledby={`guide-${kind}`}
                  >
                    <h3 id={`guide-${kind}`} className="mishiranu-guide-col-title">
                      <span
                        className="mishiranu-guide-dot"
                        style={{ background: GUIDE_COLOR[kind] }}
                      />
                      {GUIDE_LABEL[kind]}
                      {prioritized ? (
                        <span className="mishiranu-guide-priority">重点</span>
                      ) : null}
                    </h3>
                    {items.length > 0 ? (
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
                    ) : (
                      <p className="mishiranu-guide-empty">
                        この徒歩圏・時間ではまだ少なめです。時間を延ばすと増えることがあります。
                      </p>
                    )}
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
              <button
                type="button"
                className="mishiranu-btn mishiranu-btn--ghost"
                onClick={() => goChat(true)}
              >
                会話をやり直す
              </button>
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
