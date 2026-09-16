"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import type { ProjectWithBeats } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";

export function AssembleTab({
  project,
  onUpdate,
}: {
  project: ProjectWithBeats;
  onUpdate: (p: ProjectWithBeats) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beatsReady = project.beats.length > 0 && project.beats.every((b) => b.videoStatus === "done");
  const readyToAssemble =
    project.voiceoverStatus === "done" && project.captionsStatus === "done" && beatsReady;

  async function assemble() {
    setBusy(true);
    setError(null);
    try {
      const { project: updated } = await api.projects.assemble(project.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assemble final video.");
    } finally {
      setBusy(false);
    }
  }

  if (!project.scriptJson) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Generate a script first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusBadge status={project.assembleStatus} />
        <button
          onClick={assemble}
          disabled={busy || !readyToAssemble}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Assembling…" : project.finalVideoPath ? "Re-assemble" : "Assemble final video"}
        </button>
      </div>

      {!readyToAssemble && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Waiting on: {project.voiceoverStatus !== "done" && "voiceover, "}
          {project.captionsStatus !== "done" && "captions, "}
          {!beatsReady && "all beat clips"}
        </p>
      )}

      {(error || project.assembleError) && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error ?? project.assembleError}
        </p>
      )}

      {project.finalVideoPath && (
        <div className="space-y-3">
          <video
            controls
            className="h-[480px] w-[270px] rounded-lg border border-zinc-200 dark:border-zinc-800"
            src={`/media-files/${project.id}/final.mp4`}
          />
          <a
            href={`/media-files/${project.id}/final.mp4`}
            download={`${project.scriptJson.title || "daybook"}.mp4`}
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Download final.mp4
          </a>
        </div>
      )}
    </div>
  );
}
