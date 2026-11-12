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

type PlaceSpeakSection = "all" | "intro" | "history" | "sight" | "walk";

function placeScript(
  station: StationSeed,
  section: PlaceSpeakSection = "all",
): string {
  const join = (parts: string[]) =>
    parts.map((p) => p.trim()).filter(Boolean).join("\n\n");

  if (section === "intro") {
    return join([station.stationIntro ?? ""]);
  }
  if (section === "history") {
    const parts: string[] = [];
    if (station.areaAbout) {
      parts.push("このエリアのこと。", station.areaAbout);
    }
    for (const note of station.historyNotes ?? []) {
      parts.push(note.title, note.body);
    }
    return join(parts);
  }
  if (section === "sight") {
    const parts: string[] = [];
    if ((station.sightseeingNotes ?? []).length > 0) {
      parts.push("観光案内メモ。");
      for (const note of station.sightseeingNotes ?? []) {
        parts.push(note.title, note.body);
      }
    }
    return join(parts);
  }
  if (section === "walk") {
    return station.walkGuide
      ? join(["歩き方の目安。", station.walkGuide])
      : "";
  }
  return join([
    `${station.name}の、土地案内です。`,
    placeScript(station, "intro"),
    placeScript(station, "history"),
    placeScript(station, "sight"),
    placeScript(station, "walk"),
  ]);
}

type Props = {
  station: StationSeed;
  tourTitle: string;
};

export function PlaceBoard({ station, tourTitle }: Props) {
  const [speakingSection, setSpeakingSection] =
    useState<PlaceSpeakSection | null>(null);
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
  void tourTitle;

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
    setSpeakingSection(null);
  }, [station.id]);

  function toggleSpeak(section: PlaceSpeakSection) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingSection === section) {
      window.speechSynthesis.cancel();
      setSpeakingSection(null);
      return;
    }
    window.speechSynthesis.cancel();
    const text = placeScript(station, section);
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = 0.95;
    utter.onend = () => setSpeakingSection(null);
    utter.onerror = () => setSpeakingSection(null);
    setSpeakingSection(section);
    window.speechSynthesis.speak(utter);
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function sectionListenButton(section: PlaceSpeakSection, label: string) {
    const on = speakingSection === section;
    return (
      <button
        type="button"
        className={`mishiranu-place-section-listen${on ? " mishiranu-place-section-listen--on" : ""}`}
        onClick={() => toggleSpeak(section)}
        aria-pressed={on}
        aria-label={on ? `${label}の読み上げを止める` : `${label}を聞く`}
      >
        {on ? "止める" : "聞く"}
      </button>
    );
  }

  return (
    <div className="mishiranu-place-board">
      <div className="mishiranu-place-board-body">
        <button
          type="button"
          className={`mishiranu-place-listen${speakingSection === "all" ? " mishiranu-place-listen--on" : ""}`}
          onClick={() => toggleSpeak("all")}
          aria-pressed={speakingSection === "all"}
        >
          <span className="mishiranu-place-listen-copy">
            <strong>
              {speakingSection === "all"
                ? "読み上げを止める"
                : "土地案内を聞く"}
            </strong>
            <small>
              {speakingSection === "all"
                ? "もう一度押すと止まります"
                : "項目ごとにも聞けます · 駅に着く前に、イヤホンで"}
            </small>
          </span>
        </button>

        <div className="mishiranu-place-index" role="navigation" aria-label="この案内の目次">
          {(
            [
              ["place-intro", "01", indexStationLabel, hasIntro, "intro"],
              ["place-history", "02", "このエリア", hasHistory, "history"],
              ["place-sight", "03", "観光案内", hasSight, "sight"],
              ["place-walk", "04", "歩き方", hasWalk, "walk"],
            ] as const
          ).map(([id, num, label, on, section]) => (
            <div
              key={id}
              className={`mishiranu-place-index-item-wrap${speakingSection === section ? " mishiranu-place-index-item-wrap--on" : ""}`}
            >
              <button
                type="button"
                className="mishiranu-place-index-item"
                disabled={!on}
                onClick={() => on && scrollTo(id)}
              >
                <b>{num}</b>
                {label}
              </button>
              <button
                type="button"
                className="mishiranu-place-index-listen"
                disabled={!on}
                onClick={() => on && toggleSpeak(section)}
                aria-label={
                  speakingSection === section
                    ? `${label}の読み上げを止める`
                    : `${label}を聞く`
                }
              >
                {speakingSection === section ? "止" : "聴"}
              </button>
            </div>
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
              {sectionListenButton("intro", aboutTitle)}
            </div>
            {intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ) : null}

        {hasHistory ? (
          <section id="place-history" className="mishiranu-place-panel">
            <div className="mishiranu-place-panel-head">
              <span>02</span>
              <IconHistory />
              <h3>このエリアのこと</h3>
              {sectionListenButton("history", "このエリアのこと")}
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
              <span>03</span>
              <IconBinoculars />
              <h3>観光案内メモ</h3>
              {sectionListenButton("sight", "観光案内メモ")}
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

        {hasWalk ? (
          <section
            id="place-walk"
            className="mishiranu-place-panel mishiranu-place-panel--moss"
          >
            <div className="mishiranu-place-panel-head">
              <span>04</span>
              <IconWalk />
              <h3>歩き方の目安</h3>
              {sectionListenButton("walk", "歩き方の目安")}
            </div>
            {walk.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ) : null}

        {!hasIntro && !hasWalk && !hasHistory && !hasSight ? (
          <p className="mishiranu-note">この駅の土地メモはまだ少なめです。</p>
        ) : null}
      </div>
    </div>
  );
}
