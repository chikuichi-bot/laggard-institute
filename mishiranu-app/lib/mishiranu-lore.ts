import type { Spot, StationSeed } from "@/data/mishiranu-stations";
import { isForeignDemachiPlace } from "@/lib/mishiranu-demachi-template";
import { isNeighborhoodWorship } from "@/lib/mishiranu-first-visit-faces";

/** 駅の歴史文から、降りた瞬間・歩く途中に渡す「一片」を拾う（iOS StationLore と同じ）。 */

export function loreSentences(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  let current = "";
  for (const ch of text) {
    if (ch === "\n") {
      const s = current.trim();
      if (s.length >= 8) out.push(s);
      current = "";
      continue;
    }
    current += ch;
    if ("。！？".includes(ch)) {
      const s = current.trim();
      if (s.length >= 8) out.push(s);
      current = "";
    }
  }
  const rest = current.trim();
  if (rest.length >= 8) out.push(rest);
  return out;
}

type Temperature = "water" | "tide" | "shrine" | "food" | "castle" | "town";

function bareName(name: string): string {
  return name.endsWith("駅") ? name.slice(0, -1) : name;
}

function temperatureKind(station: StationSeed): Temperature {
  const blob = [
    station.name,
    station.catchCopy,
    station.areaAbout ?? "",
    station.stationIntro ?? "",
    ...station.spots.slice(0, 6).map((s) => s.name),
  ].join("");
  if (/デルタ|川|河|橋/.test(blob)) return "water";
  if (/港|海|潮|浜/.test(blob)) return "tide";
  if (/城/.test(blob)) return "castle";
  if (/神社|神宮|大社|寺/.test(blob)) return "shrine";
  if (/市場|食堂|パン/.test(blob)) return "food";
  return "town";
}

function temperatureTitle(kind: Temperature): string {
  switch (kind) {
    case "water":
      return "川の端";
    case "tide":
      return "潮の手前";
    case "shrine":
      return "社の前";
    case "food":
      return "食べもののほう";
    case "castle":
      return "城の影";
    default:
      return "町の入口";
  }
}

function temperatureClause(kind: Temperature): string {
  switch (kind) {
    case "water":
      return "川の音から入る";
    case "tide":
      return "潮のにおいから入る";
    case "shrine":
      return "社の静けさから入る";
    case "food":
      return "食べものから入る";
    case "castle":
      return "城の影から入る";
    default:
      return "町の通りから入る";
  }
}

/** 到着の最初の一文。型は同じでも、駅の言葉の温度で選ぶ。 */
export function arrivalFragment(
  station: StationSeed,
  date = new Date(),
): { title: string; line: string } | null {
  const bare = bareName(station.name);
  const face = station.spots.find(
    (s) =>
      (s.majorWorthy || s.guide === "sight") &&
      !s.id.startsWith("reach-") &&
      !/長徳寺|法性寺|西園寺/.test(s.name),
  )?.name;
  const day = Math.floor(date.getTime() / 86_400_000);
  let seed = day;
  for (const ch of station.id) seed += ch.codePointAt(0) ?? 0;
  const own = warmestSentence(station, face, bare, seed);
  const kind = temperatureKind(station);
  if (own) return { title: temperatureTitle(kind), line: own };
  const copy = station.catchCopy.trim();
  const clause = temperatureClause(kind);
  if (copy.length >= 8 && !copy.includes("予定のない寄り道")) {
    return { title: temperatureTitle(kind), line: `${bare}は、${clause}。${copy}` };
  }
  if (face) {
    return {
      title: temperatureTitle(kind),
      line: `${bare}は、${clause}。最初に向かうのは${face}。`,
    };
  }
  return { title: temperatureTitle(kind), line: `${bare}は、${clause}。` };
}

function warmestSentence(
  station: StationSeed,
  face: string | undefined,
  bare: string,
  seed: number,
): string | null {
  const pool = [
    ...loreSentences(station.catchCopy),
    ...(station.historyNotes ?? []).flatMap((n) => loreSentences(n.body)),
    ...loreSentences(station.areaAbout),
    ...loreSentences(station.stationIntro),
    ...(station.sightseeingNotes ?? []).flatMap((n) => loreSentences(n.body)),
  ];
  const scored = pool
    .map((line) => {
      let score = 0;
      if (face && line.includes(face)) score += 18;
      const key = face?.slice(0, 4) ?? "";
      if (key.length >= 2 && line.includes(key)) score += 10;
      if (line.includes(bare)) score += 8;
      if (/音|匂い|におい|光|風|川|湯|森|潮|石|雨|影|静/.test(line)) score += 16;
      if (/要確認|徒歩|あります|ご確認|案内します|おすすめ/.test(line)) score -= 24;
      return { line, score };
    })
    .filter((row) => row.score >= 12 && row.line.length >= 12 && row.line.length <= 80);
  if (!scored.length) return null;
  const best = Math.max(...scored.map((row) => row.score));
  const ties = scored.filter((row) => row.score === best).map((row) => row.line);
  return ties[seed % ties.length] ?? null;
}

