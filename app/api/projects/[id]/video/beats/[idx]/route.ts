import { NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { MissingEnvError } from "@/lib/env";
import { generateSingleBeat } from "@/lib/videoPipeline";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; idx: string }> }
) {
  const { id, idx } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const beatIdx = Number.parseInt(idx, 10);
  if (Number.isNaN(beatIdx)) {
    return NextResponse.json({ error: "invalid beat index" }, { status: 400 });
  }

  try {
    await generateSingleBeat(id, beatIdx);
    return NextResponse.json({ project: getProject(id) });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error generating this beat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
