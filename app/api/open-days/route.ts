import { NextResponse } from "next/server";
import {
  isValidDateKey,
  normalizeClosedDays,
  normalizeWeeklyWeekdays,
  sortOpenDays,
} from "@/lib/open-days-types";
import { readOpenDays, writeOpenDays } from "@/lib/open-days";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
}

function parseDateList(raw: unknown, label: string) {
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: `${label}の形式が不正です。` }, { status: 400 });
  }

  return sortOpenDays(
    raw
      .map((value) => String(value ?? "").trim())
      .filter(isValidDateKey),
  );
}

function parseClosedDays(raw: unknown) {
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "臨時休業日の形式が不正です。" }, { status: 400 });
  }
  return normalizeClosedDays(raw);
}

function parseBody(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const record = raw as Record<string, unknown>;
  const hoursLabel = String(record.hoursLabel ?? "").trim();
  const note = String(record.note ?? "").trim();

  if (!Array.isArray(record.weeklyWeekdays)) {
    return NextResponse.json({ error: "営業曜日の形式が不正です。" }, { status: 400 });
  }

  const weeklyWeekdays = normalizeWeeklyWeekdays(record.weeklyWeekdays as number[]);
  const extraDays = parseDateList(record.extraDays, "臨時営業日");
  if (extraDays instanceof NextResponse) return extraDays;

  const closedDays = parseClosedDays(record.closedDays);
  if (closedDays instanceof NextResponse) return closedDays;

  return { hoursLabel, note, weeklyWeekdays, extraDays, closedDays };
}

export async function GET() {
  const data = await readOpenDays();
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "サーバーに ADMIN_SECRET が設定されていません。" },
      { status: 500 },
    );
  }

  let body: {
    secret?: string;
    hoursLabel?: string;
    note?: string;
    weeklyWeekdays?: unknown;
    extraDays?: unknown;
    closedDays?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  if (String(body.secret ?? "") !== adminSecret) return unauthorized();

  const parsed = parseBody({
    hoursLabel: body.hoursLabel,
    note: body.note,
    weeklyWeekdays: body.weeklyWeekdays,
    extraDays: body.extraDays,
    closedDays: body.closedDays,
  });
  if (parsed instanceof NextResponse) return parsed;

  const data = await writeOpenDays(parsed);
  return NextResponse.json(data);
}