const PLACE_SUFFIXES = [
  "商店街",
  "商店会",
  "三角州",
  "八幡宮",
  "美術館",
  "博物館",
  "朝市",
  "市場",
  "参道",
  "並木",
  "公園",
  "デルタ",
  "河原",
  "堤防",
  "桟橋",
  "灯台",
  "城跡",
  "茶屋",
  "本舗",
  "神宮",
  "神社",
  "大社",
  "大学",
  "の森",
  "橋",
  "寺",
  "院",
  "城",
  "港",
] as const;

const ARCADE_STEMS = ["枡形", "桝形"] as const;

function normalizeKey(name: string): string {
  return name.replace(/\s+/g, "").replace(/與/g, "与").replace(/予杼/g, "与杼");
}

/** 「出町枡形商店街」→ 枡形 / 枡形商店街 も土地文照合用に。 */
function nameKeys(name: string): string[] {
  const trimmed = name.trim();
  const keys = [trimmed];
  for (const part of trimmed.split(/[（）()「」\s　・/]/u)) {
    const p = part.trim();
    if (p.length >= 3) keys.push(p);
  }
  for (const suffix of ["本店", "駅前店", "店"]) {
    if (trimmed.endsWith(suffix)) {
      const core = trimmed.slice(0, -suffix.length);
      if (core.length >= 3) keys.push(core);
    }
  }
  for (const suffix of PLACE_SUFFIXES) {
    const idx = trimmed.indexOf(suffix);
    if (idx < 0) continue;
    const before = trimmed.slice(0, idx);
    if (before.length >= 2) {
      keys.push(before);
      keys.push(before + suffix);
    }
    if (before.length >= 4) keys.push(before.slice(-2));
  }
  for (const prefix of ["出町", "下鴨", "河原町", "三条", "四条", "今出川"]) {
    if (trimmed.startsWith(prefix)) {
      const rest = trimmed.slice(prefix.length);
      if (rest.length >= 2) keys.push(rest);
    }
  }
  if (trimmed.includes("枡形")) keys.push("枡形", "桝形");
  if (trimmed.includes("桝形")) keys.push("枡形", "桝形");
  if (trimmed.includes("ふたば")) keys.push("ふたば");
  if (trimmed.includes("みたらし")) keys.push("みたらし");
  return [...new Set(keys.filter((k) => k.length >= 2))];
}

function polishPlaceName(before: string, suffix: string): string {
  const m = before.match(/[一-龥ァ-ヶーA-Za-z0-9]{1,8}$/u);
  if (m) return `${m[0]}${suffix}`;
  return `${before}${suffix}`;
}

function isPlausiblePlace(phrase: string): boolean {
  if (phrase.length < 3 || phrase.length > 16) return false;
  if (isPlaceNoise(phrase)) return false;
  const junk = [
    "を",
    "が",
    "は",
    "に",
    "へ",
    "で",
    "と",
    "も",
    "や",
    "から",
    "まで",
    "たら",
    "れば",
    "など",
    "あれば",
    "まず",
  ];
  return !junk.some((j) => phrase.includes(j));
}

/** 土地文から場所名を登場順に抜く（歩くコースの骨）。 */
export function extractLandMentions(
  corpus: string,
): Array<{ offset: number; phrase: string }> {
  const found: Array<{ offset: number; phrase: string }> = [];
  const seen = new Set<string>();
  const suffixAlt = PLACE_SUFFIXES.join("|");
  // 助詞を含む文節を飲み込まないよう、直前は漢字・カタカナ中心。
  const re = new RegExp(
    `([一-龥ァ-ヶーA-Za-z0-9]{1,12})(${suffixAlt})`,
    "gu",
  );
  for (const m of corpus.matchAll(re)) {
    if (m.index == null) continue;
    const before = m[1] ?? "";
    const suffix = m[2] ?? "";
    const phrase = polishPlaceName(before, suffix);
    const key = normalizeKey(phrase);
    if (!isPlausiblePlace(phrase) || seen.has(key)) continue;
    seen.add(key);
    const trim = before.length - (phrase.length - suffix.length);
    found.push({ offset: m.index + Math.max(0, trim), phrase });
  }
  const softRe = /([ぁ-んァ-ヶ一-龥]{2,8})(茶屋|本舗|屋)/gu;
  for (const m of corpus.matchAll(softRe)) {
    if (m.index == null) continue;
    const phrase = m[0] ?? "";
    const key = normalizeKey(phrase);
    if (!isPlausiblePlace(phrase) || seen.has(key)) continue;
    seen.add(key);
    found.push({ offset: m.index, phrase });
  }
  for (const stem of ARCADE_STEMS) {
    const idx = corpus.indexOf(stem);
    if (idx < 0) continue;
    const phrase = `${stem}商店街`;
    const key = normalizeKey(phrase);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ offset: idx, phrase });
  }
  return found.sort((a, b) => a.offset - b.offset);
}

