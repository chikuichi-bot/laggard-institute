import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isItemCategory, isPhotoOnlyCategory } from "@/lib/category";
import {
  orientationFromSize,
  orientationFromPublicUrl,
  readImageSize,
} from "@/lib/image-meta";
import { makeItemId, readCatalog, writeCatalog } from "@/lib/items";
import {
  deleteItemUploadDir,
  deletePublicFile,
  nextImageFilename,
} from "@/lib/uploads";
import type { CatalogItem, ItemCategory } from "@/lib/types";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
}

async function verifyAdmin(form: FormData): Promise<NextResponse | null> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "サーバーに ADMIN_SECRET が設定されていません。" },
      { status: 500 },
    );
  }
  const secret = String(form.get("secret") ?? "");
  if (secret !== adminSecret) return unauthorized();
  return null;
}

function parseCategory(form: FormData): ItemCategory | NextResponse {
  const categoryRaw = String(form.get("category") ?? "");
  if (!isItemCategory(categoryRaw)) {
    return NextResponse.json({ error: "カテゴリが不正です。" }, { status: 400 });
  }
  return categoryRaw;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const authError = await verifyAdmin(form);
  if (authError) return authError;

  const category = parseCategory(form);
  if (category instanceof NextResponse) return category;

  const location = String(form.get("location") ?? "").trim() || undefined;
  let title = String(form.get("title") ?? "").trim();
  let description = String(form.get("description") ?? "").trim();

  if (isPhotoOnlyCategory(category)) {
    if (!location) {
      return NextResponse.json({ error: "場所は必須です。" }, { status: 400 });
    }
    title = location;
    description = "";
  } else if (!title || !description) {
    return NextResponse.json({ error: "タイトルと説明は必須です。" }, { status: 400 });
  }

  const imageFiles = form
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (imageFiles.length === 0) {
    return NextResponse.json({ error: "写真を1枚以上添付してください。" }, { status: 400 });
  }

  const id = makeItemId(title);
  const uploadDir = path.join(process.cwd(), "public", "uploads", category, id);
  await fs.mkdir(uploadDir, { recursive: true });

  const images: string[] = [];
  let orientation: CatalogItem["orientation"];
  for (const [index, file] of imageFiles.entries()) {
    const ext = path.extname(file.name) || ".jpg";
    const filename = `${index + 1}${ext.toLowerCase()}`;
    const diskPath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(diskPath, buffer);
    images.push(`/uploads/${category}/${id}/${filename}`);
    if (index === 0) {
      const size = readImageSize(buffer);
      if (size) orientation = orientationFromSize(size.width, size.height);
    }
  }

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
    ...(category === "antiques"
      ? {
          priceLabel,
          forSale,
          sold: false,
        }
      : {}),
  };

  const catalog = await readCatalog(category);
  catalog.push(item);
  await writeCatalog(category, catalog);

  return NextResponse.json({ id, category });
}

export async function PATCH(request: Request) {
  const form = await request.formData();
  const authError = await verifyAdmin(form);
  if (authError) return authError;

  const category = parseCategory(form);
  if (category instanceof NextResponse) return category;

  const id = String(form.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "ID が指定されていません。" }, { status: 400 });
  }

  const catalog = await readCatalog(category);
  const index = catalog.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "記録が見つかりません。" }, { status: 404 });
  }

  const item = { ...catalog[index] };
  const location = String(form.get("location") ?? "").trim() || undefined;
  let title = String(form.get("title") ?? "").trim();
  let description = String(form.get("description") ?? "").trim();

  if (isPhotoOnlyCategory(category)) {
    if (!location) {
      return NextResponse.json({ error: "場所は必須です。" }, { status: 400 });
    }
    title = location;
    description = "";
  } else if (!title || !description) {
    return NextResponse.json({ error: "タイトルと説明は必須です。" }, { status: 400 });
  }

  item.title = title;
  item.description = description;
  item.location = location;
  item.foundAt = String(form.get("foundAt") ?? "").trim() || undefined;

  if (category === "antiques") {
    item.priceLabel = String(form.get("priceLabel") ?? "").trim() || undefined;
    item.forSale = String(form.get("forSale") ?? "") === "true";
    item.sold = String(form.get("sold") ?? "") === "true";
  }

  const removeImages = form.getAll("removeImages").map(String).filter(Boolean);
  if (removeImages.length > 0) {
    for (const url of removeImages) {
      if (item.images.includes(url)) {
        await deletePublicFile(url);
      }
    }
    item.images = item.images.filter((url) => !removeImages.includes(url));
  }

  const imageFiles = form
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (imageFiles.length > 0) {
    const uploadDir = path.join(process.cwd(), "public", "uploads", category, id);
    await fs.mkdir(uploadDir, { recursive: true });

    for (const file of imageFiles) {
      const filename = nextImageFilename(item.images, file.name);
      const diskPath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(diskPath, buffer);
      item.images.push(`/uploads/${category}/${id}/${filename}`);
    }
  }

  if (item.images[0]) {
    item.orientation = await orientationFromPublicUrl(item.images[0]);
  } else {
    delete item.orientation;
  }

  catalog[index] = item;
  await writeCatalog(category, catalog);

  return NextResponse.json({ id, category });
}

export async function DELETE(request: Request) {
  const form = await request.formData();
  const authError = await verifyAdmin(form);
  if (authError) return authError;

  const category = parseCategory(form);
  if (category instanceof NextResponse) return category;

  const id = String(form.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "ID が指定されていません。" }, { status: 400 });
  }

  const catalog = await readCatalog(category);
  const index = catalog.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "記録が見つかりません。" }, { status: 404 });
  }

  catalog.splice(index, 1);
  await writeCatalog(category, catalog);
  await deleteItemUploadDir(category, id);

  return NextResponse.json({ id, category });
}
