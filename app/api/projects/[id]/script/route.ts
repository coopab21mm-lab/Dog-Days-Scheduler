import { NextResponse } from "next/server";
import { generateScript, ScriptParseError } from "@/lib/anthropic";
import { getProject, replaceBeats, updateProject } from "@/lib/db";
import { MissingEnvError } from "@/lib/env";
import type { Script } from "@/lib/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  updateProject(id, { scriptStatus: "running", scriptError: null });

  try {
    const script = await generateScript(project.role, project.tone);
    updateProject(id, {
      scriptJson: script,
      scriptStatus: "done",
      scriptError: null,
      scriptRaw: null,
      status: "script",
      // A fresh script invalidates any prior compliance verdict and downstream steps.
      complianceJson: null,
      complianceStatus: "pending",
      complianceError: null,
      complianceOverride: false,
    });
    replaceBeats(id, script.beats);
    const updated = getProject(id)!;
    return NextResponse.json({ project: updated });
  } catch (err) {
    if (err instanceof ScriptParseError) {
      updateProject(id, {
        scriptStatus: "failed",
        scriptError: err.message,
        scriptRaw: err.raw,
      });
      return NextResponse.json(
        { error: err.message, raw: err.raw },
        { status: 422 }
      );
    }
    if (err instanceof MissingEnvError) {
      updateProject(id, { scriptStatus: "failed", scriptError: err.message });
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error generating script.";
    updateProject(id, { scriptStatus: "failed", scriptError: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Inline editing of the script text on the dashboard.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json()) as { script: Script };
  if (!body.script || !Array.isArray(body.script.beats)) {
    return NextResponse.json({ error: "invalid script payload" }, { status: 400 });
  }

  updateProject(id, {
    scriptJson: body.script,
    scriptStatus: "done",
    // Editing the script invalidates any prior compliance verdict.
    complianceJson: null,
    complianceStatus: "pending",
    complianceError: null,
    complianceOverride: false,
  });
  replaceBeats(id, body.script.beats);
  const updated = getProject(id)!;
  return NextResponse.json({ project: updated });
}
