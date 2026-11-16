import type { StationSeed } from "@/data/mishiranu-stations";

/**
 * 土地文正本を書き換えず、「いま」だけ重ねる日付つきパッチ。
 * 店の開閉は書かない。高架化・改称・出口・工事など駅／街区のいまだけ。
 *
 * 追記: 下の LAND_NOW_NOTES に駅 id で足す（BY_NAME も可）。
 */

export type LandNowNote = {
  /** YYYY-MM-DD */
  date: string;
  /** 1〜3文。句点で終わる。 */
  body: string;
};

/** 駅 id → いまメモ（新しい日付を下に足す） */
export const LAND_NOW_NOTES: Record<string, LandNowNote[]> = {
  "awaji-hankyu": [
    {
      date: "2026-11-15",
      body: "連続立体交差の躯体が頭上に立ち上がり、平面交差と高架工事が同居している。",
    },
  ],
};

/** 表示名 → 駅 id（AREA_DEPTH_BY_NAME と同型の別名） */
export const LAND_NOW_NOTES_BY_NAME: Record<string, string> = {
  阪急淡路: "awaji-hankyu",
  "淡路（阪急）": "awaji-hankyu",
};

const NOW_BLOCK_RE = /\n\nいま · [\s\S]*$/u;

export function lookupLandNowNotes(
  station: Pick<StationSeed, "id" | "name">,
): LandNowNote[] {
  const byId = LAND_NOW_NOTES[station.id];
  if (byId?.length) return byId;
  const bare = station.name.replace(/駅$/u, "").trim();
  const mapped =
    LAND_NOW_NOTES_BY_NAME[bare] ?? LAND_NOW_NOTES_BY_NAME[station.name];
  if (!mapped) return [];
  return LAND_NOW_NOTES[mapped] ?? [];
}

export function formatLandNowBlock(notes: LandNowNote[]): string {
  return notes
    .map((n) => {
      const body = n.body.trim().replace(/[。．]?$/u, "。");
      return `いま · ${n.date} — ${body}`;
    })
    .join("\n");
}

/** 正本 intro の末尾にいまメモを重ねる（二重適用しない）。 */
export function applyLandNowNotes(station: StationSeed): StationSeed {
  const notes = lookupLandNowNotes(station);
  if (!notes.length) {
    return station.nowNotes?.length
      ? { ...station, nowNotes: undefined }
      : station;
  }
  const block = formatLandNowBlock(notes);
  const introBase = (station.stationIntro ?? "")
    .replace(NOW_BLOCK_RE, "")
    .trim();
  return {
    ...station,
    nowNotes: notes,
    stationIntro: introBase ? `${introBase}\n\n${block}` : block,
  };
}
