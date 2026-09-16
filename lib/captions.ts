import type { Script, WordTimestamp } from "./types";
import { buildNarration } from "./elevenlabs";

const WORDS_PER_LINE = 5;
const WORDS_PER_SECOND = 2.4; // fallback pacing estimate
const GAP_SECONDS = 0.12; // small gap between estimated caption lines

interface CaptionLine {
  words: string[];
  start: number;
  end: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function formatSrtTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

function linesToSrt(lines: CaptionLine[]): string {
  return lines
    .map((line, i) => {
      const index = i + 1;
      const text = line.words.join(" ");
      return `${index}\n${formatSrtTime(line.start)} --> ${formatSrtTime(line.end)}\n${text}\n`;
    })
    .join("\n");
}

function buildFromTimestamps(words: string[], timestamps: WordTimestamp[]): CaptionLine[] {
  const groups = chunk(
    words.map((word, i) => ({ word, ts: timestamps[i] })),
    WORDS_PER_LINE
  );
  return groups.map((group) => ({
    words: group.map((g) => g.word),
    start: group[0].ts.start,
    end: group[group.length - 1].ts.end,
  }));
}

function buildFromEstimate(words: string[]): CaptionLine[] {
  const groups = chunk(words, WORDS_PER_LINE);
  let cursor = 0;
  return groups.map((group) => {
    const duration = group.length / WORDS_PER_SECOND;
    const start = cursor;
    const end = cursor + duration;
    cursor = end + GAP_SECONDS;
    return { words: group, start, end };
  });
}

export interface CaptionsResult {
  srt: string;
  source: "timestamps" | "estimated";
}

export function buildCaptions(
  script: Script,
  wordTimestamps: WordTimestamp[] | null
): CaptionsResult {
  const narration = buildNarration(script);
  const words = narration.split(/\s+/).filter(Boolean);

  // Only trust real timestamps if the alignment's word count lines up with our own
  // word split; a mismatch means ElevenLabs tokenized differently and mixing indices
  // would desync captions from audio, so fall back to the estimate instead.
  const useTimestamps = Boolean(wordTimestamps && wordTimestamps.length === words.length);

  const lines = useTimestamps
    ? buildFromTimestamps(words, wordTimestamps!)
    : buildFromEstimate(words);

  return {
    srt: linesToSrt(lines),
    source: useTimestamps ? "timestamps" : "estimated",
  };
}
