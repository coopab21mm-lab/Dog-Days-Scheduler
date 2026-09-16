import { NextResponse } from "next/server";
import { checkCompliance, ScriptParseError } from "@/lib/anthropic";
import { getProject, updateProject } from "@/lib/db";
import { MissingEnvError } from "@/lib/env";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.scriptJson) {
    return NextResponse.json({ error: "Generate a script before running the compliance check." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { override?: boolean };

  if (body.override) {
    updateProject(id, { complianceOverride: true });
    return NextResponse.json({ project: getProject(id) });
  }

  updateProject(id, { complianceStatus: "running", complianceError: null });

  try {
    const result = await checkCompliance(project.scriptJson);
    updateProject(id, {
      complianceJson: result,
      complianceStatus: "done",
      complianceError: null,
      complianceOverride: false,
      status: "compliance",
    });
    return NextResponse.json({ project: getProject(id) });
  } catch (err) {
    if (err instanceof ScriptParseError) {
      updateProject(id, { complianceStatus: "failed", complianceError: err.message });
      return NextResponse.json({ error: err.message, raw: err.raw }, { status: 422 });
    }
    if (err instanceof MissingEnvError) {
      updateProject(id, { complianceStatus: "failed", complianceError: err.message });
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error running compliance check.";
    updateProject(id, { complianceStatus: "failed", complianceError: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
