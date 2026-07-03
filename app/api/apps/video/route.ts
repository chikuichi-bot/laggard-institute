import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { OMIKUJI_APP_VIDEO_BASE } from "@/lib/app-media";
import { publicUrlToDiskPath } from "@/lib/uploads";

export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

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

export async function GET() {
  const videosDir = path.join(process.cwd(), "public", "videos");
  let filename: string | null = null;
  try {
    const entries = await fs.readdir(videosDir);
    filename =
      entries.find((entry) => entry.startsWith(`${OMIKUJI_APP_VIDEO_BASE}.`)) ??
      null;
  } catch {
    filename = null;
  }

  return NextResponse.json({
    uploaded: Boolean(filename),
    filename,
    poster: "/videos/omikuji-bunko-poster.jpg",
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const authError = await verifyAdmin(form);
  if (authError) return authError;

  const file = form.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "動画ファイルを選んでください。" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase() || ".mp4";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "mp4 / mov / m4v / webm の動画に対応しています。" },
      { status: 400 },
    );
  }

  const videosDir = path.join(process.cwd(), "public", "videos");
  await fs.mkdir(videosDir, { recursive: true });

  for (const allowedExt of ALLOWED_EXTENSIONS) {
    const oldPath = path.join(videosDir, `${OMIKUJI_APP_VIDEO_BASE}${allowedExt}`);
    try {
      await fs.unlink(oldPath);
    } catch {
      // already removed
    }
  }

  const filename = `${OMIKUJI_APP_VIDEO_BASE}${ext}`;
  const diskPath = publicUrlToDiskPath(`/videos/${filename}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(diskPath, buffer);

  return NextResponse.json({
    ok: true,
    filename,
    src: `/videos/${filename}`,
  });
}
