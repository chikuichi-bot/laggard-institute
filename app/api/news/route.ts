import { NextResponse } from "next/server";
import { makeNewsId, readNews, writeNews } from "@/lib/news";
import type { NewsItem } from "@/lib/news-types";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
}

function parseItems(raw: unknown): NewsItem[] | NextResponse {
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "項目の形式が不正です。" }, { status: 400 });
  }

  const items: NewsItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return NextResponse.json({ error: "項目の形式が不正です。" }, { status: 400 });
    }

    const record = entry as Record<string, unknown>;
    const title = String(record.title ?? "").trim();
    const body = String(record.body ?? "").trim();
    if (!title || !body) {
      return NextResponse.json(
        { error: "各ニュースにはタイトルと本文が必要です。" },
        { status: 400 },
      );
    }

    const hrefRaw = String(record.href ?? "").trim();
    const href = hrefRaw || undefined;
    const createdAtRaw = String(record.createdAt ?? "").trim();
    const createdAt = createdAtRaw || new Date().toISOString();
    const idRaw = String(record.id ?? "").trim();
    const id = idRaw || makeNewsId(title);

    items.push({ id, title, body, href, createdAt });
  }

  return items;
}

export async function GET() {
  const data = await readNews();
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

  let body: { secret?: string; items?: unknown };
  try {
    body = (await request.json()) as { secret?: string; items?: unknown };
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  if (String(body.secret ?? "") !== adminSecret) return unauthorized();

  const items = parseItems(body.items);
  if (items instanceof NextResponse) return items;

  const data = {
    updatedAt: new Date().toISOString(),
    items,
  };
  await writeNews(data);

  return NextResponse.json(data);
}
