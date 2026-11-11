import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS ホーム画面用。抽象地図（道網） */
export default async function AppleIcon() {
  const data = await readFile(
    join(process.cwd(), "public/icons/apple-touch-icon.png"),
  );
  return new Response(data, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=0" },
  });
}
