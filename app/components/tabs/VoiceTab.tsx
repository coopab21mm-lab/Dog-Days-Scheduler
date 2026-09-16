"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import type { ProjectWithBeats } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";

export function VoiceTab({
  project,
  onUpdate,
}: {
  project: ProjectWithBeats;
  onUpdate: (p: ProjectWithBeats) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { project: updated } = await api.projects.generateVoiceover(project.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate voiceover.");
    } finally {
      setBusy(false);
    }
  }

  async function rebuildCaptions() {
    setBusy(true);
    setError(null);
    try {
      const { project: updated } = await api.projects.rebuildCaptions(project.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rebuild captions.");
    } finally {
      setBusy(false);
    }
  }

  if (!project.scriptJson) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Generate a script first.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Voiceover</h3>
            <StatusBadge status={project.voiceoverStatus} />
          </div>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Working…" : project.voiceoverPath ? "Regenerate voiceover" : "Generate voiceover"}
          </button>
        </div>
        {project.voiceoverError && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {project.voiceoverError}
          </p>
        )}
        {project.voiceoverPath && (
          <audio controls className="w-full" src={`/media-files/${project.id}/voiceover.mp3`} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Captions</h3>
            <StatusBadge status={project.captionsStatus} />
            {project.captionsSource && (
              <span className="text-xs text-zinc-500">
                {project.captionsSource === "timestamps"
                  ? "from real word timestamps"
                  : "estimated from word count"}
              </span>
            )}
          </div>
          <button
            onClick={rebuildCaptions}
            disabled={busy || project.voiceoverStatus !== "done"}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Rebuild captions
          </button>
        </div>
        {project.captionsError && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {project.captionsError}
          </p>
        )}
        {project.captionsPath && (
          <a
            href={`/media-files/${project.id}/captions.srt`}
            download
            className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Download captions.srt
          </a>
        )}
      </section>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
