export type OpenDaysData = {
  updatedAt: string;
  /** 営業時間の表示（例: 10:00–17:00） */
  hoursLabel: string;
  /** 補足（予約制など） */
  note: string;
  /** 毎週の営業曜日（0=日 … 6=土） */
  weeklyWeekdays: number[];
  /** 臨時営業日（YYYY-MM-DD） */
  extraDays: string[];
  /** 臨時休業日（YYYY-MM-DD） */
  closedDays: string[];
};

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function sortOpenDays(days: string[]) {
  return [...days].sort();
}

export function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidWeekday(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

export function normalizeWeeklyWeekdays(weekdays: number[]) {
  return [...new Set(weekdays.filter(isValidWeekday))].sort((a, b) => a - b);
}

export function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateKeyFromDate(date: Date) {
  return dateKeyFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

export function weekdayFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return -1;
  return new Date(year, month - 1, day).getDay();
}

export function isOpenDay(
  data: Pick<OpenDaysData, "weeklyWeekdays" | "extraDays" | "closedDays">,
  dateKey: string,
) {
  if (!isValidDateKey(dateKey)) return false;
  if (data.closedDays.includes(dateKey)) return false;
  if (data.extraDays.includes(dateKey)) return true;
  const weekday = weekdayFromDateKey(dateKey);
  return weekday >= 0 && data.weeklyWeekdays.includes(weekday);
}

export function listUpcomingOpenDays(
  data: Pick<OpenDaysData, "weeklyWeekdays" | "extraDays" | "closedDays">,
  fromDateKey: string,
  limit = 6,
) {
  if (!isValidDateKey(fromDateKey)) return [];

  const [year, month, day] = fromDateKey.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  const end = new Date(cursor);
  end.setFullYear(end.getFullYear() + 1);

  const results: string[] = [];
  while (results.length < limit && cursor <= end) {
    const key = dateKeyFromDate(cursor);
    if (isOpenDay(data, key)) {
      results.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

export function formatCalendarMonthLabel(year: number, month: number) {
  return `${year}年${month + 1}月`;
}

export function formatOpenDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const weekday = WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
  return `${month}月${day}日（${weekday}）`;
}

export function formatWeeklyWeekdaysLabel(weekdays: number[]) {
  const sorted = normalizeWeeklyWeekdays(weekdays);
  if (sorted.length === 0) return "";
  return `毎週${sorted.map((day) => WEEKDAY_LABELS[day]).join("・")}曜日`;
}
