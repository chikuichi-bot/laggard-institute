import sharp from "sharp";

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 88;

/**
 * 長辺が MAX_DIMENSION を超える場合は縮小し、JPEG で返す。
 * すでに収まっている場合もフォーマットを JPEG に統一する。
 * EXIF の回転情報は自動適用（sharp のデフォルト）。
 */
export async function resizeForUpload(
  input: Buffer,
): Promise<{ buffer: Buffer; ext: string }> {
  let pipeline = sharp(input).rotate();

  const meta = await pipeline.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const buffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  return { buffer, ext: ".jpg" };
}
