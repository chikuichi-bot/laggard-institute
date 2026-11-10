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
import { haversineKm, stationLatLng } from "@/lib/mishiranu-geo";

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

  return stops;
}

function ensureLocalMajors(station: StationSeed): StationSeed {
  let working = station;
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

  // 名所2＋名物1
  const must = working.spots.find((s) => s.name.includes("ふたば"));
  const landmarkRows = scored.filter(
    (x) =>
      x.s.guide === "sight" ||
      /大社|神宮|八幡|下鴨|賀茂|デルタ|城|宮|公園|商店街|市場|橋/.test(x.s.name) ||
        (/寺$|神社/.test(x.s.name) &&
          /大社|神宮|八幡|下鴨|賀茂|清水|浅草|平等院|善光|飛行|総本山|大本山/.test(x.s.name)),
  );
  if (
    marked.length >= 3 &&
    marked.filter((m) => m.guide === "sight").length >= 2 &&
    (!must || marked.some((m) => m.id === must.id))
  ) {
    return working;
  }

  const picked: Spot[] = [];
  for (const row of landmarkRows) {
    if (picked.length >= 2) break;
    picked.push(row.s);
  }
  if (must && picked.length < 3) picked.push(must);
  for (const row of scored) {
    if (picked.length >= 3) break;
    if (isFoodGuide(spotGuide(row.s)) && picked.some((p) => isFoodGuide(spotGuide(p)))) {
      continue;
    }
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  const ids = new Set(picked.slice(0, 3).map((p) => p.id));
  return {
    ...working,
    spots: working.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
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
    const stops = orderStopsAlongWalk(prepared, startHour, timeId, rawStops);
    for (const stop of stops.slice(0, 2)) claimed.add(stop.spotId);
    const totalMinutes = stops.reduce(
      (sum, s) => sum + s.walkMinutes + s.dwellMinutes,
      0,
    );
    return {
      id: `${template.id}-${timeId}-${dayPart}`,
      title: template.title,
      subtitle: `${template.subtitle} · ${STAY_LENGTH_HINT[timeId]}`,
      vibe: template.vibe,
      totalMinutes: totalMinutes || Math.min(budget, 45),
      stopCount: stops.length,
      stops,
    };
  }).filter((c) => c.stops.length > 0);
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

/** 駅から近い未訪問へ進む並び。2-optで交差を減らす。 */
function orderStopsAlongWalk(
  station: StationSeed,
  startHour: number,
  timeId: TimeOptionId,
  stops: CourseStop[],
): CourseStop[] {
  if (stops.length <= 1) return stops;
  const byId = new Map(station.spots.map((s) => [s.id, s]));
  let remaining = stops
    .map((s) => byId.get(s.spotId))
    .filter((s): s is Spot => !!s && spotCoord(s) != null);
  if (remaining.length <= 1) return stops;

  const start = stationLatLng(station);
  const ordered: Spot[] = [];
  let cur: LatLng = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestKm = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const ll = spotCoord(remaining[i]!)!;
      const km = haversineKm(cur, ll);
      if (km < bestKm) {
        bestKm = km;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!;
    ordered.push(next);
    cur = spotCoord(next)!;
  }

  const optimized = twoOptPath(start, ordered);
  return rebuildStopsWithLegs(start, startHour, timeId, optimized);
}

function pathLengthKm(start: LatLng, spots: Spot[]): number {
  let cur = start;
  let total = 0;
  for (const spot of spots) {
    const ll = spotCoord(spot)!;
    total += haversineKm(cur, ll);
    cur = ll;
  }
  return total;
}

function twoOptPath(start: LatLng, spots: Spot[]): Spot[] {
  if (spots.length < 3) return spots;
  let best = [...spots];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (pathLengthKm(start, candidate) + 0.02 < pathLengthKm(start, best)) {
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
