"use client";

import { useMemo, useState } from "react";
import {
  GENRE_LABEL,
  STATIONS,
  TIME_OPTIONS,
  pickSecret,
  spotsForTime,
  type Spot,
  type SpotGenre,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";
import "./mishiranu.css";

type Step = "hero" | "pick" | "tour";

const GENRE_ORDER: SpotGenre[] = ["history", "gourmet", "nature", "odd"];

export default function MishiranuApp() {
  const [step, setStep] = useState<Step>("hero");
  const [stationId, setStationId] = useState<string>(STATIONS[0].id);
  const [timeId, setTimeId] = useState<TimeOptionId>("1h");
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [secret, setSecret] = useState<Spot | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);

  const station = useMemo(
    () => STATIONS.find((s) => s.id === stationId) ?? STATIONS[0],
    [stationId],
  );

  const time = TIME_OPTIONS.find((t) => t.id === timeId) ?? TIME_OPTIONS[0];
  const spots = useMemo(
    () => spotsForTime(station, time.index),
    [station, time.index],
  );
  const activeSpot = spots.find((s) => s.id === activeSpotId) ?? spots[0];
  const ringSize = `${28 + time.index * 18}%`;

  function beginTour(nextStation?: StationSeed) {
    const chosen = nextStation ?? station;
    setStationId(chosen.id);
    setActiveSpotId(null);
    setSecret(null);
    setSecretOpen(false);
    setStep("tour");
  }

  function drawSecret() {
    const next = pickSecret(spots);
    setSecret(next ?? null);
    setSecretOpen(true);
    if (next) setActiveSpotId(next.id);
  }

  return (
    <div className="mishiranu">
      <div className="mishiranu-shell">
        {step === "hero" ? (
          <section className="mishiranu-hero" aria-label="見知らぬ駅">
            <p className="mishiranu-kicker">LAGADO LAB</p>
            <h1 className="mishiranu-brand">見知らぬ駅</h1>
            <p className="mishiranu-lead">
              降りた駅の、徒歩圏だけを、物語にする。予定のない寄り道を、いまここから。
            </p>
            <div className="mishiranu-cta-row">
              <button
                type="button"
                className="mishiranu-btn mishiranu-btn--primary"
                onClick={() => setStep("pick")}
              >
                この駅で始める
              </button>
              <button
                type="button"
                className="mishiranu-btn"
                onClick={() => beginTour(STATIONS[0])}
              >
                小淵沢ですぐ見る
              </button>
            </div>
          </section>
        ) : null}

        {step === "pick" ? (
          <section className="mishiranu-section" aria-labelledby="pick-title">
            <p className="mishiranu-kicker">STEP 1</p>
            <h2 id="pick-title" className="mishiranu-h2">
              どこに降りましたか
            </h2>
            <p className="mishiranu-note">
              プロトタイプはサンプル駅のみ。本番では駅名入力と現在地取得がここに入ります。
            </p>
            <ul className="mishiranu-station-list">
              {STATIONS.map((s) => (
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
                  onClick={() => beginTour()}
                >
                  物語をつくる
                </button>
                <button
                  type="button"
                  className="mishiranu-btn mishiranu-btn--ghost"
                  onClick={() => setStep("hero")}
                >
                  戻る
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "tour" ? (
          <section className="mishiranu-section" aria-labelledby="tour-title">
            <p className="mishiranu-kicker">
              {station.prefecture} · {station.line} · {time.label}
            </p>
            <div className="mishiranu-tour">
              <h2 id="tour-title" className="mishiranu-tour-title">
                {station.tourTitle}
              </h2>
              <p className="mishiranu-tour-catch">{station.catchCopy}</p>
              <p className="mishiranu-radius">
                徒歩圏 約 {station.radiiKm[time.index]} km · ピン {spots.length}{" "}
                件
              </p>
            </div>

            {station.mood === "empty" && station.emptyCopy ? (
              <div className="mishiranu-empty">
                <h3>{station.emptyCopy.headline}</h3>
                <p>{station.emptyCopy.body}</p>
              </div>
            ) : null}

            <div
              className="mishiranu-map"
              role="img"
              aria-label={`${station.name}駅周辺の抽象マップ`}
            >
              <div
                className="mishiranu-map-ring"
                style={{ ["--ring-size" as string]: ringSize }}
              />
              <div className="mishiranu-map-station" title={`${station.name}駅`} />
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
                onClick={() => setStep("pick")}
              >
                駅・時間を変える
              </button>
            </div>

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
              Phase 0 プロトタイプ — 駅データは編集モック。地図は抽象表現です。企画の感触確認用。
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
