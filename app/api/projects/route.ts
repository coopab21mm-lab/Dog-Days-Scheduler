import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db";
import { ensureProjectDirs } from "@/lib/media";

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { role?: string; tone?: string };
  const role = body.role?.trim();
  const tone = body.tone?.trim();
  if (!role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }
  if (!tone) {
    return NextResponse.json({ error: "tone is required" }, { status: 400 });
  }
  const project = createProject(role, tone);
  ensureProjectDirs(project.id);
  return NextResponse.json({ project });
}
