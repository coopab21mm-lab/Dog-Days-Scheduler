"use client";

import { useState } from "react";
import type { ProjectWithBeats } from "@/lib/types";
import { api, ApiError } from "@/lib/client-api";
import { ScriptTab } from "./tabs/ScriptTab";
import { ComplianceTab } from "./tabs/ComplianceTab";
import { VoiceTab } from "./tabs/VoiceTab";
import { VideoTab } from "./tabs/VideoTab";
import { AssembleTab } from "./tabs/AssembleTab";

const TABS = ["Script", "Compliance", "Voice & Captions", "Video", "Assemble"] as const;
type Tab = (typeof TABS)[number];

export function ProjectView({
  project,
  onUpdate,
  onDeleted,
}: {
  project: ProjectWithBeats;
  onUpdate: (p: ProjectWithBeats) => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Script");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this project and all its generated media? This cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      await api.projects.delete(project.id);
      onDeleted();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {project.scriptJson?.title ?? project.role}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {project.role} · {project.tone}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Cost so far: ${project.costActual.toFixed(2)}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === "Script" && <ScriptTab project={project} onUpdate={onUpdate} />}
        {tab === "Compliance" && <ComplianceTab project={project} onUpdate={onUpdate} />}
        {tab === "Voice & Captions" && <VoiceTab project={project} onUpdate={onUpdate} />}
        {tab === "Video" && <VideoTab project={project} onUpdate={onUpdate} />}
        {tab === "Assemble" && <AssembleTab project={project} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}
