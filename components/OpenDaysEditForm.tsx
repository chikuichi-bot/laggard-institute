"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadAdminSecret, saveAdminSecret } from "@/lib/admin-auth";
import type { OpenDaysData } from "@/lib/open-days-types";
import {
  isValidDateKey,
  normalizeWeeklyWeekdays,
  sortOpenDays,
  WEEKDAY_LABELS,
} from "@/lib/open-days-types";

type OpenDaysEditFormProps = {
  initialData: OpenDaysData;
};

type DateListKind = "extraDays" | "closedDays";

function todayDateInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function DateListEditor({
  title,
  days,
  newDay,
  onNewDayChange,
  onAdd,
  onRemove,
  emptyMessage,
}: {
  title: string;
  days: string[];
  newDay: string;
  onNewDayChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  emptyMessage: string;
}) {
  return (
    <article className="content-card content-card--flat admin-form-card">
      <h2 className="admin-section-title">{title}</h2>
      <div className="open-days-edit-add">
        <label className="form-field">
          <span>日付を追加</span>
          <input type="date" value={newDay} onChange={(e) => onNewDayChange(e.target.value)} />
        </label>
        <button type="button" className="action-btn" onClick={onAdd}>
          追加
        </button>
      </div>

      {days.length === 0 ? (
        <p className="form-message">{emptyMessage}</p>
      ) : (
        <ul className="open-days-edit-list">
          {days.map((day) => (
            <li key={day} className="open-days-edit-item">
              <span>{day}</span>
              <button
                type="button"
                className="action-btn action-btn--danger action-btn--small"
                onClick={() => onRemove(day)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function OpenDaysEditForm({ initialData }: OpenDaysEditFormProps) {
  const router = useRouter();
  const [hoursLabel, setHoursLabel] = useState(initialData.hoursLabel);
  const [note, setNote] = useState(initialData.note);
  const [weeklyWeekdays, setWeeklyWeekdays] = useState(initialData.weeklyWeekdays);
  const [extraDays, setExtraDays] = useState(initialData.extraDays);
  const [closedDays, setClosedDays] = useState(initialData.closedDays);
  const [newExtraDay, setNewExtraDay] = useState(todayDateInput());
  const [newClosedDay, setNewClosedDay] = useState(todayDateInput());
  const [secret, setSecret] = useState("");
  const [rememberSecret, setRememberSecret] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const sortedExtraDays = useMemo(() => sortOpenDays(extraDays), [extraDays]);
  const sortedClosedDays = useMemo(() => sortOpenDays(closedDays), [closedDays]);

  useEffect(() => {
    setSecret(loadAdminSecret());
  }, []);

  function toggleWeekday(day: number) {
    setWeeklyWeekdays((current) =>
      normalizeWeeklyWeekdays(
        current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
      ),
    );
  }

  function addDate(kind: DateListKind) {
    const value = (kind === "extraDays" ? newExtraDay : newClosedDay).trim();
    if (!isValidDateKey(value)) {
      setStatus("error");
      setMessage("日付は YYYY-MM-DD の形式で入力してください。");
      return;
    }

    if (kind === "extraDays") {
      setExtraDays((current) => sortOpenDays([...new Set([...current, value])]));
    } else {
      setClosedDays((current) => sortOpenDays([...new Set([...current, value])]));
    }

    setStatus("idle");
    setMessage("");
  }

  function removeDate(kind: DateListKind, value: string) {
    if (kind === "extraDays") {
      setExtraDays((current) => current.filter((day) => day !== value));
    } else {
      setClosedDays((current) => current.filter((day) => day !== value));
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (weeklyWeekdays.length === 0) {
      setStatus("error");
      setMessage("営業曜日を1つ以上選んでください。");
      return;
    }

    if (rememberSecret && secret) {
      saveAdminSecret(secret);
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/open-days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          hoursLabel: hoursLabel.trim(),
          note: note.trim(),
          weeklyWeekdays,
          extraDays: sortedExtraDays,
          closedDays: sortedClosedDays,
        }),
      });
      const data = (await response.json()) as OpenDaysData & { error?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "保存に失敗しました。");
        return;
      }

      setHoursLabel(data.hoursLabel);
      setNote(data.note);
      setWeeklyWeekdays(data.weeklyWeekdays);
      setExtraDays(data.extraDays);
      setClosedDays(data.closedDays);
      setStatus("done");
      setMessage("保存しました。");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。");
    }
  }

  return (
    <form className="add-form" onSubmit={onSubmit}>
      <div className="admin-action-bar action-bar">
        <button
          type="submit"
          className="action-btn action-btn--primary action-btn--large"
          disabled={status === "loading"}
        >
          {status === "loading" ? "保存中…" : "保存する"}
        </button>
      </div>

      <article className="content-card content-card--flat admin-form-card">
        <div className="add-form-fields">
          <fieldset className="open-days-weekdays">
            <legend className="form-label">毎週の営業曜日</legend>
            <div className="open-days-weekday-list">
              {WEEKDAY_LABELS.map((label, index) => (
                <label key={label} className="form-checkbox open-days-weekday-item">
                  <input
                    type="checkbox"
                    checked={weeklyWeekdays.includes(index)}
                    onChange={() => toggleWeekday(index)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="form-field">
            <span>営業時間の表示</span>
            <input
              type="text"
              value={hoursLabel}
              onChange={(e) => setHoursLabel(e.target.value)}
              placeholder="10:00–17:00"
            />
          </label>

          <label className="form-field">
            <span>補足</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="基本的に毎週土曜日が営業日です。"
            />
          </label>
        </div>
      </article>

      <DateListEditor
        title="臨時営業日"
        days={sortedExtraDays}
        newDay={newExtraDay}
        onNewDayChange={setNewExtraDay}
        onAdd={() => addDate("extraDays")}
        onRemove={(day) => removeDate("extraDays", day)}
        emptyMessage="臨時営業日はありません。"
      />

      <DateListEditor
        title="臨時休業日"
        days={sortedClosedDays}
        newDay={newClosedDay}
        onNewDayChange={setNewClosedDay}
        onAdd={() => addDate("closedDays")}
        onRemove={(day) => removeDate("closedDays", day)}
        emptyMessage="臨時休業日はありません。"
      />

      <label className="form-field">
        <span>管理パスワード</span>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={rememberSecret}
          onChange={(e) => setRememberSecret(e.target.checked)}
        />
        パスワードをこの端末に記憶する
      </label>

      {message ? (
        <p className={`form-message${status === "error" ? " form-message--error" : ""}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
