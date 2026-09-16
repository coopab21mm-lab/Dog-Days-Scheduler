import { requireEnv } from "./env";
import type { Script, WordTimestamp } from "./types";

const API_BASE = "https://api.elevenlabs.io/v1";

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsTimestampsResponse {
  audio_base64: string;
  alignment: ElevenLabsAlignment | null;
  normalized_alignment: ElevenLabsAlignment | null;
}

export interface TtsResult {
  audioBuffer: Buffer;
  wordTimestamps: WordTimestamp[] | null;
}

// Joins hook + beat narration + close line into one narration string with natural pauses
// between beats, matching the "join with natural pauses" instruction from the spec.
export function buildNarration(script: Script): string {
  const parts = [script.hook, ...script.beats.map((b) => b.text), script.closeLine];
  return parts.join("\n\n");
}

function charAlignmentToWords(alignment: ElevenLabsAlignment): WordTimestamp[] {
  const words: WordTimestamp[] = [];
  let current: { chars: string[]; start: number; end: number } | null = null;

  for (let i = 0; i < alignment.characters.length; i++) {
    const ch = alignment.characters[i];
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];
    const isWhitespace = /^\s*$/.test(ch);

    if (isWhitespace) {
      if (current) {
        words.push({ word: current.chars.join(""), start: current.start, end: current.end });
        current = null;
      }
      continue;
    }

    if (!current) {
      current = { chars: [ch], start, end };
    } else {
      current.chars.push(ch);
      current.end = end;
    }
  }
  if (current) {
    words.push({ word: current.chars.join(""), start: current.start, end: current.end });
  }
  return words;
}

export async function textToSpeech(
  text: string,
  voiceId: string
): Promise<TtsResult> {
  const apiKey = requireEnv("ELEVENLABS_API_KEY", "ElevenLabs (voiceover)");

  // Prefer the timestamps-enabled endpoint: it returns real per-character alignment
  // alongside the audio, which we convert to word-level timestamps for accurate captions.
  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as ElevenLabsTimestampsResponse;
    const audioBuffer = Buffer.from(data.audio_base64, "base64");
    const wordTimestamps = data.alignment ? charAlignmentToWords(data.alignment) : null;
    return { audioBuffer, wordTimestamps };
  }

  // Fall back to the plain (non-timestamped) endpoint if the timestamps variant is
  // unavailable for this account/voice/model combination.
  const fallbackRes = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!fallbackRes.ok) {
    const body = await fallbackRes.text().catch(() => "");
    throw new Error(
      `ElevenLabs text-to-speech failed (${fallbackRes.status}): ${body.slice(0, 500)}`
    );
  }

  const arrayBuffer = await fallbackRes.arrayBuffer();
  return { audioBuffer: Buffer.from(arrayBuffer), wordTimestamps: null };
}
