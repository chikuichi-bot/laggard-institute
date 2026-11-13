import {
  GUIDE_ORDER,
  mealTierFor,
  soloOkFor,
  spotGuide,
  spotsForTime,
  type GuideKind,
  type MealTier,
  type MealTime,
  type Spot,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";
import {
  isGuidebookWorship,
  isNeighborhoodWorship,
  isOrdinaryPublicFace,
} from "@/lib/mishiranu-first-visit-faces";
import { haversineKm, stationLatLng } from "@/lib/mishiranu-geo";
import {
  FIRST_VISIT_MAX_KM,
  isDemachiStationName,
  isForeignDemachiPlace,
  isOnDemachiPin,
  stripExclusiveDemachiSentences,
} from "@/lib/mishiranu-demachi-template";
import { landAnchorsFor } from "@/lib/mishiranu-land-anchors";
import {
  ensureLandMentions,
  introducedVisitSpots,
  landNarrativeSpots,
} from "@/lib/mishiranu-lore";
import { allowsOnMap, sealMapCoordinates } from "@/lib/mishiranu-map-trust";

export type DayPart = "morning" | "midday" | "afternoon" | "evening" | "night";

/** ご飯屋の一人可否の希望 */
export type SoloPref = "solo" | "together" | "either";

/** ご飯の予算希望（mealTier に対応、either は指定なし） */
export type BudgetPref = MealTier | "either";

export type MealPrefs = {
  solo: SoloPref;
  budget: BudgetPref;
};

export const SOLO_PREF_OPTIONS: Array<{
  id: SoloPref;
  label: string;
  hint: string;
}> = [
  { id: "solo", label: "一人で入りたい", hint: "カウンターや気軽な店寄り" },
  { id: "either", label: "人数は気にしない", hint: "一人可否は問わない" },
  { id: "together", label: "みんなで寄りたい", hint: "席や予約向きも歓迎" },
];

export const BUDGET_PREF_OPTIONS: Array<{
  id: BudgetPref;
  label: string;
  hint: string;
}> = [
  { id: "casual", label: "気軽に", hint: "だいたい 〜¥1,500" },
  { id: "upscale", label: "少し奮発", hint: "だいたい ¥3,000〜" },
  { id: "either", label: "どちらでも", hint: "価格帯は問わない" },
];

export function matchSoloPref(text: string): SoloPref | undefined {
  const t = text.trim();
  if (/一人|ひとり|ソロ|おひとり/.test(t)) return "solo";
  if (/みんな|複数|二人|ふたり|グループ|連れ|同伴/.test(t)) return "together";
  if (/どちら|気にし|問わ|なんでも|おまかせ|関係な/.test(t)) return "either";
  return undefined;
}

export function matchBudgetPref(text: string): BudgetPref | undefined {
  const t = text.trim();
  if (/奮発|高級|高め|フォーマル|会席|贅沢|ぜいたく|3\s*000|3000|五千|万円/.test(t)) {
    return "upscale";
  }
  if (/気軽|安め|安い|庶民|ランチ|軽く|千円|1500|〜¥|~¥|カジュアル/.test(t)) {
    return "casual";
  }
  if (/どちら|なんでも|おまかせ|問わ|気にし/.test(t)) return "either";
  const hit = BUDGET_PREF_OPTIONS.find((o) => t.includes(o.label));
  return hit?.id;
}

export function mealPrefScore(spot: Spot, prefs?: MealPrefs | null): number {
  if (!prefs || spotGuide(spot) !== "meal") return 0;
  let score = 0;
  if (prefs.solo === "solo") {
    score += soloOkFor(spot) ? 14 : -18;
  } else if (prefs.solo === "together") {
    score += soloOkFor(spot) ? 2 : 8;
  }
  if (prefs.budget !== "either") {
    score += mealTierFor(spot) === prefs.budget ? 12 : -10;
  }
  return score;
}

export type CourseStop = {
  spotId: string;
  name: string;
  guide: GuideKind;
  blurb: string;
  walkMinutes: number;
  dwellMinutes: number;
  /** コース内の目安時刻（例: 14:20） */
  clockLabel?: string;
};

export type WalkCourse = {
  id: string;
  title: string;
  subtitle: string;
  vibe: string;
  totalMinutes: number;
  stopCount: number;
  stops: CourseStop[];
  /** 最後の立ち寄りから駅へ戻る徒歩分（終点＝駅） */
  returnWalkMinutes?: number;
  /** 駅に戻る目安時刻 */
  returnClockLabel?: string;
};

export const DAY_PART_OPTIONS: Array<{
  id: DayPart;
  label: string;
  hint: string;
}> = [
  { id: "morning", label: "朝", hint: "だいたい 6〜10時" },
  { id: "midday", label: "昼まえ", hint: "だいたい 10〜12時" },
  { id: "afternoon", label: "昼すぎ", hint: "だいたい 12〜16時" },
  { id: "evening", label: "夕方", hint: "だいたい 16〜19時" },
  { id: "night", label: "夜", hint: "だいたい 19時以降" },
];

const DAY_PART_MEAL: Record<DayPart, MealTime[]> = {
  morning: ["morning"],
  midday: ["morning", "lunch"],
  afternoon: ["lunch"],
  evening: ["lunch", "dinner"],
  night: ["dinner"],
};

/** コース組み立て用。朝でもランチ店を残さないと3コースが観光地だけになる */
const DAY_PART_MEAL_COURSE: Record<DayPart, MealTime[]> = {
  morning: ["morning", "lunch"],
  midday: ["morning", "lunch"],
  afternoon: ["lunch"],
  evening: ["lunch", "dinner"],
  night: ["dinner"],
};

const STAY_BUDGET: Record<TimeOptionId, number> = {
  "1h": 50,
  "3h": 165,
  half: 280,
};

const STAY_MAX_STOPS: Record<TimeOptionId, number> = {
  "1h": 2,
  "3h": 4,
  half: 6,
};

const STAY_LENGTH_HINT: Record<TimeOptionId, string> = {
  "1h": "さっと2か所",
  "3h": "4か所くらい",
  half: "じっくり最大6か所",
};

const STAY_DWELL_SCALE: Record<TimeOptionId, number> = {
  "1h": 0.55,
  "3h": 1,
  half: 1.2,
};

/** 難易度ではなく、まわり方の切り口 */
type CourseStyle = "walk" | "food" | "farther";

const COURSE_TEMPLATES: Array<{
  id: string;
  title: string;
  subtitle: string;
  vibe: string;
  prefer: GuideKind[];
  style: CourseStyle;
}> = [
  {
    id: "walk",
    title: "散歩中心",
    subtitle: "景色と休みを多めに",
    vibe: "急がず、土地の気配を拾う",
    prefer: ["sight", "rest", "tip"],
    style: "walk",
  },
  {
    id: "food",
    title: "食べ物中心",
    subtitle: "ご飯と土産を軸に",
    vibe: "空腹と手土産のあいだを歩く",
    prefer: ["meal", "souvenir", "rest"],
    style: "food",
  },
  {
    id: "farther",
    title: "少し先まで",
    subtitle: "徒歩圏の端まで伸ばす",
    vibe: "駅前を抜けて、ひとつ奥へ",
    prefer: ["tip", "sight", "meal"],
    style: "farther",
  },
];

export function dayPartLabel(part: DayPart): string {
  return DAY_PART_OPTIONS.find((o) => o.id === part)?.label ?? part;
}

export function matchDayPart(text: string): DayPart | undefined {
  const t = text.trim();
  if (/朝|あさ|午前早く|モーニング|朝食/.test(t)) return "morning";
  if (/昼まえ|午前|ランチ前|午前中/.test(t)) return "midday";
  if (/昼すぎ|午後|ひるすぎ|ランチ後/.test(t)) return "afternoon";
  if (/夕方|夕暮れ|ゆうがた|薄暮/.test(t)) return "evening";
  if (/夜|よる|夕食|ディナー|夜分/.test(t)) return "night";

  const hourMatch = t.match(/(\d{1,2})\s*時/);
  if (hourMatch) {
    const h = Number(hourMatch[1]);
    if (Number.isFinite(h)) return dayPartFromHour(h);
  }
  return undefined;
}

export function dayPartFromHour(hour: number): DayPart {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h < 10) return "morning";
  if (h < 12) return "midday";
  if (h < 16) return "afternoon";
  if (h < 19) return "evening";
  return "night";
}

