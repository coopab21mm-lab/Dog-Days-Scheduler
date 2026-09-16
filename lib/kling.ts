import { requireEnv } from "./env";

// AI video generation goes through fal.ai's hosted Kling endpoints — fal.ai wraps Kling's
// models behind a simple API-key-based async queue API, which is considerably simpler to
// integrate reliably than Kling's own developer API (which requires access-key/secret-key
// JWT signing). KLING_API_KEY is therefore expected to be a fal.ai API key ("FAL_KEY").
// The reference-image step also goes through fal.ai (a hosted image model) so the whole
// character-consistency step only needs the one key.
//
// Model slugs are configurable via env vars since fal.ai model paths/versions shift over
// time — verify current slugs at https://fal.ai/models if generation starts 404ing.
const DEFAULT_VIDEO_MODEL = "fal-ai/kling-video/v1.6/standard/image-to-video";
const DEFAULT_IMAGE_MODEL = "fal-ai/flux/schnell";

const QUEUE_BASE = "https://queue.fal.run";
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per job

function getApiKey(): string {
  return requireEnv("KLING_API_KEY", "Kling / fal.ai (AI video generation)");
}

function videoModel(): string {
  return process.env.KLING_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL;
}

function imageModel(): string {
  return process.env.KLING_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
}

interface FalSubmitResponse {
  request_id: string;
  status_url?: string;
  response_url?: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "ERROR" | "FAILED" | string;
  logs?: { message: string }[];
  error?: string;
}

async function submitJob(
  modelPath: string,
  apiKey: string,
  input: Record<string, unknown>
): Promise<{ statusUrl: string; responseUrl: string }> {
  const res = await fetch(`${QUEUE_BASE}/${modelPath}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`fal.ai job submission failed (${res.status}) for ${modelPath}: ${body.slice(0, 500)}`);
  }
  const data = (await res.json()) as FalSubmitResponse;
  const statusUrl = data.status_url ?? `${QUEUE_BASE}/${modelPath}/requests/${data.request_id}/status`;
  const responseUrl = data.response_url ?? `${QUEUE_BASE}/${modelPath}/requests/${data.request_id}`;
  return { statusUrl, responseUrl };
}

async function pollUntilComplete(statusUrl: string, apiKey: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`fal.ai status check failed (${res.status}): ${body.slice(0, 500)}`);
    }
    const data = (await res.json()) as FalStatusResponse;
    if (data.status === "COMPLETED") return;
    if (data.status === "ERROR" || data.status === "FAILED") {
      throw new Error(`fal.ai job failed: ${data.error ?? "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("fal.ai job timed out after 10 minutes.");
}

async function fetchResult(responseUrl: string, apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetch(responseUrl, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`fal.ai result fetch failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

// Result shapes vary slightly by model; check a handful of common field paths.
function extractUrl(result: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const parts = key.split(".");
    let value: unknown = result;
    for (const part of parts) {
      if (value && typeof value === "object" && part in (value as object)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && "url" in first) {
        const u = (first as Record<string, unknown>).url;
        if (typeof u === "string") return u;
      }
    }
  }
  return null;
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download generated media (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export interface ReferenceImageResult {
  buffer: Buffer;
  remoteUrl: string;
}

export async function generateReferenceImage(prompt: string): Promise<ReferenceImageResult> {
  const apiKey = getApiKey();
  const { statusUrl, responseUrl } = await submitJob(imageModel(), apiKey, {
    prompt,
    image_size: "portrait_16_9",
    num_images: 1,
  });
  await pollUntilComplete(statusUrl, apiKey);
  const result = await fetchResult(responseUrl, apiKey);
  const imageUrl = extractUrl(result, ["images", "image.url", "image_url"]);
  if (!imageUrl) {
    throw new Error(
      `Could not find an image URL in the fal.ai response for model "${imageModel()}". Raw response: ${JSON.stringify(
        result
      ).slice(0, 500)}`
    );
  }
  const buffer = await downloadToBuffer(imageUrl);
  return { buffer, remoteUrl: imageUrl };
}

// Kling's image-to-video modes generate fixed-length clips (5s or 10s), not arbitrary
// durations, so each beat's estimated narration seconds is rounded to the nearest
// supported length.
export function roundToSupportedDuration(seconds: number): 5 | 10 {
  return seconds <= 7.5 ? 5 : 10;
}

export interface BeatVideoResult {
  buffer: Buffer;
  remoteUrl: string;
}

export async function generateBeatVideo(
  visualPrompt: string,
  referenceImageUrl: string,
  seconds: number
): Promise<BeatVideoResult> {
  const apiKey = getApiKey();
  const duration = roundToSupportedDuration(seconds);
  const { statusUrl, responseUrl } = await submitJob(videoModel(), apiKey, {
    prompt: visualPrompt,
    image_url: referenceImageUrl,
    duration: String(duration),
    aspect_ratio: "9:16",
  });
  await pollUntilComplete(statusUrl, apiKey);
  const result = await fetchResult(responseUrl, apiKey);
  const videoUrl = extractUrl(result, ["video.url", "video_url"]);
  if (!videoUrl) {
    throw new Error(
      `Could not find a video URL in the fal.ai response for model "${videoModel()}". Raw response: ${JSON.stringify(
        result
      ).slice(0, 500)}`
    );
  }
  const buffer = await downloadToBuffer(videoUrl);
  return { buffer, remoteUrl: videoUrl };
}

export function estimateVideoCost(totalBeatSeconds: number, pricePerSecond: number): number {
  return Math.round(totalBeatSeconds * pricePerSecond * 100) / 100;
}

// Encodes the locally-saved reference image as a data URI so beat generation never depends
// on an external CDN URL staying alive between retries (fal.ai's hosted result URLs are not
// guaranteed to be permanent).
export function imageBufferToDataUri(buffer: Buffer, mimeType = "image/png"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
