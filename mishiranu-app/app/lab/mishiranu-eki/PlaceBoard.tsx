"use client";

import { useEffect, useMemo, useState } from "react";
import type { StationSeed } from "@/data/mishiranu-stations";
import {
  stationAboutTitle,
  stationBaseName,
  stationNameReading,
} from "@/data/mishiranu-station-readings";
import { IconBinoculars, IconHistory, IconWalk } from "./MishiranuIcons";

function readingLines(text?: string | null): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    current += ch;
    if ("。！？".includes(ch)) {
      const t = current.trim();
      if (t) lines.push(t);
      current = "";
    }
  }
  const rest = current.trim();
  if (rest) lines.push(rest);
  return lines;
}

function placeScript(station: StationSeed, tourTitle: string): string {
  const parts: string[] = [`${station.name}の、土地案内です。`];
  if (station.stationIntro) parts.push(station.stationIntro);
  if (station.walkGuide) {
    parts.push("歩き方の目安。");
    parts.push(station.walkGuide);
  }
  if (station.areaAbout) {
    parts.push("このエリアのこと（いまと歴史）。");
    parts.push(station.areaAbout);
  }
  for (const note of station.historyNotes ?? []) {
    parts.push(note.title);
    parts.push(note.body);
  }
  if ((station.sightseeingNotes ?? []).length > 0) {
    parts.push("観光案内メモ。");
    for (const note of station.sightseeingNotes ?? []) {
      parts.push(note.title);
      parts.push(note.body);
    }
  }
  if (parts.length === 1) parts.push("この駅の土地メモは、まだ少なめです。");
  return parts.filter(Boolean).join("\n\n");
}

type Props = {
  station: StationSeed;
  tourTitle: string;
};

export function PlaceBoard({ station, tourTitle }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const intro = useMemo(() => readingLines(station.stationIntro), [station.stationIntro]);
  const walk = useMemo(() => readingLines(station.walkGuide), [station.walkGuide]);
  const area = useMemo(() => readingLines(station.areaAbout), [station.areaAbout]);
  const aboutTitle = stationAboutTitle(station.name);
  const nameReading = stationNameReading(station);
  const indexStationLabel = stationBaseName(station.name);
  const history = station.historyNotes ?? [];
  const sight = station.sightseeingNotes ?? [];
  const hasIntro = intro.length > 0;
  const hasWalk = walk.length > 0;
  const hasHistory = area.length > 0 || history.length > 0;
  const hasSight = sight.length > 0;

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, [station.id]);

  function toggleSpeak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(
      placeScript(station, tourTitle),
    );
    utter.lang = "ja-JP";
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mishiranu-place-board">
      <div className="mishiranu-place-board-body">
        <button
          type="button"
          className={`mishiranu-place-listen${speaking ? " mishiranu-place-listen--on" : ""}`}
          onClick={toggleSpeak}
          aria-pressed={speaking}
        >
          <span className="mishiranu-place-listen-copy">
            <strong>{speaking ? "読み上げを止める" : "土地案内を聞く"}</strong>
            <small>
              {speaking ? "もう一度押すと止まります" : "駅に着く前に、イヤホンで"}
            </small>
          </span>
        </button>

        <div className="mishiranu-place-index" role="navigation" aria-label="この案内の目次">
          {(
            [
              ["place-intro", "01", indexStationLabel, hasIntro],
              ["place-walk", "02", "歩き方", hasWalk],
              ["place-history", "03", "いまと歴史", hasHistory],
              ["place-sight", "04", "観光", hasSight],
            ] as const
          ).map(([id, num, label, on]) => (
            <button
              key={id}
              type="button"
              className="mishiranu-place-index-item"
              disabled={!on}
              onClick={() => on && scrollTo(id)}
            >
              <b>{num}</b>
              {label}
            </button>
          ))}
        </div>

        {hasIntro ? (
          <section id="place-intro" className="mishiranu-place-panel">
            <div className="mishiranu-place-panel-head">
              <span>01</span>
              <div className="mishiranu-place-panel-titles">
                {nameReading ? (
                  <p className="mishiranu-place-panel-reading">{nameReading}</p>
                ) : null}
                <h3>{aboutTitle}</h3>
              </div>
            </div>
            {intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ) : null}

        {hasWalk ? (
          <section
            id="place-walk"
            className="mishiranu-place-panel mishiranu-place-panel--moss"
          >
            <div className="mishiranu-place-panel-head">
              <span>02</span>
              <IconWalk />
              <h3>歩き方の目安</h3>
            </div>
            {walk.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ) : null}

        {hasHistory ? (
          <section id="place-history" className="mishiranu-place-panel">
            <div className="mishiranu-place-panel-head">
              <span>03</span>
              <IconHistory />
              <h3>このエリアのこと（いまと歴史）</h3>
            </div>
            {area.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {history.length > 0 ? (
              <ol className="mishiranu-place-notes">
                {history.map((note, i) => (
                  <li key={note.title}>
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    <div>
                      <h4>{note.title}</h4>
                      <p>{note.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ) : null}

        {hasSight ? (
          <section id="place-sight" className="mishiranu-place-panel">
            <div className="mishiranu-place-panel-head">
              <span>04</span>
              <IconBinoculars />
              <h3>観光案内メモ</h3>
            </div>
            <ol className="mishiranu-place-notes">
              {sight.map((note, i) => (
                <li key={note.title}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <div>
                    <h4>{note.title}</h4>
                    <p>{note.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {!hasIntro && !hasWalk && !hasHistory && !hasSight ? (
          <p className="mishiranu-note">この駅の土地メモはまだ少なめです。</p>
        ) : null}
      </div>
    </div>
  );
}
