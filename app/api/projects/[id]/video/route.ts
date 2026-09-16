import { NextResponse } from "next/server";
import { getAllSettings, getProject, getProjectWithBeats, updateProject } from "@/lib/db";
import { MissingEnvError } from "@/lib/env";
import { estimateVideoCost, roundToSupportedDuration } from "@/lib/kling";
import { generateAllBeats } from "@/lib/videoPipeline";

// Generates the reference image (if needed) and every beat's clip, sequentially. This is the
// expensive step, so the dashboard must show the cost estimate and get an explicit confirm
// click before calling this route.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.scriptJson) {
    return NextResponse.json({ error: "Generate a script before generating video." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { confirmed?: boolean };
  if (!body.confirmed) {
    return NextResponse.json(
      { error: "Video generation requires explicit cost confirmation (confirmed: true)." },
      { status: 400 }
    );
  }

  const withBeats = getProjectWithBeats(id)!;
  const settings = getAllSettings();
  const pricePerSecond = parseFloat(settings.kling_price_per_second) || 0;
  const totalRoundedSeconds = withBeats.beats.reduce(
    (sum, b) => sum + roundToSupportedDuration(b.seconds),
    0
  );
  const estimatedCost = estimateVideoCost(totalRoundedSeconds, pricePerSecond);

  // Only informational here — costActual is only incremented per-beat, once a clip has
  // actually been generated (see lib/videoPipeline.ts), so a failed/missing-key attempt
  // never inflates spend-cap accounting.
  updateProject(id, { costEstimate: estimatedCost });

  try {
    await generateAllBeats(id);
    return NextResponse.json({ project: getProjectWithBeats(id) });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error generating video.";
    return NextResponse.json({ error: message, project: getProjectWithBeats(id) }, { status: 500 });
  }
}
