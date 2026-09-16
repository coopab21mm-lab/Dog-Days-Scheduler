import fs from "node:fs";
import {
  buildCharacterReferencePrompt,
} from "./anthropic";
import {
  estimateVideoCost,
  generateBeatVideo,
  generateReferenceImage,
  imageBufferToDataUri,
  roundToSupportedDuration,
} from "./kling";
import { getAllSettings, getBeat, getProject, listBeats, updateBeat, updateProject } from "./db";
import { beatClipPath, referenceImagePath } from "./media";
import type { Project } from "./types";

export async function generateAndSaveReferenceImage(project: Project): Promise<string> {
  if (!project.scriptJson) throw new Error("Project has no script yet.");
  updateProject(project.id, { referenceImageStatus: "running", referenceImageError: null });
  try {
    const prompt = buildCharacterReferencePrompt(project.role, project.scriptJson);
    const { buffer } = await generateReferenceImage(prompt);
    const filePath = referenceImagePath(project.id);
    fs.writeFileSync(filePath, buffer);
    updateProject(project.id, {
      referenceImageStatus: "done",
      referenceImageError: null,
      referenceImagePath: filePath,
    });
    return filePath;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error generating reference image.";
    updateProject(project.id, { referenceImageStatus: "failed", referenceImageError: message });
    throw err;
  }
}

export async function ensureReferenceImage(project: Project): Promise<string> {
  if (project.referenceImageStatus === "done" && project.referenceImagePath) {
    return project.referenceImagePath;
  }
  return generateAndSaveReferenceImage(project);
}

export async function generateSingleBeat(projectId: string, idx: number): Promise<void> {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found.");
  const beat = getBeat(projectId, idx);
  if (!beat) throw new Error(`Beat ${idx} not found.`);

  const referencePath = await ensureReferenceImage(project);
  updateBeat(projectId, idx, { videoStatus: "running", videoError: null });
  try {
    // Path is always under media/{projectId}/reference.png (see lib/media.ts); Turbopack's
    // static analysis can't see that through the variable, so skip its bundle-tracing here.
    const referenceBuffer = fs.readFileSync(/* turbopackIgnore: true */ referencePath);
    const dataUri = imageBufferToDataUri(referenceBuffer);
    const { buffer } = await generateBeatVideo(beat.visual, dataUri, beat.seconds);
    const clipPath = beatClipPath(projectId, idx);
    fs.writeFileSync(clipPath, buffer);
    updateBeat(projectId, idx, { videoStatus: "done", videoError: null, videoPath: clipPath });

    // Only charge for a beat once its clip has actually been generated, not just attempted —
    // an early failure (e.g. a missing key) must not inflate the spend-cap accounting.
    const pricePerSecond = parseFloat(getAllSettings().kling_price_per_second) || 0;
    const cost = estimateVideoCost(roundToSupportedDuration(beat.seconds), pricePerSecond);
    const latest = getProject(projectId)!;
    updateProject(projectId, { costActual: latest.costActual + cost });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error generating this beat's video.";
    updateBeat(projectId, idx, { videoStatus: "failed", videoError: message });
    throw err;
  }
}

// Generates every beat sequentially, continuing past individual failures so one bad beat
// doesn't block the rest — failed beats stay retriable individually from the dashboard.
export async function generateAllBeats(projectId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found.");
  await ensureReferenceImage(project);

  updateProject(projectId, { status: "video" });
  const beats = listBeats(projectId);
  for (const beat of beats) {
    try {
      await generateSingleBeat(projectId, beat.idx);
    } catch {
      // continue; failure is recorded on the beat row for individual retry
    }
  }
}