export function extractLandMentionPhrases(corpus: string): string[] {
  return extractLandMentions(corpus).map((m) => m.phrase);
}

function mentionsPhrase(spotName: string, phrase: string): boolean {
  if (spotName.includes(phrase) || phrase.includes(spotName)) return true;
  return nameKeys(spotName).some(
    (k) => phrase.includes(k) || k.includes(phrase),
  );
}

function sentenceContaining(needles: string[], corpus: string): string | null {
  const usable = needles.filter((n) => n.length >= 2);
  if (!usable.length) return null;
  for (const line of loreSentences(corpus)) {
    if (usable.some((n) => line.includes(n))) return line;
  }
  return null;
}

function withLandVoice(spot: Spot, corpus: string): Spot {
  const line =
    sentenceContaining(nameKeys(spot.name), corpus) ??
    sentenceContaining([spot.name], corpus);
  if (!line || spot.blurb === line) return spot;
  return { ...spot, blurb: line };
}

/** 土地ページの文章に出る町の顔をスポットとして確保する。 */
export function ensureLandMentions(station: StationSeed): StationSeed {
  const corpus = landWalkCorpus(station);
  if (!corpus.trim()) return station;
  const phrases = extractLandMentionPhrases(corpus);
  if (!phrases.length) return station;

  const knownDemachiPin = (
    phrase: string,
  ): { lat: number; lng: number; walkMinutes: number } | null => {
    if (!/出町柳/.test(station.name)) return null;
    if (/京都大学/.test(phrase) || phrase === "京大") {
      return { lat: 35.0272, lng: 135.7808, walkMinutes: 14 };
    }
    if (/同志社大学/.test(phrase) || phrase === "同志社") {
      return { lat: 35.029714, lng: 135.760715, walkMinutes: 15 };
    }
    if (/枡形|桝形/.test(phrase)) {
      return { lat: 35.030249, lng: 135.769436, walkMinutes: 3 };
    }
    if (/デルタ|三角州/.test(phrase)) {
      return { lat: 35.0301227, lng: 135.7717415, walkMinutes: 2 };
    }
    return null;
  };

  const spots = [...(station.spots ?? [])];
  for (const phrase of phrases) {
    if (isPlaceNoise(phrase)) continue;
    // 出町の固有名は雛形の見本。他駅の文章に混ざっていてもスポットにしない。
    if (isForeignDemachiPlace(phrase, station.name)) continue;
    const known = knownDemachiPin(phrase);
    const existing = spots.findIndex((s) => mentionsPhrase(s.name, phrase));
    if (existing >= 0) {
      // 既存でも正本ピンがあれば座標を上書き（デルタ寄せを残さない）
      if (known) {
        const cur = spots[existing]!;
        spots[existing] = {
          ...cur,
          lat: known.lat,
          lng: known.lng,
          walkMinutes: known.walkMinutes,
          coordTrust: "lock",
        };
      }
      continue;
    }
    const rest = /公園|河原|デルタ|三角州|の森/.test(phrase);
    const meal = /茶屋|本舗/.test(phrase);
    const university = /大学|キャンパス/.test(phrase);
    const landLine = sentenceContaining([phrase], corpus);
    const walkMinutes =
      known?.walkMinutes ??
      (/商店街|市場/.test(phrase) ? 3 : university ? 14 : 8);
    // 大学など遠い顔は駅に仮ピンを打たない（近い順ソートを壊すため）
    const coords = known
      ? { lat: known.lat, lng: known.lng }
      : university
        ? {}
        : station.lat != null && station.lng != null
          ? { lat: station.lat + 0.00015, lng: station.lng - 0.0002 }
          : {};
    spots.push({
      id: `land-${phrase.replace(/\s+/g, "").slice(0, 28)}`,
      name: phrase,
      genre: rest ? "nature" : meal ? "gourmet" : university ? "history" : "odd",
      guide: rest ? "rest" : meal ? "meal" : "sight",
      mealTier: "casual",
      mealTimes: meal ? ["lunch"] : [],
      soloOk: true,
      budgetYen: meal ? "〜¥1,000" : "—",
      hours: "終日（屋外）",
      blurb: landLine ?? "土地の文章で触れられている、この駅の顔。",
      detail: "土地の文章で触れられている、この駅の顔。",
      walkMinutes,
      x: 0.42,
      y: 0.38,
      majorWorthy: !university,
      secretWorthy: false,
      coordTrust: known ? "lock" : "unverified",
      ...coords,
    });
  }
  return { ...station, spots };
}

