import type { AreaHistoryNote, StationSeed } from "@/data/mishiranu-stations";

/**
 * 土地ページの仕訳（かぶらせない）
 *
 * 01 stationIntro … 路線・乗り換え・駅前の空気（名所の「なぜ」は書かない）
 * 02 walkGuide   … 寄る順番と方角だけ（歴史・由来は書かない）
 * 03 areaAbout   … 地形といまの概観（個別の詳説は書かない）
 * 03 historyNotes… 1トピック1件。なぜ／いまの詳説はここだけ
 * 04 sightseeing … 寄る・食べる・休むの実用（歴史の再説はしない）
 */

function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (ch === "\n") {
      const s = cur.trim();
      if (s.length >= 8) out.push(s);
      cur = "";
      continue;
    }
    cur += ch;
    if ("。！？".includes(ch)) {
      const s = cur.trim();
      if (s.length >= 8) out.push(s);
      cur = "";
    }
  }
  const rest = cur.trim();
  if (rest.length >= 8) out.push(rest);
  return out;
}

function norm(s: string): string {
  return s.replace(/\s+/g, "").replace(/[。．、，・「」『』（）()]/g, "");
}

function isNearDuplicate(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na.length < 10 || nb.length < 10) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 14 && longer.includes(shorter)) return true;
  // 先頭が同じ長い文
  const n = Math.min(22, shorter.length);
  return n >= 16 && longer.startsWith(shorter.slice(0, n));
}

function joinSentences(lines: string[]): string {
  return lines
    .map((s) =>
      /[。！？]$/.test(s) ? s : `${s.replace(/[。．]?$/, "")}。`,
    )
    .join("");
}

function takeUnique(
  lines: string[],
  claimed: string[],
): { keep: string[]; claimed: string[] } {
  const keep: string[] = [];
  const next = [...claimed];
  for (const line of lines) {
    if (next.some((c) => isNearDuplicate(c, line))) continue;
    keep.push(line);
    next.push(line);
  }
  return { keep, claimed: next };
}

/**
 * 鴨川／賀茂川の読みは同じで、生成AIが合流後の名を逆転しやすい。
 * 正: 上流＝賀茂川＋高野川 → 合流後の南＝鴨川。
 */
export function correctKamoRiverNaming(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(
    /鴨川と高野川が合流し([、，]?)賀茂川へと名を変え/g,
    "賀茂川と高野川が合流し$1鴨川へと名を変え",
  );
  out = out.replace(
    /合流し([、，]?)賀茂川へと名を変え/g,
    "合流し$1鴨川へと名を変え",
  );
  out = out.replace(/合流して賀茂川へと名を変え/g, "合流して鴨川へと名を変え");
  out = out.replace(/名を変えて賀茂川/g, "名を変えて鴨川");
  out = out.replace(
    /鴨川と高野川が合流し([、，]?)鴨川へと名を変え/g,
    "賀茂川と高野川が合流し$1鴨川へと名を変え",
  );
  return out;
}

function fixRiverFields(station: StationSeed): StationSeed {
  const notes = (station.historyNotes ?? []).map((n) => ({
    ...n,
    title: correctKamoRiverNaming(n.title),
    body: correctKamoRiverNaming(n.body),
  }));
  const sight = (station.sightseeingNotes ?? []).map((n) => ({
    ...n,
    title: correctKamoRiverNaming(n.title),
    body: correctKamoRiverNaming(n.body),
  }));
  return {
    ...station,
    stationIntro: station.stationIntro
      ? correctKamoRiverNaming(station.stationIntro)
      : station.stationIntro,
    areaAbout: station.areaAbout
      ? correctKamoRiverNaming(station.areaAbout)
      : station.areaAbout,
    walkGuide: station.walkGuide
      ? correctKamoRiverNaming(station.walkGuide)
      : station.walkGuide,
    historyNotes: notes,
    sightseeingNotes: sight,
  };
}

