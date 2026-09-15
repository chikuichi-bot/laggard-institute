"use client";

import { useMemo, useState } from "react";
import type { OpenDaysData } from "@/lib/open-days-types";
import {
  closedDayDateKeys,
  dateKeyFromParts,
  formatCalendarMonthLabel,
  formatClosedDayLabel,
  formatOpenDayLabel,
  formatWeeklyWeekdaysLabel,
  isOpenDay,
  listUpcomingClosedDays,
  listUpcomingOpenDays,
  WEEKDAY_LABELS,
} from "@/lib/open-days-types";

const WEEKDAYS = [...WEEKDAY_LABELS];

type BusinessCalendarProps = Pick<
  OpenDaysData,
  "weeklyWeekdays" | "extraDays" | "closedDays" | "hoursLabel" | "note"
>;

function todayKey() {
  const now = new Date();
  return dateKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate());
}

function buildMonthCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; dateKey?: string }> = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, dateKey: dateKeyFromParts(year, month, day) });
  }

  return cells;
}

export default function BusinessCalendar({
  weeklyWeekdays,
  extraDays,
  closedDays,
  hoursLabel,
  note,
}: BusinessCalendarProps) {
  const schedule = useMemo(
    () => ({ weeklyWeekdays, extraDays, closedDays }),
    [weeklyWeekdays, extraDays, closedDays],
  );
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const today = todayKey();
  const weeklyLabel = formatWeeklyWeekdaysLabel(weeklyWeekdays);
  const upcoming = listUpcomingOpenDays(schedule, today, 6);
  const upcomingClosed = listUpcomingClosedDays(schedule, today, 6);
  const closedDateSet = useMemo(() => new Set(closedDayDateKeys(closedDays)), [closedDays]);

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <div className="business-calendar">
      <div className="business-calendar-meta">
        {weeklyLabel ? <p className="business-calendar-schedule">{weeklyLabel}</p> : null}
        {hoursLabel ? <p className="business-calendar-hours">営業時間 {hoursLabel}</p> : null}
        {note ? <p className="business-calendar-note">{note}</p> : null}
      </div>

      <div className="business-calendar-panel">
        <div className="business-calendar-nav">
          <button
            type="button"
            className="business-calendar-nav-btn"
            onClick={() => shiftMonth(-1)}
            aria-label="前の月"
          >
            ←
          </button>
          <h2 className="business-calendar-month">{formatCalendarMonthLabel(viewYear, viewMonth)}</h2>
          <button
            type="button"
            className="business-calendar-nav-btn"
            onClick={() => shiftMonth(1)}
            aria-label="次の月"
          >
            →
          </button>
        </div>

        <div className="business-calendar-grid" role="grid" aria-label="営業日カレンダー">
          {WEEKDAYS.map((label) => (
            <div key={label} className="business-calendar-weekday" role="columnheader">
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell.day || !cell.dateKey) {
              return (
                <div
                  key={`empty-${index}`}
                  className="business-calendar-cell business-calendar-cell--empty"
                  aria-hidden
                />
              );
            }

            const open = isOpenDay(schedule, cell.dateKey);
            const closed = closedDateSet.has(cell.dateKey);
            const isToday = cell.dateKey === today;

            return (
              <div
                key={cell.dateKey}
                className={`business-calendar-cell${open ? " business-calendar-cell--open" : ""}${closed ? " business-calendar-cell--closed" : ""}${isToday ? " business-calendar-cell--today" : ""}`}
                role="gridcell"
                aria-label={`${cell.day}日${closed ? " お休み" : open ? " 営業" : ""}`}
              >
                <span className="business-calendar-day">{cell.day}</span>
              </div>
            );
          })}
        </div>

        <p className="business-calendar-legend">
          <span className="business-calendar-legend-mark" aria-hidden />
          営業日
          <span className="business-calendar-legend-mark business-calendar-legend-mark--closed" aria-hidden />
          お休み
        </p>
      </div>

      {upcomingClosed.length > 0 ? (
        <section className="business-calendar-upcoming" aria-labelledby="upcoming-closed-days">
          <h3 id="upcoming-closed-days" className="business-calendar-upcoming-title">
            お休みの日
          </h3>
          <ul className="business-calendar-upcoming-list business-calendar-upcoming-list--closed">
            {upcomingClosed.map((entry) => (
              <li key={entry.date}>{formatClosedDayLabel(entry)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="business-calendar-upcoming" aria-labelledby="upcoming-open-days">
          <h3 id="upcoming-open-days" className="business-calendar-upcoming-title">
            このあとの営業日
          </h3>
          <ul className="business-calendar-upcoming-list">
            {upcoming.map((day) => (
              <li key={day}>{formatOpenDayLabel(day)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
