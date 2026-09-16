import path from "node:path";
import fs from "node:fs";

export const MEDIA_ROOT = path.join(process.cwd(), "media");

export function projectMediaDir(projectId: string): string {
  return path.join(MEDIA_ROOT, projectId);
}

export function projectClipsDir(projectId: string): string {
  return path.join(projectMediaDir(projectId), "clips");
}

export function ensureProjectDirs(projectId: string): void {
  fs.mkdirSync(projectClipsDir(projectId), { recursive: true });
}

export function voiceoverPath(projectId: string): string {
  return path.join(projectMediaDir(projectId), "voiceover.mp3");
}

export function captionsPath(projectId: string): string {
  return path.join(projectMediaDir(projectId), "captions.srt");
}

export function referenceImagePath(projectId: string): string {
  return path.join(projectMediaDir(projectId), "reference.png");
}

export function beatClipPath(projectId: string, idx: number): string {
  return path.join(projectClipsDir(projectId), `beat-${idx}.mp4`);
}

export function finalVideoPath(projectId: string): string {
  return path.join(projectMediaDir(projectId), "final.mp4");
}

// Path served to the browser via the /media/[...path] route, relative to MEDIA_ROOT.
export function toMediaUrl(absolutePath: string): string {
  const rel = path.relative(MEDIA_ROOT, absolutePath).split(path.sep).join("/");
  return `/media-files/${rel}`;
}
