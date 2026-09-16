import { NextResponse } from "next/server";
import fs from "node:fs";
import { buildCaptions } from "@/lib/captions";
import { getProject, updateProject } from "@/lib/db";
import { captionsPath } from "@/lib/media";

// Retries only the .srt build from already-fetched voiceover timestamps, without
// re-calling ElevenLabs (and re-paying for the voiceover) again.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.scriptJson) {
    return NextResponse.json({ error: "No script to build captions from." }, { status: 400 });
  }
  if (project.voiceoverStatus !== "done") {
    return NextResponse.json({ error: "Generate the voiceover before building captions." }, { status: 400 });
  }

  updateProject(id, { captionsStatus: "running", captionsError: null });
  try {
    const captions = buildCaptions(project.scriptJson, project.voiceoverTimestamps);
    const srtPath = captionsPath(id);
    fs.writeFileSync(srtPath, captions.srt);
    updateProject(id, {
      captionsStatus: "done",
      captionsError: null,
      captionsPath: srtPath,
      captionsSource: captions.source,
    });
    return NextResponse.json({ project: getProject(id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error building captions.";
    updateProject(id, { captionsStatus: "failed", captionsError: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