/** 土地ページ本文を一塊にした検索用テキスト。 */
export function landCorpus(station: StationSeed): string {
  return [
    station.stationIntro,
    station.areaAbout,
    station.walkGuide,
    station.catchCopy,
    ...(station.historyNotes ?? []).flatMap((n) => [n.title, n.body]),
    ...(station.sightseeingNotes ?? []).flatMap((n) => [n.title, n.body]),
    ...(station.storyNotes ?? []).flatMap((n) => [n.title, n.body]),
  ]
    .filter(Boolean)
    .join("\n");
}

/** 歩くコース用。回り方の文を先に置き、土地文の流れ＝歩く順にする。 */
export function landWalkCorpus(station: StationSeed): string {
  return [
    station.walkGuide,
    station.stationIntro,
    station.areaAbout,
    station.catchCopy,
    ...(station.sightseeingNotes ?? []).flatMap((n) => [n.title, n.body]),
    ...(station.storyNotes ?? []).flatMap((n) => [n.title, n.body]),
    ...(station.historyNotes ?? []).flatMap((n) => [n.title, n.body]),
  ]
    .filter(Boolean)
    .join("\n");
}

/** タイムズ・リパークなど、初めての案内に載せない場所。 */
export function isPlaceNoise(name: string): boolean {
  const tokens = [
    "製作所",
    "工場",
    "駐車場",
    "パーキング",
    "駐輪場",
    "コインパーキング",
    "タイムズ",
    "リパーク",
    "三井のリパーク",
    "パーク24",
    "月極",
    "時間貸",
    "立体駐車",
    "コンビニ",
    "薬局",
    "銀行",
    "郵便局",
  ];
  if (tokens.some((t) => name.includes(t))) return true;
  const upper = name.toUpperCase();
  return (
    upper.includes("TIMES") ||
    upper.includes("REPARK") ||
    upper.includes("PARKING") ||
    name.startsWith("NPC") ||
    name.includes("NPC ")
  );
}

/** 土地ページの文章から、登場順に歩く場所を組み立てる（正本）。 */
export function landNarrativeSpots(station: StationSeed): Spot[] {
  const seeded = ensureLandMentions(station);
  const corpus = landWalkCorpus(seeded);
  if (!corpus.trim()) return [];
  const spots = seeded.spots ?? [];
  const ranked: Array<{ offset: number; spot: Spot }> = [];
  const claimed = new Set<string>();

  for (const mention of extractLandMentions(corpus)) {
    if (isPlaceNoise(mention.phrase)) continue;
    const hit = spots.find(
      (s) =>
        mentionsPhrase(s.name, mention.phrase) &&
        !claimed.has(normalizeKey(s.name)),
    );
    if (hit) {
      claimed.add(normalizeKey(hit.name));
      ranked.push({ offset: mention.offset, spot: withLandVoice(hit, corpus) });
      continue;
    }
    const key = normalizeKey(mention.phrase);
    if (claimed.has(key)) continue;
    const seededHit = spots.find((s) => normalizeKey(s.name) === key);
    if (!seededHit) continue;
    claimed.add(key);
    ranked.push({
      offset: mention.offset,
      spot: withLandVoice(seededHit, corpus),
    });
  }

  for (const spot of spots) {
    if (spot.name.endsWith("駅")) continue;
    if (isPlaceNoise(spot.name)) continue;
    const key = normalizeKey(spot.name);
    if (!key || claimed.has(key)) continue;
    const offsets = nameKeys(spot.name)
      .filter((token) => token.length >= 2)
      .map((token) => corpus.indexOf(token))
      .filter((i) => i >= 0);
    if (offsets.length === 0) continue;
    claimed.add(key);
    ranked.push({
      offset: Math.min(...offsets),
      spot: withLandVoice(spot, corpus),
    });
  }

  return ranked.sort((a, b) => a.offset - b.offset).map((r) => r.spot);
}

