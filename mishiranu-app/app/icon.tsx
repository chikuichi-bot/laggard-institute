import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** トップ採用の抽象地図（道網）アイコン */
export default async function Icon() {
  const data = await readFile(
    join(process.cwd(), "public/icons/icon-512.png"),
  );
  return new Response(data, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=0" },
  });
}
