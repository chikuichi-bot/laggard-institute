import { promises as fs } from "fs";
import path from "path";

export type PhotoOrientation = "portrait" | "landscape" | "square";

export function orientationFromSize(
  width: number,
  height: number,
): PhotoOrientation {
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

export function readImageSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;

  // JPEG（iPhone の .png 拡張子でも中身は JPEG のことが多い）
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  return null;
}

export async function readImageSizeFromPublicUrl(
  publicUrl: string,
): Promise<{ width: number; height: number } | null> {
  const relative = publicUrl.replace(/^\//, "");
  const diskPath = path.join(process.cwd(), "public", relative);
  try {
    const buffer = await fs.readFile(diskPath);
    return readImageSize(buffer);
  } catch {
    return null;
  }
}

export async function orientationFromPublicUrl(
  publicUrl: string,
): Promise<PhotoOrientation | undefined> {
  const size = await readImageSizeFromPublicUrl(publicUrl);
  if (!size) return undefined;
  return orientationFromSize(size.width, size.height);
}