/**
 * 案内タブ用。土地文に名前が無くても、実在スポットを厚く出す。
 * （歩くコース用の introducedVisitSpots より広い）
 */
export function guideCatalogSpots(station: StationSeed): Spot[] {
  const seeded = ensureLandMentions(station);
  const spots = seeded.spots ?? [];
  const picks: Spot[] = [];
  const seen = new Set<string>();
  for (const spot of spots) {
    if (spot.name.endsWith("駅")) continue;
    if (isPlaceNoise(spot.name)) continue;
    if (isNeighborhoodWorship(spot.name, seeded.name)) continue;
    const key = normalizeKey(spot.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picks.push(spot);
  }
  const slat = seeded.lat;
  const slng = seeded.lng;
  const dist = (s: Spot) => {
    if (slat == null || slng == null || s.lat == null || s.lng == null) {
      return s.walkMinutes;
    }
    const dlat = ((s.lat - slat) * Math.PI) / 180;
    const dlng = ((s.lng - slng) * Math.PI) / 180;
    const x =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((slat * Math.PI) / 180) *
        Math.cos((s.lat * Math.PI) / 180) *
        Math.sin(dlng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
  };
  return picks.sort((a, b) => dist(a) - dist(b) || a.walkMinutes - b.walkMinutes);
}

export function introducedVisitSpots(station: StationSeed): Spot[] {
  const seeded = ensureLandMentions(station);
  const corpus = landWalkCorpus(seeded);
  const spots = seeded.spots ?? [];
  const picks: Spot[] = [];
  const seen = new Set<string>();
  for (const spot of spots) {
    if (spot.name.endsWith("駅")) continue;
    if (isPlaceNoise(spot.name)) continue;
    const key = normalizeKey(spot.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const namedInLand = nameKeys(spot.name).some(
      (k) => k.length >= 2 && corpus.includes(k),
    );
    // 案内・地図の顔: 名所印・土地文に加え、ご飯／土産／休むも落とさない
    const guideKind = spot.guide;
    const isUsefulGuide =
      guideKind === "meal" ||
      guideKind === "souvenir" ||
      guideKind === "rest" ||
      guideKind === "tip" ||
      guideKind === "story";
    if (spot.majorWorthy || namedInLand || isUsefulGuide) {
      picks.push(spot);
    }
  }
  if (picks.length === 0) {
    return spots.filter(
      (s) => s.majorWorthy && !s.name.endsWith("駅") && !isPlaceNoise(s.name),
    );
  }
  // 案内・地図の一覧は駅から近い順（名所印より距離を優先）
  const slat = seeded.lat;
  const slng = seeded.lng;
  const dist = (s: Spot) => {
    if (
      slat == null ||
      slng == null ||
      s.lat == null ||
      s.lng == null
    ) {
      return s.walkMinutes;
    }
    const dlat = ((s.lat - slat) * Math.PI) / 180;
    const dlng = ((s.lng - slng) * Math.PI) / 180;
    const x =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((slat * Math.PI) / 180) *
        Math.cos((s.lat * Math.PI) / 180) *
        Math.sin(dlng / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    if (km < 0.02 && s.walkMinutes > 0) return s.walkMinutes * 0.08;
    return km;
  };
  return picks.sort((a, b) => {
    const da = dist(a);
    const db = dist(b);
    if (Math.abs(da - db) > 0.03) return da - db;
    if (a.walkMinutes !== b.walkMinutes) return a.walkMinutes - b.walkMinutes;
    if (a.majorWorthy !== b.majorWorthy) return a.majorWorthy ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
}

/** その場所の名前が出てくる、土地の記憶の一文。なければ null（無理に埋めない）。 */
export function spotTrace(spot: Spot, station: StationSeed): string | null {
  const pool = [
    ...loreSentences(station.walkGuide),
    ...loreSentences(station.stationIntro),
    ...loreSentences(station.areaAbout),
    ...(station.sightseeingNotes ?? []).flatMap((n) => loreSentences(n.body)),
    ...(station.storyNotes ?? []).flatMap((n) => loreSentences(n.body)),
    ...(station.historyNotes ?? []).flatMap((n) => loreSentences(n.body)),
  ];
  for (const key of nameKeys(spot.name)) {
    const hit = pool.find((s) => s.includes(key) && !spot.blurb.includes(s));
    if (hit) return hit;
  }
  return null;
}
