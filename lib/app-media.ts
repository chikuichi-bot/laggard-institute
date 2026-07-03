import { publicFileExists } from "@/lib/uploads";
import { assetUrl } from "@/lib/asset-path";

export const OMIKUJI_APP_VIDEO_BASE = "omikuji-bunko";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"] as const;

export function appVideoSrc(base: string): string | null {
  for (const ext of VIDEO_EXTENSIONS) {
    const src = `/videos/${base}${ext}`;
    if (publicFileExists(src)) return assetUrl(src);
  }
  return null;
}

export function appVideoDiskBasename(base: string): string | null {
  for (const ext of VIDEO_EXTENSIONS) {
    const src = `/videos/${base}${ext}`;
    if (publicFileExists(src)) return `${base}${ext}`;
  }
  return null;
}
