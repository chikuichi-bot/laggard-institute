"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GENRE_LABEL,
  REGIONS,
  STATIONS,
  TIME_OPTIONS,
  pickSecret,
  spotsForTime,
  type Spot,
  type SpotGenre,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";
import type { TourCopy } from "@/lib/mishiranu-copy";
import "./mishiranu.css";

type Step = "hero" | "pick" | "tour";

const GENRE_ORDER: SpotGenre[] = ["history", "gourmet", "nature", "odd"];

function seedTourCopy(station: StationSeed): TourCopy {
  return {
    tourTitle: station.tourTitle,
    catchCopy: station.catchCopy,
    emptyHeadline: station.emptyCopy?.headline,
    emptyBody: station.emptyCopy?.body,
    source: "seed",
  };
}

type Props = {
  initialStep?: Step;
  initialStationId?: string;
  initialTimeId?: TimeOptionId;
};

export default function MishiranuApp({
  initialStep = "hero",
  initialStationId,
  initialTimeId = "1h",
}: Props) {
  const startStationId =
    initialStationId && STATIONS.some((s) => s.id === initialStationId)
      ? initialStationId
      : STATIONS[0].id;

  const [step, setStep] = useState<Step>(initialStep);
  const [stationId, setStationId] = useState<string>(startStationId);
  const [timeId, setTimeId] = useState<TimeOptionId>(initialTimeId);
  const [regionFilter, setRegionFilter] = useState<string>("すべて");
  const [query, setQuery] = useState("");
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [secret, setSecret] = useState<Spot | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const [copy, setCopy] = useState<TourCopy | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const station = useMemo(
    () => STATIONS.find((s) => s.id === stationId) ?? STATIONS[0],
    [stationId],
  );

  const filteredStations = useMemo(() => {
    const q = query.trim();
    return STATIONS.filter((s) => {
      if (regionFilter !== "すべて" && s.region !== regionFilter) return false;
      if (!q) return true;
      return (
        s.name.includes(q) ||
        s.prefecture.includes(q) ||
        s.line.includes(q) ||
        s.tourTitle.includes(q)
      );
    });
  }, [regionFilter, query]);

  const time = TIME_OPTIONS.find((t) => t.id === timeId) ?? TIME_OPTIONS[0];
  const spots = useMemo(
    () => spotsForTime(station, time.index),
    [station, time.index],
  );
  const activeSpot = spots.find((s) => s.id === activeSpotId) ?? spots[0];
  const ringSize = `${28 + time.index * 18}%`;
  const shownCopy = copy ?? seedTourCopy(station);

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

  function goTour(nextStationId: string, nextTimeId: TimeOptionId = timeId) {
    const params = new URLSearchParams({
      view: "tour",
      station: nextStationId,
      time: nextTimeId,
    });
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
                  この駅で始める
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
          <section className="mishiranu-section" aria-labelledby="pick-title">
            <p className="mishiranu-kicker">STEP 1 · 編集 {STATIONS.length} 駅</p>
            <h2 id="pick-title" className="mishiranu-h2">
              どこに降りましたか
            </h2>
            <p className="mishiranu-note">
              いまは編集キュレーションの駅だけ。抽象マップで温度を固めています。実地図と
              iOS は後段です。
            </p>

            <label className="mishiranu-search">
              <span className="mishiranu-search-label">駅名・路線で探す</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例: 出町柳 / 叡山 / 京都"
                autoComplete="off"
              />
            </label>

            <div className="mishiranu-region-row" role="group" aria-label="地方で絞る">
              <button
                type="button"
                aria-pressed={regionFilter === "すべて"}
                onClick={() => setRegionFilter("すべて")}
              >
                すべて
              </button>
              {REGIONS.filter((region) =>
                STATIONS.some((s) => s.region === region),
              ).map((region) => (
                <button
                  key={region}
                  type="button"
                  aria-pressed={regionFilter === region}
                  onClick={() => setRegionFilter(region)}
                >
                  {region}
                </button>
              ))}
            </div>

            <ul className="mishiranu-station-list">
              {filteredStations.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={stationId === s.id}
                    onClick={() => setStationId(s.id)}
                  >
                    <span className="mishiranu-station-name">{s.name}</span>
                    <span className="mishiranu-station-meta">
                      {s.prefecture} · {s.line}
                      {s.mood === "empty" ? " · 何もないを楽しむ" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {filteredStations.length === 0 ? (
              <p className="mishiranu-note">該当する駅がありません。</p>
            ) : null}

            <div className="mishiranu-section" style={{ paddingTop: "2rem" }}>
              <p className="mishiranu-kicker">STEP 2</p>
              <h2 className="mishiranu-h2">どれくらいいられますか</h2>
              <div className="mishiranu-time-row" role="group" aria-label="滞在時間">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={timeId === t.id}
                    onClick={() => setTimeId(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mishiranu-actions">
                <button
                  type="button"
                  className="mishiranu-btn mishiranu-btn--primary"
                  disabled={filteredStations.length === 0}
                  onClick={() => goTour(stationId, timeId)}
                >
                  物語をつくる
                </button>
                <a className="mishiranu-btn mishiranu-btn--ghost" href="?view=hero">
                  戻る
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {step === "tour" ? (
          <section className="mishiranu-section" aria-labelledby="tour-title">
            <p className="mishiranu-kicker">
              {station.prefecture} · {station.line} · {time.label}
              {copyLoading
                ? " · コピー生成中"
                : shownCopy.source === "ai"
                  ? " · Gemini 3.1 Flash-Lite"
                  : " · 編集コピー"}
            </p>
            <div className="mishiranu-tour">
              <h2
                id="tour-title"
                className={`mishiranu-tour-title${copyLoading ? " mishiranu-tour-title--loading" : ""}`}
              >
                {shownCopy.tourTitle}
              </h2>
              <p className="mishiranu-tour-catch">{shownCopy.catchCopy}</p>
              <p className="mishiranu-radius">
                徒歩圏 約 {station.radiiKm[time.index]} km · ピン {spots.length}{" "}
                件
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

            <div
              className={`mishiranu-map${station.mood === "empty" ? " mishiranu-map--empty" : ""}`}
              role="img"
              aria-label={`${station.name}駅周辺の抽象マップ`}
            >
              <div className="mishiranu-map-rails" aria-hidden="true" />
              <div className="mishiranu-map-mist" aria-hidden="true" />
              <div
                className="mishiranu-map-ring"
                style={{ ["--ring-size" as string]: ringSize }}
              />
              <div className="mishiranu-map-station" title={`${station.name}駅`} />
              <span className="mishiranu-map-station-label">{station.name}</span>
              {spots.map((spot, i) => (
                <button
                  key={spot.id}
                  type="button"
                  className="mishiranu-pin"
                  data-genre={spot.genre}
                  style={{
                    left: `${spot.x * 100}%`,
                    top: `${spot.y * 100}%`,
                    animationDelay: `${0.08 * i}s`,
                  }}
                  aria-label={spot.name}
                  aria-pressed={activeSpot?.id === spot.id}
                  onClick={() => setActiveSpotId(spot.id)}
                />
              ))}
            </div>

            <ul className="mishiranu-legend">
              {GENRE_ORDER.map((genre) => (
                <li key={genre}>
                  <span
                    style={{
                      background:
                        genre === "history"
                          ? "#9bb7c9"
                          : genre === "gourmet"
                            ? "#d4a574"
                            : genre === "nature"
                              ? "#7f9e86"
                              : "#c49bb0",
                    }}
                  />
                  {GENRE_LABEL[genre]}
                </li>
              ))}
            </ul>

            {activeSpot ? (
              <div className="mishiranu-spot-panel">
                <p className="mishiranu-spot-genre">
                  {GENRE_LABEL[activeSpot.genre]} · 徒歩約{" "}
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
                駅・時間を変える
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
              出町柳など編集駅で感触確認中。公開環境に GEMINI_API_KEY があれば
              Gemini 3.1 Flash-Lite、なければ編集文です。
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
