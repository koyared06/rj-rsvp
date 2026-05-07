import path from "node:path";
import { promises as fs } from "node:fs";

export type MusicTrack = {
  id: string;
  title: string;
  fileName: string;
  streamUrl: string;
  isFeatured: boolean;
};

const MUSIC_ROOT = path.resolve(process.cwd(), "BALANAY FAM", "music");
const SUPPORTED_EXTENSIONS = new Set([".mp3"]);

function normalizeTrackTitle(fileName: string) {
  const ext = path.extname(fileName);
  const baseName = fileName.slice(0, Math.max(0, fileName.length - ext.length));
  return baseName.replace(/^\d+\.\s*/, "").trim();
}

function isAllowedFile(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export async function readMusicPlaylist(): Promise<MusicTrack[]> {
  const entries = await fs.readdir(MUSIC_ROOT, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && isAllowedFile(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  return files.map((fileName, index) => {
    const encodedFileName = encodeURIComponent(fileName);
    return {
      id: `track-${index + 1}`,
      title: normalizeTrackTitle(fileName),
      fileName,
      streamUrl: `/api/music/stream?file=${encodedFileName}`,
      isFeatured: index === 0,
    };
  });
}

export function getMusicRootPath() {
  return MUSIC_ROOT;
}

export function resolveTrackPath(fileNameParam: string) {
  const trimmed = fileNameParam.trim();
  if (!trimmed || path.basename(trimmed) !== trimmed || !isAllowedFile(trimmed)) {
    return null;
  }

  const rootPath = getMusicRootPath();
  const targetPath = path.resolve(rootPath, trimmed);

  if (targetPath !== rootPath && !targetPath.startsWith(`${rootPath}${path.sep}`)) {
    return null;
  }

  return targetPath;
}
