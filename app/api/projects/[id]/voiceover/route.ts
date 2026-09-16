import { NextResponse } from "next/server";
import fs from "node:fs";
import { buildNarration, textToSpeech } from "@/lib/elevenlabs";
import { buildCaptions } from "@/lib/captions";
import { getAllSettings, getProject, updateProject } from "@/lib/db";
import { MissingEnvError } from "@/lib/env";
import { captionsPath, ensureProjectDirs, voiceoverPath } from "@/lib/media";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.scriptJson) {
    return NextResponse.json({ error: "Generate a script before creating a voiceover." }, { status: 400 });
  }

  ensureProjectDirs(id);
  updateProject(id, {
    voiceoverStatus: "running",
    voiceoverError: null,
    captionsStatus: "running",
    captionsError: null,
  });

  try {
    const settings = getAllSettings();
    const narration = buildNarration(project.scriptJson);
    const { audioBuffer, wordTimestamps } = await textToSpeech(
      narration,
      settings.elevenlabs_voice_id
    );

    const audioPath = voiceoverPath(id);
    fs.writeFileSync(audioPath, audioBuffer);

    const captions = buildCaptions(project.scriptJson, wordTimestamps);
    const srtPath = captionsPath(id);
    fs.writeFileSync(srtPath, captions.srt);

    updateProject(id, {
      voiceoverStatus: "done",
      voiceoverError: null,
      voiceoverPath: audioPath,
      voiceoverTimestamps: wordTimestamps,
      captionsStatus: "done",
      captionsError: null,
      captionsPath: srtPath,
      captionsSource: captions.source,
      status: "voice",
    });
    return NextResponse.json({ project: getProject(id) });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      updateProject(id, {
        voiceoverStatus: "failed",
        voiceoverError: err.message,
        captionsStatus: "failed",
        captionsError: "Waiting on voiceover.",
      });
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error generating voiceover.";
    updateProject(id, {
      voiceoverStatus: "failed",
      voiceoverError: message,
      captionsStatus: "failed",
      captionsError: "Waiting on voiceover.",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
