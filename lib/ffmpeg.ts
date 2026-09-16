import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

export interface FfmpegAvailability {
  ffmpeg: boolean;
  ffprobe: boolean;
  installInstructions: string;
}

function installInstructionsForOs(): string {
  const platform = os.platform();
  if (platform === "darwin") {
    return "Install ffmpeg on macOS with Homebrew: brew install ffmpeg";
  }
  if (platform === "linux") {
    return "Install ffmpeg on Linux: sudo apt-get update && sudo apt-get install -y ffmpeg (Debian/Ubuntu), or sudo dnf install -y ffmpeg (Fedora), or your distro's package manager.";
  }
  if (platform === "win32") {
    return "Install ffmpeg on Windows: winget install Gyan.FFmpeg (or download from https://ffmpeg.org/download.html and add it to your PATH), then restart your terminal.";
  }
  return "Install ffmpeg for your OS: https://ffmpeg.org/download.html";
}

async function binaryAvailable(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

export async function checkFfmpeg(): Promise<FfmpegAvailability> {
  const [ffmpeg, ffprobe] = await Promise.all([
    binaryAvailable("ffmpeg"),
    binaryAvailable("ffprobe"),
  ]);
  return { ffmpeg, ffprobe, installInstructions: installInstructionsForOs() };
}

async function getMediaDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  const duration = parseFloat(parsed.format?.duration ?? "0");
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not determine duration of ${filePath}`);
  }
  return duration;
}

// libass (the subtitles filter) needs colons and backslashes in the path escaped, and the
// whole path wrapped so ffmpeg's own filtergraph parser doesn't choke on Windows drive letters.
function escapeForSubtitlesFilter(filePath: string): string {
  const normalized = filePath.split(path.sep).join("/");
  return normalized.replace(/:/g, "\\:").replace(/'/g, "\\'");
}

// Without an explicit PlayRes, libass falls back to a small default script canvas (384x288)
// and scales font size/margins from that — on our fixed 1080x1920 output this put captions
// far above the bottom third. Pinning PlayResX/PlayResY to the real output size lets
// FontSize/MarginV below be specified in actual output pixels.
const CAPTION_STYLE = [
  "PlayResX=1080",
  "PlayResY=1920",
  "FontName=Arial",
  "FontSize=64",
  "PrimaryColour=&H00FFFFFF",
  "OutlineColour=&H00000000",
  "BorderStyle=1",
  "Outline=4",
  "Shadow=2",
  "Bold=1",
  "Alignment=2",
  "MarginV=220",
].join(",");

export interface AssembleOptions {
  clipPaths: string[]; // in beat order
  voiceoverPath: string;
  captionsPath: string;
  outputPath: string;
  tmpDir: string;
}

export async function assembleVideo(opts: AssembleOptions): Promise<void> {
  const { clipPaths, voiceoverPath, captionsPath, outputPath, tmpDir } = opts;
  if (clipPaths.length === 0) throw new Error("No beat clips to assemble.");

  fs.mkdirSync(tmpDir, { recursive: true });
  const concatPath = path.join(tmpDir, "concat.mp4");

  // Pass 1: normalize every clip to the same vertical 9:16 canvas/framerate and concat them.
  const normFilters = clipPaths
    .map(
      (_, i) =>
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[v${i}]`
    )
    .join(";");
  const concatInputs = clipPaths.map((_, i) => `[v${i}]`).join("");
  const concatFilter = `${normFilters};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[vout]`;

  await execFileAsync("ffmpeg", [
    "-y",
    ...clipPaths.flatMap((p) => ["-i", p]),
    "-filter_complex",
    concatFilter,
    "-map",
    "[vout]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    concatPath,
  ]);

  const [videoDuration, audioDuration] = await Promise.all([
    getMediaDuration(concatPath),
    getMediaDuration(voiceoverPath),
  ]);

  // Conform video length to the voiceover's length: freeze the last frame to pad a short
  // video, or trim a long one, so narration and picture end together.
  let conformFilter: string;
  if (videoDuration < audioDuration - 0.05) {
    const padSeconds = audioDuration - videoDuration;
    conformFilter = `tpad=stop_mode=clone:stop_duration=${padSeconds.toFixed(3)}`;
  } else {
    conformFilter = `trim=end=${audioDuration.toFixed(3)},setpts=PTS-STARTPTS`;
  }

  const subtitlesFilter = `subtitles='${escapeForSubtitlesFilter(captionsPath)}':force_style='${CAPTION_STYLE}'`;
  const finalFilter = `[0:v]${conformFilter}[padded];[padded]${subtitlesFilter}[vout]`;

  // Pass 2: conform duration, burn in captions, and mux with the voiceover audio.
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    concatPath,
    "-i",
    voiceoverPath,
    "-filter_complex",
    finalFilter,
    "-map",
    "[vout]",
    "-map",
    "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    audioDuration.toFixed(3),
    outputPath,
  ]);
}
