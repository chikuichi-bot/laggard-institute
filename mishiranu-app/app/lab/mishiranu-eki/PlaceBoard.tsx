"use client";

import { useMemo } from "react";
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

export type PlaceSpeakSection = "all" | "intro" | "history" | "sight" | "story" | "walk";

export function placeScript(
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
    const notes = station.historyNotes ?? [];
    // メモがあるときは概観を重ねない（同じ話題の再読を止める）
    if (notes.length === 0 && station.areaAbout) {
      parts.push("このエリアのこと。", station.areaAbout);
    } else if (notes.length > 0) {
      parts.push("このエリアのこと。");
    }
    for (const note of notes) {
      parts.push(note.title, note.body);
    }
    return join(parts);
  }
  if (section === "sight") {
    const parts: string[] = [];
    if ((station.sightseeingNotes ?? []).length > 0) {
      parts.push("寄るところ。");
      for (const note of station.sightseeingNotes ?? []) {
        parts.push(note.title, note.body);
      }
    }
    return join(parts);
  }
  if (section === "story") {
    const parts: string[] = [];
    if ((station.storyNotes ?? []).length > 0) {
      parts.push("物語のゆかり。");
      for (const note of station.storyNotes ?? []) {
        parts.push(note.title, note.body);
      }
    }
    return join(parts);
  }
  if (section === "walk") {
    return station.walkGuide
      ? join(["歩き方。", station.walkGuide])
      : "";
  }
  // intro → 歩き方 → 歴史／観光／物語
  return join([
    `${station.name}の、土地案内です。`,
    placeScript(station, "intro"),
    placeScript(station, "walk"),
    placeScript(station, "history"),
    placeScript(station, "sight"),
    placeScript(station, "story"),
  ]);
}

type Props = {
  station: StationSeed;
  tourTitle: string;
  speakingSection: PlaceSpeakSection | null;
  onToggleSpeak: (section: PlaceSpeakSection) => void;
};

export function PlaceBoard({
  station,
  tourTitle,
  speakingSection,
  onToggleSpeak,
}: Props) {
  const intro = useMemo(() => readingLines(station.stationIntro), [station.stationIntro]);
  const walk = useMemo(
    () => readingLines(station.walkGuide),
    [station.walkGuide],
  );
  const history = station.historyNotes ?? [];
  // 歴史メモがあるときは areaAbout を出さない（概観とメモの二重読みを止める）
  const area = useMemo(
    () =>
      history.length > 0 ? [] : readingLines(station.areaAbout),
    [station.areaAbout, history.length],
  );
  const aboutTitle = stationAboutTitle(station.name);
  const nameReading = stationNameReading(station);
  const indexStationLabel = stationBaseName(station.name);
  const sight = station.sightseeingNotes ?? [];
  const story = station.storyNotes ?? [];
  const hasIntro = intro.length > 0;
  const hasWalk = walk.length > 0;
  const hasHistory = area.length > 0 || history.length > 0;
  const hasSight = sight.length > 0;
  const hasStory = story.length > 0;
  void tourTitle;

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function sectionListenButton(section: PlaceSpeakSection, label: string) {
    const on = speakingSection === section;
    return (
      <button
        type="button"
        className={`mishiranu-place-section-listen${on ? " mishiranu-place-section-listen--on" : ""}`}
        onClick={() => onToggleSpeak(section)}
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
          onClick={() => onToggleSpeak("all")}
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
                ? "歩くタブへ移っても続きが聴けます"
                : "歴史と今を、耳でたどりながら歩けます"}
            </small>
          </span>
        </button>

        <div className="mishiranu-place-index" role="navigation" aria-label="この案内の目次">
          {(
            [
              hasIntro &&
                (["place-intro", indexStationLabel, "intro"] as const),
              hasHistory &&
                (["place-history", "このエリア", "history"] as const),
              hasSight &&
                (["place-sight", "寄るところ", "sight"] as const),
              hasStory &&
                (["place-story", "物語のゆかり", "story"] as const),
              hasWalk && (["place-walk", "歩き方", "walk"] as const),
            ].filter(Boolean) as Array<
              readonly [string, string, PlaceSpeakSection]
            >
          ).map(([id, label, section], index) => {
            const num = String(index + 1).padStart(2, "0");
            return (
            <div
              key={id}
              className={`mishiranu-place-index-item-wrap${speakingSection === section ? " mishiranu-place-index-item-wrap--on" : ""}`}
            >
              <button
                type="button"
                className="mishiranu-place-index-item"
                onClick={() => scrollTo(id)}
              >
                <b>{num}</b>
                {label}
              </button>
              <button
                type="button"
                className="mishiranu-place-index-listen"
                onClick={() => onToggleSpeak(section)}
                aria-label={
                  speakingSection === section
                    ? `${label}の読み上げを止める`
                    : `${label}を聞く`
                }
              >
                {speakingSection === section ? "止" : "聴"}
              </button>
            </div>
            );
          })}
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
                <p className="mishiranu-place-panel-hint">
                  いつ・なぜこの駅ができたかも、ここに
                </p>
              </div>
              {sectionListenButton("intro", aboutTitle)}
            </div>
            {intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {station.railHint ? (
              <p className="mishiranu-place-rail-hint">{station.railHint}</p>
            ) : null}
          </section>
        ) : null}

        {hasHistory ? (
          <section id="place-history" className="mishiranu-place-panel">
            <div className="mishiranu-place-panel-head">
              <span>02</span>
              <IconHistory />
              <div className="mishiranu-place-panel-titles">
                <h3>このエリアのこと</h3>
                <p className="mishiranu-place-panel-hint">
                  地名・川・町場など、土地の層
                </p>
              </div>
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
              <div className="mishiranu-place-panel-titles">
                <h3>寄るところ</h3>
                <p className="mishiranu-place-panel-hint">
                  正式名・行き方・着いたら何があるか（一つずつ）
                </p>
              </div>
              {sectionListenButton("sight", "寄るところ")}
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

        {hasStory ? (
          <section id="place-story" className="mishiranu-place-panel">
            <div className="mishiranu-place-panel-head">
              <span>04</span>
              <IconBinoculars />
              <h3>物語のゆかり</h3>
              {sectionListenButton("story", "物語のゆかり")}
            </div>
            <ol className="mishiranu-place-notes">
              {story.map((note, i) => (
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
              <span>{hasStory ? "05" : "04"}</span>
              <IconWalk />
              <div className="mishiranu-place-panel-titles">
                <h3>歩き方</h3>
                <p className="mishiranu-place-panel-hint">
                  一本の輪。出口から通る順、駅へ戻るまで
                </p>
              </div>
              {sectionListenButton("walk", "歩き方")}
            </div>
            {walk.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ) : null}

        {!hasIntro && !hasWalk && !hasHistory && !hasSight && !hasStory ? (
          <p className="mishiranu-note">この駅の土地メモはまだ少なめです。</p>
        ) : null}
      </div>
    </div>
  );
}
