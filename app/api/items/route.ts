import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { makeItemId, readCatalog, writeCatalog } from "@/lib/items";
import { orientationFromSize, readImageSize } from "@/lib/image-meta";
import type { CatalogItem, ItemCategory } from "@/lib/types";

export const runtime = "nodejs";

function isCategory(value: string): value is ItemCategory {
  return value === "antiques" || value === "city" || value === "sea";
}

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "サーバーに ADMIN_SECRET が設定されていません。" },
      { status: 500 },
    );
  }

  const form = await request.formData();
  const secret = String(form.get("secret") ?? "");
  if (secret !== adminSecret) {
    return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
  }

  const categoryRaw = String(form.get("category") ?? "");
  if (!isCategory(categoryRaw)) {
    return NextResponse.json({ error: "カテゴリが不正です。" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  if (!title || !description) {
    return NextResponse.json({ error: "タイトルと説明は必須です。" }, { status: 400 });
  }

  const imageFiles = form
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (imageFiles.length === 0) {
    return NextResponse.json({ error: "写真を1枚以上添付してください。" }, { status: 400 });
  }

  const id = makeItemId(title);
  const uploadDir = path.join(process.cwd(), "public", "uploads", categoryRaw, id);
  await fs.mkdir(uploadDir, { recursive: true });

  const images: string[] = [];
  let orientation: CatalogItem["orientation"];
  for (const [index, file] of imageFiles.entries()) {
    const ext = path.extname(file.name) || ".jpg";
    const filename = `${index + 1}${ext.toLowerCase()}`;
    const diskPath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(diskPath, buffer);
    images.push(`/uploads/${categoryRaw}/${id}/${filename}`);
    if (index === 0) {
      const size = readImageSize(buffer);
      if (size) orientation = orientationFromSize(size.width, size.height);
    }
  }

  const location = String(form.get("location") ?? "").trim() || undefined;
  const foundAt = String(form.get("foundAt") ?? "").trim() || undefined;
  const priceLabel = String(form.get("priceLabel") ?? "").trim() || undefined;
  const forSale = String(form.get("forSale") ?? "") === "true";

  const item: CatalogItem = {
    id,
    title,
    description,
    location,
    foundAt,
    images,
    createdAt: new Date().toISOString(),
    orientation,
    ...(categoryRaw === "antiques"
      ? {
          priceLabel,
          forSale,
          sold: false,
        }
      : {}),
  };

  const catalog = await readCatalog(categoryRaw);
  catalog.push(item);
  await writeCatalog(categoryRaw, catalog);

  return NextResponse.json({ id, category: categoryRaw });
}
