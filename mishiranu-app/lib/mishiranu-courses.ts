import {
  GUIDE_ORDER,
  spotGuide,
  spotsForTime,
  type GuideKind,
  type MealTime,
  type Spot,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";

export type DayPart = "morning" | "midday" | "afternoon" | "evening" | "night";

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

const STAY_BUDGET: Record<TimeOptionId, number> = {
  "1h": 55,
  "3h": 150,
  half: 240,
};

const COURSE_TEMPLATES: Array<{
  id: string;
  title: string;
  subtitle: string;
  vibe: string;
  prefer: GuideKind[];
}> = [
  {
    id: "slow",
    title: "ゆる歩きコース",
    subtitle: "景色と休みを多めに",
    vibe: "急がず、土地の気配を拾う",
    prefer: ["sight", "rest", "tip"],
  },
  {
    id: "taste",
    title: "食べる寄り道コース",
    subtitle: "ご飯と土産を軸に",
    vibe: "空腹と手土産のあいだを歩く",
    prefer: ["meal", "souvenir", "rest"],
  },
  {
    id: "farther",
    title: "少し先までコース",
    subtitle: "徒歩圏の端まで伸ばす",
    vibe: "駅前を抜けて、ひとつ奥へ",
    prefer: ["tip", "sight", "meal"],
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

function mealFits(spot: Spot, dayPart: DayPart): boolean {
  if (spotGuide(spot) !== "meal") return true;
  const allowed = new Set(DAY_PART_MEAL[dayPart]);
  const times = spot.mealTimes?.length ? spot.mealTimes : (["lunch"] as MealTime[]);
  return times.some((t) => allowed.has(t));
}

function scoreSpot(
  spot: Spot,
  prefer: GuideKind[],
  dayPart: DayPart,
  used: Set<string>,
): number {
  if (used.has(spot.id)) return -1;
  if (!mealFits(spot, dayPart)) return -1;
  const guide = spotGuide(spot);
  const preferIdx = prefer.indexOf(guide);
  let score = preferIdx >= 0 ? 40 - preferIdx * 8 : 8;
  if (spot.secretWorthy) score += 6;
  // Prefer nearer pins early, farther later via template
  score += Math.max(0, 18 - spot.walkMinutes * 0.35);
  const orderBoost = GUIDE_ORDER.indexOf(guide);
  score += (5 - orderBoost) * 0.4;
  return score;
}

function pickStops(
  pool: Spot[],
  prefer: GuideKind[],
  dayPart: DayPart,
  budgetMinutes: number,
  startHour: number,
): CourseStop[] {
  const used = new Set<string>();
  const stops: CourseStop[] = [];
  let elapsed = 0;
  let cursorHour = startHour;
  let cursorMinute = 0;
  const maxStops = budgetMinutes <= 60 ? 3 : budgetMinutes <= 160 ? 4 : 5;

  while (stops.length < maxStops) {
    let best: Spot | null = null;
    let bestScore = -1;
    for (const spot of pool) {
      const dwell = spotGuide(spot) === "meal" ? 25 : spotGuide(spot) === "rest" ? 15 : 12;
      const cost = spot.walkMinutes + dwell;
      if (elapsed + cost > budgetMinutes + 8) continue;
      const score = scoreSpot(spot, prefer, dayPart, used);
      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }
    if (!best || bestScore < 0) break;

    const dwell =
      spotGuide(best) === "meal" ? 25 : spotGuide(best) === "rest" ? 15 : 12;
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

    // Rotate preference so courses don't clone the same first pick only
    prefer = [...prefer.slice(1), prefer[0]!];
  }

  return stops;
}

export function buildCoursesForStation(
  station: StationSeed,
  timeId: TimeOptionId,
  dayPart: DayPart,
): WalkCourse[] {
  const timeIndex = timeId === "1h" ? 0 : timeId === "3h" ? 1 : 2;
  const pool = spotsForTime(station, timeIndex).filter((s) => mealFits(s, dayPart));
  const fallbackPool = spotsForTime(station, timeIndex);
  const budget = STAY_BUDGET[timeId];
  const startHour = defaultClockHour(dayPart);

  return COURSE_TEMPLATES.map((template) => {
    const source = pool.length >= 3 ? pool : fallbackPool;
    const prefer =
      dayPart === "morning" && template.id === "taste"
        ? (["meal", "sight", "souvenir"] as GuideKind[])
        : dayPart === "night" && template.id === "farther"
          ? (["meal", "tip", "rest"] as GuideKind[])
          : template.prefer;
    const stops = pickStops(source, [...prefer], dayPart, budget, startHour);
    const totalMinutes = stops.reduce(
      (sum, s) => sum + s.walkMinutes + s.dwellMinutes,
      0,
    );
    return {
      id: `${template.id}-${timeId}-${dayPart}`,
      title: template.title,
      subtitle: template.subtitle,
      vibe: template.vibe,
      totalMinutes: totalMinutes || Math.min(budget, 45),
      stopCount: stops.length,
      stops,
    };
  }).filter((c) => c.stops.length > 0);
}
