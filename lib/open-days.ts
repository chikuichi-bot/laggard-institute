import { promises as fs } from "fs";
import path from "path";
import type { OpenDaysData } from "./open-days-types";
import {
  isValidDateKey,
  normalizeWeeklyWeekdays,
  sortOpenDays,
} from "./open-days-types";

export type { OpenDaysData } from "./open-days-types";
export {
  formatCalendarMonthLabel,
  formatOpenDayLabel,
  formatWeeklyWeekdaysLabel,
  isOpenDay,
  isValidDateKey,
  listUpcomingOpenDays,
  sortOpenDays,
  WEEKDAY_LABELS,
} from "./open-days-types";

const OPEN_DAYS_PATH = path.join(process.cwd(), "data", "open-days.json");

const EMPTY_OPEN_DAYS: OpenDaysData = {
  updatedAt: new Date(0).toISOString(),
  hoursLabel: "13:00–19:00",
  note: "気になったものがあったらお気軽にご連絡してください。土曜日以外でも対応可能です。",
  weeklyWeekdays: [6],
  extraDays: [],
  closedDays: [],
};

function normalizeDateList(days: string[] | undefined) {
  return sortOpenDays((days ?? []).filter(isValidDateKey));
}

function migrateLegacyData(raw: Record<string, unknown>): OpenDaysData {
  const legacyDays = normalizeDateList(
    Array.isArray(raw.days) ? (raw.days as string[]) : undefined,
  );

  return {
    updatedAt: String(raw.updatedAt ?? new Date(0).toISOString()),
    hoursLabel: String(raw.hoursLabel ?? EMPTY_OPEN_DAYS.hoursLabel),
    note: String(raw.note ?? EMPTY_OPEN_DAYS.note),
    weeklyWeekdays: Array.isArray(raw.weeklyWeekdays)
      ? normalizeWeeklyWeekdays(raw.weeklyWeekdays as number[])
      : legacyDays.length > 0
        ? []
        : [6],
    extraDays: Array.isArray(raw.extraDays)
      ? normalizeDateList(raw.extraDays as string[])
      : legacyDays,
    closedDays: Array.isArray(raw.closedDays)
      ? normalizeDateList(raw.closedDays as string[])
      : [],
  };
}

export async function readOpenDays(): Promise<OpenDaysData> {
  try {
    const raw = await fs.readFile(OPEN_DAYS_PATH, "utf8");
    return migrateLegacyData(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return { ...EMPTY_OPEN_DAYS };
  }
}

export async function writeOpenDays(data: Omit<OpenDaysData, "updatedAt">) {
  await fs.mkdir(path.dirname(OPEN_DAYS_PATH), { recursive: true });
  const normalized: OpenDaysData = {
    hoursLabel: data.hoursLabel.trim(),
    note: data.note.trim(),
    weeklyWeekdays: normalizeWeeklyWeekdays(data.weeklyWeekdays),
    extraDays: normalizeDateList(data.extraDays),
    closedDays: normalizeDateList(data.closedDays),
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(OPEN_DAYS_PATH, JSON.stringify(normalized, null, 2) + "\n", "utf8");
  return normalized;
}
