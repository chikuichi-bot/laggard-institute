import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";

export function publicUrlToDiskPath(publicUrl: string): string {
  return path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
}

export function publicFileExists(publicUrl: string): boolean {
  try {
    return fs.existsSync(publicUrlToDiskPath(publicUrl));
  } catch {
    return false;
  }
}

export async function deletePublicFile(publicUrl: string) {
  try {
    await fsPromises.unlink(publicUrlToDiskPath(publicUrl));
  } catch {
    // already removed
  }
}

export async function deleteItemUploadDir(category: string, id: string) {
  const uploadDir = path.join(process.cwd(), "public", "uploads", category, id);
  try {
    await fsPromises.rm(uploadDir, { recursive: true, force: true });
  } catch {
    // already removed
  }
}

export function nextImageFilename(existingImages: string[], originalName: string): string {
  const ext = path.extname(originalName) || ".jpg";
  let maxIndex = 0;
  for (const url of existingImages) {
    const match = path.basename(url).match(/^(\d+)\./);
    if (match) maxIndex = Math.max(maxIndex, Number(match[1]));
  }
  return `${maxIndex + 1}${ext.toLowerCase()}`;
}