export function defaultClockHour(part: DayPart): number {
  switch (part) {
    case "morning":
      return 8;
    case "midday":
      return 11;
    case "afternoon":
      return 14;
    case "evening":
      return 17;
    case "night":
      return 20;
  }
}

function formatClock(hour: number, minute: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const m = Math.max(0, Math.min(59, Math.round(minute)));
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 営業時間文字列から、その時刻に開いていそうか。不明は true。 */
export function isLikelyOpenAtHour(
  hours: string | undefined,
  hour: number,
): boolean | null {
  if (!hours) return null;
  const t = hours.normalize("NFKC");
  if (/終日|屋外|24時間/.test(t)) return true;
  const m = t.match(
    /(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～\-~－—]\s*(\d{1,2})\s*[:：]\s*(\d{2})/,
  );
  if (!m) return null;
  const openMin = Number(m[1]) * 60 + Number(m[2]);
  let closeMin = Number(m[3]) * 60 + Number(m[4]);
  if (closeMin <= openMin) closeMin += 24 * 60;
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  let now = h * 60 + 30;
  if (now < openMin) now += 24 * 60;
  return now >= openMin && now < closeMin;
}

export function isLikelyOpen(spot: Spot, dayPart: DayPart): boolean {
  const hour = defaultClockHour(dayPart);
  const parsed = isLikelyOpenAtHour(spot.hours, hour);
  if (parsed !== null) return parsed;
  if (spotGuide(spot) === "meal") {
    return mealFits(spot, dayPart);
  }
  // 時間が無い土産は落とさない（表示にも営業時間は書かない）
  return true;
}

function mealFits(spot: Spot, dayPart: DayPart): boolean {
  if (spotGuide(spot) !== "meal") return true;
  const allowed = new Set(DAY_PART_MEAL[dayPart]);
  const times = spot.mealTimes?.length ? spot.mealTimes : (["lunch"] as MealTime[]);
  return times.some((t) => allowed.has(t));
}

function mealFitsForCourse(spot: Spot, dayPart: DayPart): boolean {
  if (spotGuide(spot) !== "meal") return true;
  const allowed = new Set(DAY_PART_MEAL_COURSE[dayPart]);
  const times = spot.mealTimes?.length ? spot.mealTimes : (["lunch"] as MealTime[]);
  return times.some((t) => allowed.has(t));
}

function dwellFor(guide: GuideKind, timeId: TimeOptionId = "3h"): number {
  const base = guide === "meal" ? 25 : guide === "rest" ? 15 : 12;
  const scaled = Math.round(base * STAY_DWELL_SCALE[timeId]);
  return Math.max(8, scaled);
}

function scoreSpot(
  spot: Spot,
  prefer: GuideKind[],
  dayPart: DayPart,
  used: Set<string>,
  mealPrefs: MealPrefs | null | undefined,
  style: CourseStyle,
  forceGuide: GuideKind | null,
): number {
  if (used.has(spot.id)) return -1;
  if (!mealFitsForCourse(spot, dayPart)) return -1;
  const guide = spotGuide(spot);
  if (isFoodGuide(guide) && !isLikelyOpen(spot, dayPart)) return -1;
  if (forceGuide && guide !== forceGuide) return -1;
  const preferIdx = prefer.indexOf(guide);
  let score = preferIdx >= 0 ? 50 - preferIdx * 10 : 4;
  if (style === "walk") {
    // 散歩中心: 土地の顔・景色を先に
    if (spot.majorWorthy) score += 72;
    if (guide === "sight") score += 14;
    if (guide === "rest") score += 12;
    if (guide === "souvenir") score += 6;
    if (spot.secretWorthy) score -= 4;
    if (!spot.majorWorthy && guide === "meal") score -= 30;
    if (/多目的|つながる|知る、感じる|コワーキング/.test(`${spot.name}${spot.blurb ?? ""}`)) {
      score -= 35;
    }
    score += Math.max(0, 12 - spot.walkMinutes * 0.35);
  } else if (style === "food") {
    if (guide === "meal") score += 14;
    if (guide === "souvenir") score += 12;
    if (guide === "rest" || guide === "tip") score += 6;
    if (spot.secretWorthy) score += 2;
    if (/多目的|つながる|知る、感じる|コワーキング/.test(`${spot.name}${spot.blurb ?? ""}`)) {
      score -= 28;
    }
    score += Math.max(0, 14 - Math.abs(spot.walkMinutes - 10) * 0.7);
  } else {
    if (spot.secretWorthy) score += 14;
    if (guide === "tip" || guide === "rest") score += 10;
    if (guide === "sight") score += 6;
    if (guide === "meal" && spot.mealTier === "upscale") score += 6;
    score += spot.walkMinutes * 0.95;
  }
  score += mealPrefScore(spot, mealPrefs);
  return score;
}

function isFoodGuide(guide: GuideKind): boolean {
  return guide === "meal" || guide === "souvenir";
}

function bestCandidate(
  pool: Spot[],
  prefer: GuideKind[],
  dayPart: DayPart,
  used: Set<string>,
  mealPrefs: MealPrefs | null | undefined,
  style: CourseStyle,
  elapsed: number,
  budgetMinutes: number,
  timeId: TimeOptionId,
  forceGuide: GuideKind | null,
): Spot | null {
  let best: Spot | null = null;
  let bestScore = -1;
  for (const spot of pool) {
    const guide = spotGuide(spot);
    const cost = spot.walkMinutes + dwellFor(guide, timeId);
    if (elapsed + cost > budgetMinutes + 8) continue;
    const score = scoreSpot(
      spot,
      prefer,
      dayPart,
      used,
      mealPrefs,
      style,
      forceGuide,
    );
    if (score > bestScore) {
      bestScore = score;
      best = spot;
    }
  }
  return bestScore >= 0 ? best : null;
}

function pickStops(
  pool: Spot[],
  preferIn: GuideKind[],
  dayPart: DayPart,
  timeId: TimeOptionId,
  startHour: number,
  mealPrefs: MealPrefs | null | undefined,
  style: CourseStyle,
  avoid: Set<string>,
): CourseStop[] {
  let prefer = [...preferIn];
  const used = new Set(avoid);
  const stops: CourseStop[] = [];
  let elapsed = 0;
  let cursorHour = startHour;
  let cursorMinute = 0;
  const maxStops = STAY_MAX_STOPS[timeId];
  const budgetMinutes = STAY_BUDGET[timeId];

  const pushStop = (best: Spot) => {
    const dwell = dwellFor(spotGuide(best), timeId);
    const walk = best.walkMinutes;
    cursorMinute += walk;
    cursorHour += Math.floor(cursorMinute / 60);
    cursorMinute %= 60;
    const clockLabel = formatClock(cursorHour, cursorMinute);
    stops.push({
      spotId: best.id,
      name: best.name,
      guide: spotGuide(best),
      blurb: best.blurb,
      walkMinutes: walk,
      dwellMinutes: dwell,
      clockLabel,
    });
    used.add(best.id);
    elapsed += walk + dwell;
    cursorMinute += dwell;
    cursorHour += Math.floor(cursorMinute / 60);
    cursorMinute %= 60;
    prefer = [...prefer.slice(1), prefer[0]!];
  };

  // 散歩中心: 土地の顔（major）を先に入れる（滞在が短いほど少なく）
  if (style === "walk") {
    const faces = pool
      .filter((s) => s.majorWorthy)
      .sort((a, b) => {
        const fame = (s: Spot) => {
          let v = 0;
          if (/大社|神宮|八幡|下鴨|賀茂|デルタ|港|市場|商店街|城/.test(s.name)) v += 40;
          else if (/寺$|神社/.test(s.name) && !/大社|神宮|八幡|下鴨|賀茂|清水|浅草|平等院|善光|飛行/.test(s.name))
            v -= 40;
          if (/世界遺産|名物|銘菓/.test(`${s.name}${s.blurb ?? ""}`)) v += 20;
          if (/ふたば|赤福|もみじ/.test(s.name)) v += 30;
          return v - s.walkMinutes * 0.2;
        };
        return fame(b) - fame(a);
      });
    for (const face of faces) {
      if (stops.length >= maxStops) break;
      const guide = spotGuide(face);
      const cost = face.walkMinutes + dwellFor(guide, timeId);
      if (used.has(face.id)) continue;
      if (elapsed + cost > budgetMinutes + 8) continue;
      if (!mealFitsForCourse(face, dayPart)) continue;
      if (isFoodGuide(guide) && !isLikelyOpen(face, dayPart)) continue;
      pushStop(face);
    }
  }

  const primary = prefer[0] ?? null;
  if (stops.length === 0 && primary) {
    const first = bestCandidate(
      pool,
      prefer,
      dayPart,
      used,
      mealPrefs,
      style,
      elapsed,
      budgetMinutes,
      timeId,
      primary,
    );
    if (first) pushStop(first);
  }

  while (stops.length < maxStops) {
    const best = bestCandidate(
      pool,
      prefer,
      dayPart,
      used,
      mealPrefs,
      style,
      elapsed,
      budgetMinutes,
      timeId,
      null,
    );
    if (!best) break;
    pushStop(best);
  }

  if (timeId === "half") {
    const extra = pool.find((s) => s.id.startsWith("reach-"));
    if (extra && !used.has(extra.id)) {
      if (stops.length >= maxStops) stops.pop();
      pushStop(extra);
    }
  }

  return stops;
}

/** 他駅に出町柳の固有名・遠すぎる座標が混ざっていたら落とす。 */
export function scrubForeignDemachiContamination(
  station: StationSeed,
): StationSeed {
  if (isDemachiStationName(station.name)) return station;

  const origin = stationOrigin(station);
  const spots = (station.spots ?? []).filter((s) => {
    if (isForeignDemachiPlace(s.name, station.name)) return false;
    if (isForeignDemachiPlace(s.blurb ?? "", station.name)) return false;
    if (isForeignDemachiPlace(s.detail ?? "", station.name)) return false;
    if (s.lat != null && s.lng != null && isOnDemachiPin(s.lat, s.lng)) {
      return false;
    }
    if (!origin || s.lat == null || s.lng == null) return true;
    // 出町〜八瀬は約5km。初訪問ショートの徒歩圏を超えたら落とす
    return haversineKm(origin, { lat: s.lat, lng: s.lng }) <= FIRST_VISIT_MAX_KM;
  });
  const firstVisitFaces = (station.firstVisitFaces ?? []).filter(
    (f) => !isForeignDemachiPlace(f.name, station.name),
  );
  const sightseeingNotes = (station.sightseeingNotes ?? []).filter(
    (n) =>
      !isForeignDemachiPlace(n.title, station.name) &&
      !isForeignDemachiPlace(n.body, station.name),
  );
  return {
    ...station,
    spots,
    firstVisitFaces: firstVisitFaces.length ? firstVisitFaces : undefined,
    sightseeingNotes: sightseeingNotes.length ? sightseeingNotes : undefined,
    catchCopy: stripExclusiveDemachiSentences(station.catchCopy) ?? station.catchCopy,
    tourTitle: stripExclusiveDemachiSentences(station.tourTitle) ?? station.tourTitle,
    stationIntro: stripExclusiveDemachiSentences(station.stationIntro),
    areaAbout: stripExclusiveDemachiSentences(station.areaAbout),
    walkGuide: stripExclusiveDemachiSentences(station.walkGuide),
  };
}

function ensureLocalMajors(station: StationSeed): StationSeed {
  // 土地文の商店街・橋などをスポット化してから顔を整える
  let working = ensureLandMentions(scrubForeignDemachiContamination(station));
  if (
    /出町柳/.test(working.name) &&
    !working.spots.some((s) => s.name.includes("ふたば"))
  ) {
    working = {
      ...working,
      spots: [
        ...working.spots,
        {
          id: "ai-major-futaba",
          name: "出町ふたば",
          genre: "gourmet",
          guide: "meal",
          mealTier: "casual",
          mealTimes: ["morning", "lunch"],
          soloOk: true,
          budgetYen: "〜¥800",
          blurb: "出町の顔といえば豆餅。",
          walkMinutes: 3,
          x: 0.45,
          y: 0.4,
          majorWorthy: true,
          lat: 35.03011,
          lng: 135.76963,
        },
      ],
    };
  }
  const marked = working.spots.filter((s) => s.majorWorthy);
  const scored = [...working.spots]
    .map((s) => {
      let score = 0;
      if (s.majorWorthy) score += 100;
      if (/ふたば|みたらし|だんご|団子/.test(s.name)) score += 60;
      if (s.guide === "sight") score += 42;
      else if (s.guide === "meal") score += 28;
      else if (s.guide === "souvenir") score += 18;
      if (/大社|神宮|八幡|下鴨|賀茂|城|デルタ|公園|ふたば|市場|商店街/.test(s.name))
        score += 28;
      else if (/寺$|神社/.test(s.name) && !/大社|神宮|八幡|下鴨|賀茂|清水|浅草|平等院|善光|飛行/.test(s.name))
        score -= 50;
      score += Math.max(0, 22 - s.walkMinutes);
      if (s.secretWorthy) score -= 35;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score || a.s.walkMinutes - b.s.walkMinutes);

  // 名所・景色3＋名物2（合計5）
  const MAJOR_TOTAL = 5;
  const MAJOR_SIGHT = 3;
  const MAJOR_FOOD = 2;
  const must = working.spots.find((s) => s.name.includes("ふたば"));
  const landmarkRows = scored.filter(
    (x) =>
      x.s.guide === "sight" ||
      x.s.guide === "rest" ||
      /大社|神宮|八幡|下鴨|賀茂|デルタ|城|宮|公園|商店街|市場|橋/.test(x.s.name) ||
        (/寺$|神社/.test(x.s.name) &&
          /大社|神宮|八幡|下鴨|賀茂|清水|浅草|平等院|善光|飛行|総本山|大本山/.test(x.s.name)),
  );
  if (
    marked.length >= MAJOR_TOTAL &&
    marked.filter((m) => m.guide === "sight" || m.guide === "rest").length >= 2 &&
    (!must || marked.some((m) => m.id === must.id))
  ) {
    return working;
  }

  const picked: Spot[] = [];
  for (const row of landmarkRows) {
    if (picked.length >= MAJOR_SIGHT) break;
    picked.push(row.s);
  }
  if (must && picked.length < MAJOR_TOTAL) picked.push(must);
  let foodCount = picked.filter((p) => isFoodGuide(spotGuide(p))).length;
  for (const row of scored) {
    if (picked.length >= MAJOR_TOTAL) break;
    if (!isFoodGuide(spotGuide(row.s))) continue;
    if (foodCount >= MAJOR_FOOD) continue;
    if (!picked.some((p) => p.id === row.s.id)) {
      picked.push(row.s);
      foodCount += 1;
    }
  }
  for (const row of scored) {
    if (picked.length >= MAJOR_TOTAL) break;
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  const ids = new Set(picked.slice(0, MAJOR_TOTAL).map((p) => p.id));
  return {
    ...working,
    spots: working.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

function ordinaryFameScore(spot: Spot, stationName: string): number {
  const n = spot.name;
  const blob = `${n}${spot.blurb ?? ""}${spot.detail ?? ""}`;
  let score = 0;
  if (spot.majorWorthy) score += 40;
  if (spotGuide(spot) === "sight") score += 8;
  if (isGuidebookWorship(n, stationName)) score += 55;
  if (/デルタ|三角州/.test(n)) score += 70;
  if (isOrdinaryPublicFace(n) || /合流/.test(n)) score += 45;
  if (/城|金閣|清水|浅草/.test(n)) score += 35;
  if (/世界遺産/.test(blob)) score += 20;
  if (/城跡|復元|参道|楼門/.test(n)) score -= 20;
  if (isNeighborhoodWorship(n, stationName)) score -= 80;
  if (/多目的|つながる|知る、感じる|コワーキング/.test(blob)) score -= 50;
  score += Math.max(0, 8 - spot.walkMinutes * 0.2);
  return score;
}

/** 駅から近い順（実座標 → 徒歩分）。歩くページ・地図番号の正本。 */
function sortNearStation(spots: Spot[], station: StationSeed): Spot[] {
  let origin: { lat: number; lng: number } | null = null;
  try {
    origin = stationLatLng(station);
  } catch {
    origin =
      station.lat != null && station.lng != null
        ? { lat: station.lat, lng: station.lng }
        : null;
  }
  const meters = (s: Spot) => {
    if (
      origin &&
      s.lat != null &&
      s.lng != null &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng)
    ) {
      const km = haversineKm(origin, { lat: s.lat, lng: s.lng });
      // 駅とほぼ同座標の仮ピンだけ徒歩分を代理に（案内タブと同じ 0.02km）。
      // 0.08km だと実座標の鴨川デルタ等まで仮扱いになり、近い順が崩れる。
      if (km < 0.02) return Math.max(s.walkMinutes, 1) * 80;
      return km * 1000;
    }
    return Math.max(s.walkMinutes, 1) * 80;
  };
  return [...spots].sort((a, b) => {
    const dm = meters(a) - meters(b);
    if (Math.abs(dm) > 15) return dm;
    if (a.walkMinutes !== b.walkMinutes) return a.walkMinutes - b.walkMinutes;
    return a.name.localeCompare(b.name, "ja");
  });
}

/** 短い別名の食い付きを避ける（「山崎」が「大山崎山荘」に当たる等）。 */
function namesLikelySamePlace(a: string, b: string): boolean {
  if (a === b) return true;
  if (/枡形|桝形/.test(a) && /枡形|桝形/.test(b) && !/満寿/.test(a) && !/満寿/.test(b)) {
    return true;
  }
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!long.includes(short)) return false;
  // 短い方が長名の大部分を占めるときだけ同一視（参道ケーブル≠本殿）
  return short.length >= 4 && short.length >= long.length * 0.85;
}

function sameWalkPlace(a: Spot, b: Spot): boolean {
  if (a.id === b.id) return true;
  return namesLikelySamePlace(a.name, b.name);
}

function spotMatchesAnchorKeys(spotName: string, keys: string[]): boolean {
  return keys.some((k) => {
    if (spotName === k) return true;
    // スポット名がキーを含む（「石清水八幡宮参道ケーブル」がキー「参道ケーブル」）
    if (k.length >= 4 && spotName.includes(k)) return true;
    // キーがスポット名を含むのは、ほぼ同名のときだけ（本殿に参道キーを当てない）
    if (
      spotName.length >= 4 &&
      k.includes(spotName) &&
      spotName.length >= k.length * 0.85
    ) {
      return true;
    }
    return false;
  });
}

function stationOrigin(station: StationSeed): { lat: number; lng: number } | null {
  try {
    return stationLatLng(station);
  } catch {
    return station.lat != null && station.lng != null
      ? { lat: station.lat, lng: station.lng }
      : null;
  }
}

function spotNearStation(spot: Spot, station: StationSeed): boolean {
  if (isForeignDemachiPlace(spot.name, station.name)) return false;
  if (
    !isDemachiStationName(station.name) &&
    spot.lat != null &&
    spot.lng != null &&
    isOnDemachiPin(spot.lat, spot.lng)
  ) {
    return false;
  }
  const origin = stationOrigin(station);
  if (!origin || spot.lat == null || spot.lng == null) {
    // 座標が無いときは出町固有名だけでも落とす。徒歩分が極端なら疑う。
    return !isForeignDemachiPlace(spot.name, station.name) && spot.walkMinutes <= 40;
  }
  return haversineKm(origin, { lat: spot.lat, lng: spot.lng }) <= FIRST_VISIT_MAX_KM;
}

function spotFromFaceName(
  station: StationSeed,
  name: string,
  meta: { why?: string; present?: string; where?: string; walkMinutes?: number; lat?: number; lng?: number },
): Spot | null {
  if (isForeignDemachiPlace(name, station.name)) return null;
  const hit = (station.spots ?? []).find((s) =>
    spotMatchesAnchorKeys(s.name, [name]),
  );
  if (hit && spotNearStation(hit, station)) {
    return hit;
  }
  const origin = stationOrigin(station);
  const lat =
    meta.lat ??
    (origin ? origin.lat + 0.0004 : station.lat ?? undefined);
  const lng =
    meta.lng ??
    (origin ? origin.lng - 0.0003 : station.lng ?? undefined);
  if (lat == null || lng == null) return null;
  const locked = meta.lat != null && meta.lng != null;
  const created: Spot = {
    id: `face-${name.replace(/\s+/g, "").slice(0, 28)}`,
    name,
    genre: "odd",
    guide: "sight",
    mealTier: "casual",
    mealTimes: [],
    soloOk: true,
    budgetYen: "—",
    hours: "終日（屋外）",
    blurb: [meta.why, meta.present].filter(Boolean).join(" "),
    detail: meta.where,
    walkMinutes: meta.walkMinutes ?? 8,
    x: 0.42,
    y: 0.38,
    majorWorthy: true,
    secretWorthy: false,
    lat,
    lng,
    coordTrust: locked ? "lock" : "unverified",
  };
  return spotNearStation(created, station) ? created : null;
}

/**
 * 出町柳雛形のショート正本（役割は共通・固有名は駅ごと）。
 * 1) land-present-anchors の mustVisit（その駅だけ）
 * 2) AI の firstVisitFaces
 * 3) 観光案内メモ（駅近傍のみ）
 */
function mustVisitWalkSpots(station: StationSeed): Spot[] {
  const anchors = landAnchorsFor(station.name).filter((a) => a.mustVisit);
  const found: Spot[] = [];
  for (const anchor of anchors) {
    if (isForeignDemachiPlace(anchor.name, station.name)) continue;
    const keys = [anchor.name, ...(anchor.aliases ?? [])];
    const hit = (station.spots ?? []).find((s) =>
      spotMatchesAnchorKeys(s.name, keys),
    );
    if (hit && spotNearStation(hit, station)) {
      if (!found.some((f) => sameWalkPlace(f, hit))) found.push(hit);
      continue;
    }
    const created = spotFromFaceName(station, anchor.name, {
      why: anchor.why,
      present: anchor.present,
      where: anchor.where,
      walkMinutes: anchor.walkMinutes,
      lat: anchor.lat,
      lng: anchor.lng,
    });
    if (created && !found.some((f) => sameWalkPlace(f, created))) {
      found.push(created);
    }
  }
  if (found.length >= 2) return found;

  for (const face of station.firstVisitFaces ?? []) {
    const created = spotFromFaceName(station, face.name, face);
    if (created && !found.some((f) => sameWalkPlace(f, created))) {
      found.push(created);
    }
  }
  if (found.length >= 2) return found;

  for (const note of station.sightseeingNotes ?? []) {
    if (isForeignDemachiPlace(note.title, station.name)) continue;
    const title = note.title.replace(/と.+$/u, "").trim() || note.title;
    if (title.length < 2) continue;
    const hit = (station.spots ?? []).find((s) =>
      spotMatchesAnchorKeys(s.name, [title, note.title]),
    );
    if (
      hit &&
      spotNearStation(hit, station) &&
      !found.some((f) => sameWalkPlace(f, hit))
    ) {
      found.push(hit);
    } else if (!found.some((f) => namesLikelySamePlace(f.name, title))) {
      const created = spotFromFaceName(station, title, {
        why: note.body,
        walkMinutes: 8 + found.length * 3,
      });
      if (created && !found.some((f) => sameWalkPlace(f, created))) {
        found.push(created);
      }
    }
    if (found.length >= 3) break;
  }
  return found.filter((s) => spotNearStation(s, station));
}

function ensureMustVisits(
  set: Spot[],
  must: Spot[],
  station: StationSeed,
  cap: number,
): Spot[] {
  const out = [...set];
  const limit = Math.max(cap, must.length);
  let origin: { lat: number; lng: number } | null = null;
  try {
    origin = stationLatLng(station);
  } catch {
    origin =
      station.lat != null && station.lng != null
        ? { lat: station.lat, lng: station.lng }
        : null;
  }
  const dist = (s: Spot) => {
    if (!origin || s.lat == null || s.lng == null) return s.walkMinutes * 80;
    return haversineKm(origin, { lat: s.lat, lng: s.lng }) * 1000;
  };
  for (const m of must) {
    if (out.some((s) => sameWalkPlace(s, m))) continue;
    if (out.length < limit) {
      out.push(m);
      continue;
    }
    let dropIdx = -1;
    let dropDist = -1;
    for (let i = 0; i < out.length; i++) {
      if (must.some((x) => sameWalkPlace(out[i]!, x))) continue;
      const d = dist(out[i]!);
      if (d > dropDist) {
        dropDist = d;
        dropIdx = i;
      }
    }
    if (dropIdx >= 0) out[dropIdx] = m;
  }
  return out;
}

function ordinaryWalkPool(station: StationSeed): Spot[] {
  const soft = (spot: Spot) =>
    /多目的|つながる|知る、感じる|コワーキング/.test(
      `${spot.name}${spot.blurb ?? ""}`,
    );
  // 歩くは土地文の名前が正本。地図用 lock/Apple は必須にしない。
  const near = (spot: Spot) =>
    !soft(spot) && spotNearStation(spot, station);
  const narrative = landNarrativeSpots(station).filter(near);
  if (narrative.length >= 2) return narrative;
  const introduced = introducedVisitSpots(station).filter((s) => {
    if (!near(s)) return false;
    const g = spotGuide(s);
    return (
      g === "sight" ||
      g === "rest" ||
      g === "tip" ||
      !!s.majorWorthy ||
      isOrdinaryPublicFace(s.name) ||
      isGuidebookWorship(s.name, station.name)
    );
  });
  if (introduced.length) return introduced;
  return (station.spots ?? []).filter((s) => {
    if (!near(s) || s.name.endsWith("駅")) return false;
    const g = spotGuide(s);
    return (
      g === "sight" ||
      g === "rest" ||
      !!s.majorWorthy ||
      isGuidebookWorship(s.name, station.name)
    );
  });
}

function buildOrdinaryVariant(
  prepared: StationSeed,
  dayPart: DayPart,
  timeId: TimeOptionId,
  spots: Spot[],
  kind: "short" | "long",
): WalkCourse | null {
  if (!spots.length) return null;
  const startHour = defaultClockHour(dayPart);
  const provisional: CourseStop[] = spots.map((spot) => ({
    spotId: spot.id,
    name: spot.name,
    guide: spotGuide(spot),
    blurb: spot.blurb ?? "",
    walkMinutes: spot.walkMinutes,
    dwellMinutes: dwellFor(spotGuide(spot), timeId),
    clockLabel: "",
  }));
  // 駅出発→立ち寄り→駅帰還の周回（同じ道の往復を避ける）
  return finishLoopCourse(
    prepared,
    startHour,
    timeId,
    provisional,
    spots,
    {
      id: `ordinary-${kind}-${prepared.name.replace(/駅$/u, "")}-${dayPart}`,
      title: kind === "short" ? "駅から、小回り" : "駅から、大回り",
      subtitle:
        kind === "short"
          ? `ぶらりと回って駅へ帰る · ${spots.length}か所`
          : `もう少し遠くまで回って駅へ帰る · ${spots.length}か所`,
      vibe:
        kind === "short"
          ? "駅を出て、少し回り道をして、駅へ帰る"
          : "少し先まで回り道をして、駅へ帰る",
    },
  );
}

/** ショート＝mustVisit 雛形。ロング＝雛形＋先。歩き順は道なり最適化。 */
export function buildFirstVisitOrdinaryCourses(
  station: StationSeed,
  dayPart: DayPart,
  timeId: TimeOptionId = "half",
): WalkCourse[] {
  const prepared = sealMapCoordinates(
    ensureLocalMajors(scrubForeignDemachiContamination(station)),
  );
  const scrubbedPrepared = scrubForeignDemachiContamination(prepared);
  const must = mustVisitWalkSpots(scrubbedPrepared).filter((s) =>
    spotNearStation(s, scrubbedPrepared),
  );
  let pool = ordinaryWalkPool(scrubbedPrepared).filter((s) =>
    spotNearStation(s, scrubbedPrepared),
  );
  for (const spot of must) {
    if (!pool.some((s) => sameWalkPlace(s, spot))) pool = [...pool, spot];
  }
  if (!pool.length) return [];
  const near = sortNearStation(pool, scrubbedPrepared);
  // 雛形がある駅はショート＝mustVisit そのもの（出町方式: 土地の顔3点など）。
  const shortRaw =
    must.length >= 2
      ? must
      : ensureMustVisits(
          near.slice(0, Math.min(3, near.length)),
          must,
          scrubbedPrepared,
          Math.min(3, near.length),
        );
  const shortSet = shortRaw.filter((s) => spotNearStation(s, scrubbedPrepared));
  if (!shortSet.length) return [];
  const longCap = Math.min(
    Math.max(STAY_MAX_STOPS[timeId], 5),
    Math.max(near.length, shortSet.length),
    6,
  );
  const longSet = ensureMustVisits(
    near.slice(0, longCap),
    must,
    scrubbedPrepared,
    longCap,
  ).filter((s) => spotNearStation(s, scrubbedPrepared));
  const out: WalkCourse[] = [];
  const short = buildOrdinaryVariant(
    scrubbedPrepared,
    dayPart,
    timeId,
    shortSet,
    "short",
  );
  if (short) out.push(short);
  if (longSet.length > shortSet.length) {
    const long = buildOrdinaryVariant(
      scrubbedPrepared,
      dayPart,
      timeId,
      longSet,
      "long",
    );
    if (long) out.push(long);
  }
  return out;
}

/** 互換: ショート（無ければロング）を1本。 */
export function buildFirstVisitOrdinaryCourse(
  station: StationSeed,
  dayPart: DayPart,
  timeId: TimeOptionId = "half",
): WalkCourse | null {
  return buildFirstVisitOrdinaryCourses(station, dayPart, timeId)[0] ?? null;
}

export function buildCoursesForStation(
  station: StationSeed,
  timeId: TimeOptionId,
  dayPart: DayPart,
  mealPrefs?: MealPrefs | null,
): WalkCourse[] {
  const prepared = ensureLocalMajors(station);
  const timeIndex = timeId === "1h" ? 0 : timeId === "3h" ? 1 : 2;
  const walkPool = spotsForTime(prepared, timeIndex);
  const pool = walkPool.filter(
    (s) =>
      mealFitsForCourse(s, dayPart) &&
      (!isFoodGuide(spotGuide(s)) || isLikelyOpen(s, dayPart)),
  );
  const openWalk = walkPool.filter(
    (s) => !isFoodGuide(spotGuide(s)) || isLikelyOpen(s, dayPart),
  );
  const source = pool.length >= 3 ? pool : openWalk;
  const budget = STAY_BUDGET[timeId];
  const startHour = defaultClockHour(dayPart);
  const claimed = new Set<string>();

  return COURSE_TEMPLATES.map((template) => {
    const prefer =
      dayPart === "morning" && template.style === "food"
        ? (["meal", "souvenir", "sight"] as GuideKind[])
        : dayPart === "night" && template.style === "farther"
          ? (["meal", "tip", "rest"] as GuideKind[])
          : template.prefer;
    const rawStops = pickStops(
      source,
      [...prefer],
      dayPart,
      timeId,
      startHour,
      mealPrefs,
      template.style,
      claimed,
    );
    const course = finishLoopCourse(
      prepared,
      startHour,
      timeId,
      rawStops,
      [],
      {
        id: `${template.id}-${timeId}-${dayPart}`,
        title: template.title,
        subtitle: `${template.subtitle} · ${STAY_LENGTH_HINT[timeId]}`,
        vibe: template.vibe,
      },
    );
    if (!course) return null;
    for (const stop of course.stops.slice(0, 2)) claimed.add(stop.spotId);
    return {
      ...course,
      totalMinutes: course.totalMinutes || Math.min(budget, 45),
    };
  }).filter((c): c is WalkCourse => !!c && c.stops.length > 0);
}

type LatLng = { lat: number; lng: number };

function spotCoord(spot: Spot): LatLng | null {
  if (
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    Number.isFinite(spot.lat) &&
    Number.isFinite(spot.lng)
  ) {
    return { lat: spot.lat, lng: spot.lng };
  }
  return null;
}

function finishLoopCourse(
  station: StationSeed,
  startHour: number,
  timeId: TimeOptionId,
  stops: CourseStop[],
  extraSpots: Spot[],
  meta: { id: string; title: string; subtitle: string; vibe: string },
): WalkCourse | null {
  if (stops.length === 0) return null;
  const byId = new Map<string, Spot>();
  for (const s of station.spots ?? []) byId.set(s.id, s);
  for (const s of extraSpots) byId.set(s.id, s);
  const resolved = stops
    .map((s) => byId.get(s.spotId))
    .filter((s): s is Spot => !!s && spotCoord(s) != null);
  if (!resolved.length) return null;

  const start = stationLatLng(station);
  const ordered = orderStopsAsStationLoop(start, resolved);
  const built = rebuildStopsWithLegs(start, startHour, timeId, ordered);
  const last = built[built.length - 1]!;
  const lastSpot = ordered[ordered.length - 1]!;
  const lastLl = spotCoord(lastSpot)!;
  const returnKm = haversineKm(lastLl, start);
  const returnWalk = Math.max(
    1,
    Math.min(90, Math.round((returnKm * 1.3) / 4.5 * 60)),
  );
  let hour = startHour;
  let minute = 0;
  const parsed = (last.clockLabel ?? "").split(":");
  if (parsed.length === 2) {
    hour = Number(parsed[0]) || startHour;
    minute = Number(parsed[1]) || 0;
  }
  minute += last.dwellMinutes + returnWalk;
  hour += Math.floor(minute / 60);
  minute %= 60;
  const returnClockLabel = formatClock(hour % 24, minute);
  const visitTotal = built.reduce(
    (sum, s) => sum + s.walkMinutes + s.dwellMinutes,
    0,
  );
  return {
    id: meta.id,
    title: meta.title,
    subtitle: meta.subtitle,
    vibe: meta.vibe,
    totalMinutes: Math.max(visitTotal + returnWalk, 20),
    stopCount: built.length,
    stops: built,
    returnWalkMinutes: returnWalk,
    returnClockLabel,
  };
}

/** 駅を始点・終点にした扇形の並び。最大の空角を帰りに使う。 */
function orderStopsAsStationLoop(start: LatLng, spots: Spot[]): Spot[] {
  if (spots.length <= 1) return spots;
  const angled = spots
    .map((spot) => {
      const ll = spotCoord(spot)!;
      return {
        spot,
        angle: Math.atan2(ll.lng - start.lng, ll.lat - start.lat),
      };
    })
    .sort((a, b) => a.angle - b.angle);

  let bestGap = -1;
  let startIdx = 0;
  for (let i = 0; i < angled.length; i++) {
    const a = angled[i]!.angle;
    const b =
      i + 1 < angled.length
        ? angled[i + 1]!.angle
        : angled[0]!.angle + Math.PI * 2;
    const gap = b - a;
    if (gap > bestGap) {
      bestGap = gap;
      startIdx = (i + 1) % angled.length;
    }
  }

  let ordered = Array.from({ length: angled.length }, (_, i) => {
    return angled[(startIdx + i) % angled.length]!.spot;
  });

  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const dFirst = haversineKm(start, spotCoord(first)!);
  const dLast = haversineKm(start, spotCoord(last)!);
  if (dLast + 0.05 < dFirst) ordered = ordered.reverse();

  return twoOptLoop(start, ordered);
}

function loopLengthKm(start: LatLng, spots: Spot[]): number {
  let cur = start;
  let total = 0;
  for (const spot of spots) {
    const ll = spotCoord(spot)!;
    total += haversineKm(cur, ll);
    cur = ll;
  }
  if (spots.length) total += haversineKm(cur, start);
  return total;
}

function twoOptLoop(start: LatLng, spots: Spot[]): Spot[] {
  if (spots.length < 3) return spots;
  let best = [...spots];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (loopLengthKm(start, candidate) + 0.02 < loopLengthKm(start, best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

function rebuildStopsWithLegs(
  start: LatLng,
  startHour: number,
  timeId: TimeOptionId,
  spots: Spot[],
): CourseStop[] {
  const out: CourseStop[] = [];
  let hour = startHour;
  let minute = 0;
  let cur = start;
  for (const spot of spots) {
    const ll = spotCoord(spot)!;
    const km = haversineKm(cur, ll);
    const walk = Math.max(1, Math.min(90, Math.round((km * 1.3) / 4.5 * 60)));
    minute += walk;
    hour += Math.floor(minute / 60);
    minute %= 60;
    const clockLabel = formatClock(hour, minute);
    const guide = spotGuide(spot);
    const dwell = dwellFor(guide, timeId);
    out.push({
      spotId: spot.id,
      name: spot.name,
      guide,
      blurb: spot.blurb,
      walkMinutes: walk,
      dwellMinutes: dwell,
      clockLabel,
    });
    minute += dwell;
    hour += Math.floor(minute / 60);
    minute %= 60;
    cur = ll;
  }
  return out;
}