/**
 * セクション横断で同じ説明が繰り返されないよう、先勝ちで文を残す。
 * 順番: 駅のこと → 歩き方 → エリア → 歴史メモ → 観光メモ
 */
export function refineLandProse(station: StationSeed): StationSeed {
  station = fixRiverFields(station);
  let claimed: string[] = [];

  const intro = takeUnique(sentencesOf(station.stationIntro ?? ""), claimed);
  claimed = intro.claimed;

  // 歩き方から、すでに駅紹介で言った文と歴史っぽい長文の重複を落とす
  const walkLines = sentencesOf(station.walkGuide ?? "").filter((s) => {
    // 歩き方に「由来・着き口の長文」を残さない（メモ側の仕事）
    if (
      (s.includes("鯖街道") || s.includes("着き口") || s.includes("由来")) &&
      s.length > 48
    ) {
      return false;
    }
    return true;
  });
  const walk = takeUnique(walkLines, claimed);
  claimed = walk.claimed;

  const aboutParas = (station.areaAbout ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const aboutOut: string[] = [];
  for (const para of aboutParas.length ? aboutParas : [station.areaAbout ?? ""]) {
    const got = takeUnique(sentencesOf(para), claimed);
    claimed = got.claimed;
    if (got.keep.length) aboutOut.push(joinSentences(got.keep));
  }

  const notes: AreaHistoryNote[] = [];
  const titles = new Set<string>();
  for (const note of station.historyNotes ?? []) {
    const title = note.title.trim();
    if (!title || titles.has(title)) continue;
    const got = takeUnique(sentencesOf(note.body), claimed);
    claimed = got.claimed;
    if (!got.keep.length) continue;
    titles.add(title);
    notes.push({ title, body: joinSentences(got.keep) });
  }

  const sight: AreaHistoryNote[] = [];
  const sightTitles = new Set<string>();
  for (const note of station.sightseeingNotes ?? []) {
    const title = note.title.trim();
    if (!title || sightTitles.has(title)) continue;
    // 歴史メモで既に詳しく書いた内容の再掲を落とす
    const got = takeUnique(
      sentencesOf(note.body).filter((s) => {
        if (
          (s.includes("鯖街道") || s.includes("世界遺産") || s.includes("由来")) &&
          s.length > 40
        ) {
          return false;
        }
        return true;
      }),
      claimed,
    );
    claimed = got.claimed;
    if (!got.keep.length) continue;
    sightTitles.add(title);
    sight.push({ title, body: joinSentences(got.keep) });
  }

  return {
    ...station,
    stationIntro: intro.keep.length
      ? joinSentences(intro.keep)
      : station.stationIntro,
    walkGuide: walk.keep.length ? joinSentences(walk.keep) : station.walkGuide,
    areaAbout: aboutOut.length
      ? aboutOut.join("\n\n")
      : station.areaAbout,
    historyNotes: notes.length ? notes : station.historyNotes,
    sightseeingNotes: sight.length ? sight : station.sightseeingNotes,
  };
}

/** AI プロンプト用の仕訳ルール一文。 */
export const LAND_PROSE_ROLE_RULES = [
  "土地文の役割を分け、同じ説明を繰り返さない:",
  "- stationIntro: 路線・乗り換え・駅前の空気だけ。名所や大学の詳しい由来は書かない。",
  "- walkGuide: 寄る順番と方角だけ（例: 枡形→デルタ→北へ下鴨）。歴史や『なぜ有名か』は書かない。",
  "- areaAbout: 地形といまの生活の概観。個別スポットの詳説は historyNotes へ。",
  "- historyNotes: 1見出し1トピック。由来・いまの詳説はここだけ。",
  "- sightseeingNotes: 先頭は土地の顔3点。続けて短い滞在・食べる休む・季節や注意など実用メモを足し、合計6〜7件。historyNotes の再掲は禁止。",
  "- 出町柳・鴨川デルタの川名（必須・逆転禁止）: 上流は賀茂川と高野川。合流点から南は鴨川。『合流し賀茂川へ名を変える』は誤り。",
].join("\n");
