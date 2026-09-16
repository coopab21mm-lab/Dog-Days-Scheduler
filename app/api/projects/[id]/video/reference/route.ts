import { NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { MissingEnvError } from "@/lib/env";
import { generateAndSaveReferenceImage } from "@/lib/videoPipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.scriptJson) {
    return NextResponse.json({ error: "Generate a script before creating a reference image." }, { status: 400 });
  }

  try {
    await generateAndSaveReferenceImage(project);
    return NextResponse.json({ project: getProject(id) });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error generating reference image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
