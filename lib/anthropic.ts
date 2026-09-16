import Anthropic from "@anthropic-ai/sdk";
import { requireEnv } from "./env";
import type { ComplianceResult, Script } from "./types";

const MODEL = "claude-sonnet-5";

function getClient(): Anthropic {
  const apiKey = requireEnv("ANTHROPIC_API_KEY", "Anthropic (script + compliance)");
  return new Anthropic({ apiKey });
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

// Model output sometimes wraps JSON in prose or fences despite instructions; pull out the object.
function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return candidate.trim();
  }
  return candidate.slice(start, end + 1).trim();
}

export class ScriptParseError extends Error {
  raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "ScriptParseError";
    this.raw = raw;
  }
}

const SCRIPT_PROMPT_TEMPLATE = (role: string, tone: string) => `You are a scriptwriter for a short-form history video series called "Daybook" that dramatizes a single day in the life of an ordinary, invented-but-plausible person (never a specific real named historical figure) in a stated time and place. The videos run 45-60 seconds and are shot vertically for YouTube Shorts, TikTok and Instagram Reels.

Role and setting: ${role}
Tone: ${tone}

Write ONE script as strict JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "title": string, short and specific, under 60 characters,
  "hook": string, one punchy sentence under 20 words, spoken straight to the viewer as the opening line,
  "beats": [
    { "text": string (1-2 sentences, second person present tense, e.g. "You wake before..."), "visual": string (a concrete shot description usable as a text-to-video prompt), "seconds": number (estimated narration time for this beat, between 4 and 9) }
    ... 4 to 6 beats total
  ],
  "closeLine": string, one closing line under 15 words that lands the video, no "subscribe" spam
}

Rules: ground every beat in a specific, concrete daily-life detail (tools, food, sounds, smells, social rules) appropriate to the stated time and place. Do not state genuinely disputed historical claims as flat fact — prefer well-established daily-life detail over contested specifics. Keep narration second person, present tense. The beats' seconds should sum to between 40 and 65. Return ONLY the JSON object.`;

function validateScript(value: unknown): Script {
  if (typeof value !== "object" || value === null) {
    throw new Error("Script is not an object");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.title !== "string") throw new Error("Missing or invalid 'title'");
  if (typeof v.hook !== "string") throw new Error("Missing or invalid 'hook'");
  if (typeof v.closeLine !== "string") throw new Error("Missing or invalid 'closeLine'");
  if (!Array.isArray(v.beats) || v.beats.length === 0) {
    throw new Error("Missing or invalid 'beats' array");
  }
  const beats = v.beats.map((b, i) => {
    if (typeof b !== "object" || b === null) throw new Error(`beats[${i}] is not an object`);
    const bv = b as Record<string, unknown>;
    if (typeof bv.text !== "string") throw new Error(`beats[${i}].text invalid`);
    if (typeof bv.visual !== "string") throw new Error(`beats[${i}].visual invalid`);
    if (typeof bv.seconds !== "number") throw new Error(`beats[${i}].seconds invalid`);
    return { text: bv.text, visual: bv.visual, seconds: bv.seconds };
  });
  return { title: v.title, hook: v.hook, closeLine: v.closeLine, beats };
}

export async function generateScript(role: string, tone: string): Promise<Script> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: SCRIPT_PROMPT_TEMPLATE(role, tone) }],
  });
  const raw = extractText(message);
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ScriptParseError("Claude's response was not valid JSON.", raw);
  }
  try {
    return validateScript(parsed);
  } catch (err) {
    throw new ScriptParseError(
      `Claude's response was valid JSON but didn't match the expected script shape: ${
        (err as Error).message
      }`,
      raw
    );
  }
}

function validateCompliance(value: unknown): ComplianceResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("Compliance result is not an object");
  }
  const v = value as Record<string, unknown>;
  const allowedVerdicts = ["looks fine", "minor fixes suggested", "risky — fix before posting"];
  if (typeof v.verdict !== "string" || !allowedVerdicts.includes(v.verdict)) {
    throw new Error("Missing or invalid 'verdict'");
  }
  if (!Array.isArray(v.risks)) throw new Error("Missing or invalid 'risks' array");
  const risks = v.risks.map((r, i) => {
    if (typeof r !== "object" || r === null) throw new Error(`risks[${i}] is not an object`);
    const rv = r as Record<string, unknown>;
    if (typeof rv.issue !== "string") throw new Error(`risks[${i}].issue invalid`);
    if (typeof rv.why !== "string") throw new Error(`risks[${i}].why invalid`);
    if (typeof rv.fix !== "string") throw new Error(`risks[${i}].fix invalid`);
    return { issue: rv.issue, why: rv.why, fix: rv.fix };
  });
  return { verdict: v.verdict as ComplianceResult["verdict"], risks };
}

export async function checkCompliance(script: Script): Promise<ComplianceResult> {
  const client = getClient();
  const numberedBeats = script.beats
    .map((b, i) => `Beat ${i + 1}: ${b.text}`)
    .join("\n");
  const prompt = `Review the following short-form video script, intended to be posted as AI-generated content on YouTube Shorts, TikTok and Instagram Reels, against those platforms' current synthetic-media and misinformation policies. Flag concrete risks only — do not invent vague cautions.

Title: ${script.title}
Hook: ${script.hook}
${numberedBeats}
Close: ${script.closeLine}

Check specifically for: claims about real named living or recently-deceased people; historical claims stated as settled fact that are actually genuinely disputed; content that could be mistaken for real documentary footage of an actual identifiable event without context; anything reading as an identical repeated template rather than distinct content; missing acknowledgment that this is a dramatization of an invented person.

Return strict JSON, no markdown fences, no commentary, in exactly this shape:
{
  "verdict": "looks fine" | "minor fixes suggested" | "risky — fix before posting",
  "risks": [ { "issue": string, "why": string, "fix": string } ]
}
If nothing applies, return an empty risks array and verdict "looks fine".`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = extractText(message);
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ScriptParseError("Claude's compliance response was not valid JSON.", raw);
  }
  try {
    return validateCompliance(parsed);
  } catch (err) {
    throw new ScriptParseError(
      `Claude's compliance response didn't match the expected shape: ${(err as Error).message}`,
      raw
    );
  }
}

// Prompt for a single reference-image describing the invented character, for use as an
// image-generation input (Step 5 prerequisite). Kept separate so lib/kling.ts / an image
// provider can consume it directly.
export function buildCharacterReferencePrompt(role: string, script: Script): string {
  return `A single photorealistic portrait of an invented, ordinary person: ${role}. Front-facing, three-quarter portrait, natural lighting, period-accurate clothing and setting, consistent with the daily life shown in this scene: "${script.beats[0]?.visual ?? script.hook}". No text, no watermark, no modern objects.`;
}
