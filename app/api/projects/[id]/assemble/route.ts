import { NextResponse } from "next/server";
import path from "node:path";
import { getProjectWithBeats, updateProject } from "@/lib/db";
import { assembleVideo, checkFfmpeg } from "@/lib/ffmpeg";
import { finalVideoPath, projectMediaDir } from "@/lib/media";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProjectWithBeats(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const availability = await checkFfmpeg();
  if (!availability.ffmpeg || !availability.ffprobe) {
    return NextResponse.json(
      { error: `ffmpeg is not installed or not on PATH. ${availability.installInstructions}` },
      { status: 400 }
    );
  }

  if (project.voiceoverStatus !== "done" || !project.voiceoverPath) {
    return NextResponse.json({ error: "Voiceover must be generated before assembly." }, { status: 400 });
  }
  if (project.captionsStatus !== "done" || !project.captionsPath) {
    return NextResponse.json({ error: "Captions must be generated before assembly." }, { status: 400 });
  }
  const missingBeats = project.beats.filter((b) => b.videoStatus !== "done" || !b.videoPath);
  if (missingBeats.length > 0) {
    return NextResponse.json(
      {
        error: `${missingBeats.length} beat clip(s) are not ready yet (beat ${missingBeats
          .map((b) => b.idx + 1)
          .join(", ")}). Generate or retry them before assembling.`,
      },
      { status: 400 }
    );
  }

  updateProject(id, { assembleStatus: "running", assembleError: null });
  try {
    const clipPaths = project.beats
      .sort((a, b) => a.idx - b.idx)
      .map((b) => b.videoPath!);
    const outputPath = finalVideoPath(id);
    await assembleVideo({
      clipPaths,
      voiceoverPath: project.voiceoverPath,
      captionsPath: project.captionsPath,
      outputPath,
      tmpDir: path.join(projectMediaDir(id), "tmp"),
    });
    updateProject(id, {
      assembleStatus: "done",
      assembleError: null,
      finalVideoPath: outputPath,
      status: "ready",
    });
    return NextResponse.json({ project: getProjectWithBeats(id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error assembling final video.";
    updateProject(id, { assembleStatus: "failed", assembleError: message, status: "failed" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
