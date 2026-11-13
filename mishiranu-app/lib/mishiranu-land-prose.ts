import type { AreaHistoryNote, StationSeed } from "@/data/mishiranu-stations";

/**
 * 土地ページの仕訳（かぶらせない）
 *
 * 01 stationIntro … 駅のこと＝路線・乗り換え・駅前の空気＋いつ・なぜこの駅ができたか
 * 02 historyNotes… 1トピック1件。土地の層（地名・川・町場・大学など）。駅の開業は intro へ
 * 03 areaAbout   … メモが無いときだけの短い概観（メモがあるときは出さない）
 * 04 walkGuide   … 歩き方＝一本の輪（出口→通る順→駅へ戻る。方角・定番食べ方）
 * 05 sightseeing … 寄るところ＝点の一覧（title=正式名、body=行き方＋着いたら。history 再掲禁止）
 */

/** areaAbout / historyNotes の役割（生成・正本の共通ルール）。 */
export const AREA_PRESENT_HISTORY_WEAVE = [
  "【このエリアのこと · 重複を避ける】",
  "- historyNotes があるとき areaAbout は書かないか、1〜2文の橋渡しだけ（メモの要約を繰り返さない）。",
  "- historyNotes: 1件につき2〜4文。『なぜそうなったか』と『いま歩くとどう残っているか』を同じ本文で結ぶ。同じ川・同じ街・同じ大学を別件で二重に語らない。",
  "- sightseeingNotes: 初めての人向け。各件は『正式名です。改札からの方角・徒歩何分。着いたら何があるか』の順。詩的な抽象（空気・気配・色が先に来る等）は禁止。由来は historyNotes へ。",
  "- walkGuide: 出口→実際の通過順→方角。定番の食べ方（買ってどこで）が分かれば1文。『リズムが崩れにくい』だけの抽象は禁止。",
  "- stationIntro（〇〇駅のこと）: 改札・乗り換え・駅前の空気に加え、いつ・なぜこの駅ができたか（開業年＋設置理由）を必ず。大学・神社・川の詳説は historyNotes へ。年が不確かなら捏造せず『大正期の延伸で』型。",
  "- 検索生成も出町柳正本と同じ精度バー（通過順・距離の嘘禁止・寄るところ具体・定番食べ方）。",
  "- 【無駄な寄り道】最短ナビにしない。境内・川辺・商店街の一本など、少し遠回りでも土地の顔を通る道を選ぶ。それが魅力。",
].join("\n");

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

function titleKey(title: string): string {
  return norm(title).replace(
    /と|の|を|が|は|へ|に|や|及び|そして|という|について/g,
    "",
  );
}

function titlesOverlap(a: string, b: string): boolean {
  const ka = titleKey(a);
  const kb = titleKey(b);
  if (ka.length < 3 || kb.length < 3) return false;
  if (ka === kb) return true;
  return ka.includes(kb) || kb.includes(ka);
}

function isNearDuplicate(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na.length < 10 || nb.length < 10) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 14 && longer.includes(shorter)) return true;
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
  const story = (station.storyNotes ?? []).map((n) => ({
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
    storyNotes: story,
  };
}

/**
 * セクション横断で同じ説明が繰り返されないよう、先勝ちで文を残す。
 * 順番: 駅のこと → 歴史メモ（正本）→ エリア概観（短く）→ 歩き方 → 観光メモ
 */
export function refineLandProse(station: StationSeed): StationSeed {
  station = fixRiverFields(station);
  let claimed: string[] = [];

  const intro = takeUnique(sentencesOf(station.stationIntro ?? ""), claimed);
  claimed = intro.claimed;

  const notes: AreaHistoryNote[] = [];
  const titles = new Set<string>();
  for (const note of station.historyNotes ?? []) {
    const title = note.title.trim();
    if (!title || titles.has(title)) continue;
    if ([...titles].some((t) => titlesOverlap(t, title))) continue;
    const got = takeUnique(sentencesOf(note.body), claimed);
    claimed = got.claimed;
    if (!got.keep.length) continue;
    titles.add(title);
    notes.push({ title, body: joinSentences(got.keep) });
  }

  // 歴史メモがあるときは概観を畳む（同じ川・街・大学の再説を止める）
  let areaAbout: string | undefined = station.areaAbout;
  if (notes.length >= 2) {
    areaAbout = undefined;
  } else {
    const aboutParas = (station.areaAbout ?? "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const aboutOut: string[] = [];
    for (const para of aboutParas.length
      ? aboutParas
      : [station.areaAbout ?? ""]) {
      const got = takeUnique(sentencesOf(para), claimed);
      claimed = got.claimed;
      if (got.keep.length) aboutOut.push(joinSentences(got.keep.slice(0, 3)));
    }
    areaAbout = aboutOut.length ? aboutOut.join("\n\n") : undefined;
  }

  const walkLines = sentencesOf(station.walkGuide ?? "").filter((s) => {
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

  const sight: AreaHistoryNote[] = [];
  const sightTitles = new Set<string>();
  for (const note of station.sightseeingNotes ?? []) {
    const title = note.title.trim();
    if (!title || sightTitles.has(title)) continue;
    // 歴史メモと同題の再掲は落とす
    if ([...titles].some((t) => titlesOverlap(t, title))) continue;
    const got = takeUnique(
      sentencesOf(note.body).filter((s) => {
        if (
          (s.includes("鯖街道") ||
            s.includes("世界遺産") ||
            s.includes("由来") ||
            s.includes("着き口")) &&
          s.length > 36
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
    areaAbout,
    historyNotes: notes.length ? notes : station.historyNotes,
    sightseeingNotes: sight.length ? sight : undefined,
  };
}

/** AI プロンプト用の仕訳ルール一文。 */
export const LAND_PROSE_ROLE_RULES = [
  "土地文の役割を分け、同じ説明を繰り返さない:",
  "- stationIntro: 路線・乗り換え・駅前の空気＋駅の開業年・設置理由。名所や大学の詳しい由来は書かない。",
  "- historyNotes: 1見出し1トピック。土地の層の詳説はここだけ。同じ主題を areaAbout / sightseeing で繰り返さない。駅の開業そのものは stationIntro へ（ここでは地名・川・町場など）。",
  "- areaAbout: historyNotes が2件以上あるときは省略か1〜2文。概観の重複禁止。",
  "- walkGuide: 寄る順番と方角だけ。歴史や『なぜ有名か』は書かない。",
  "- sightseeingNotes: 正式名＋方角・分＋着いたら何があるか。抽象表現禁止。historyNotes と同題の再掲は禁止。",
  "- 出町柳・鴨川デルタの川名（必須・逆転禁止）: 上流は賀茂川と高野川。合流点から南は鴨川。『合流し賀茂川へ名を変える』は誤り。",
  AREA_PRESENT_HISTORY_WEAVE,
].join("\n");
