/** Lolipop サブディレクトリ（build:lolipop 時は /lagado2026） */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** トップをドメイン直下 index.html に置くときは / */
export const HOME_HREF =
  process.env.NEXT_PUBLIC_HOME_AT_ROOT === "1"
    ? "/"
    : BASE_PATH
      ? `${BASE_PATH}/`
      : "/";

/** public 配下の画像・動画パスに basePath を付ける */
export function assetUrl(path: string | undefined | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (BASE_PATH && path.startsWith(BASE_PATH)) return path;
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
