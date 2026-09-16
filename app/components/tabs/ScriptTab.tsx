"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import type { ProjectWithBeats, Script } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";

export function ScriptTab({
  project,
  onUpdate,
}: {
  project: ProjectWithBeats;
  onUpdate: (p: ProjectWithBeats) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [draft, setDraft] = useState<Script | null>(project.scriptJson);
  const [editing, setEditing] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    setRawResponse(null);
    try {
      const { project: updated } = await api.projects.generateScript(project.id);
      onUpdate(updated);
      setDraft(updated.scriptJson);
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setRawResponse((err.data as { raw?: string })?.raw ?? null);
      } else {
        setError("Failed to generate script.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const { project: updated } = await api.projects.editScript(project.id, draft);
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save script.");
    } finally {
      setBusy(false);
    }
  }

  function updateBeat(idx: number, field: "text" | "visual" | "seconds", value: string) {
    if (!draft) return;
    const beats = draft.beats.map((b, i) =>
      i === idx ? { ...b, [field]: field === "seconds" ? Number(value) || 0 : value } : b
    );
    setDraft({ ...draft, beats });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={project.scriptStatus} />
          {project.scriptJson && !editing && (
            <span className="text-xs text-zinc-500">
              {project.scriptJson.beats.reduce((s, b) => s + b.seconds, 0)}s estimated narration
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {project.scriptJson && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Edit
            </button>
          )}
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Generating…" : project.scriptJson ? "Regenerate script" : "Generate script"}
          </button>
        </div>
      </div>

      {error && (
        <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p>{error}</p>
          {rawResponse && (
            <details>
              <summary className="cursor-pointer text-xs font-medium">Raw response (debug)</summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 text-xs dark:bg-white/5">
                {rawResponse}
              </pre>
            </details>
          )}
        </div>
      )}

      {!draft && !busy && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No script yet. Click &ldquo;Generate script&rdquo; to write one from the role/setting and tone.
        </p>
      )}

      {draft && (
        <div className="space-y-4">
          <Field label="Title">
            <input
              disabled={!editing}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Hook">
            <textarea
              disabled={!editing}
              value={draft.hook}
              onChange={(e) => setDraft({ ...draft, hook: e.target.value })}
              rows={2}
              className="input"
            />
          </Field>

          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Beats ({draft.beats.length})
            </p>
            {draft.beats.map((beat, i) => (
              <div
                key={i}
                className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">Beat {i + 1}</span>
                  <span className="text-xs text-zinc-400">{beat.seconds}s</span>
                </div>
                <textarea
                  disabled={!editing}
                  value={beat.text}
                  onChange={(e) => updateBeat(i, "text", e.target.value)}
                  rows={2}
                  placeholder="Narration"
                  className="input"
                />
                <textarea
                  disabled={!editing}
                  value={beat.visual}
                  onChange={(e) => updateBeat(i, "visual", e.target.value)}
                  rows={2}
                  placeholder="Visual / shot description"
                  className="input text-zinc-500"
                />
              </div>
            ))}
          </div>

          <Field label="Close line">
            <textarea
              disabled={!editing}
              value={draft.closeLine}
              onChange={(e) => setDraft({ ...draft, closeLine: e.target.value })}
              rows={2}
              className="input"
            />
          </Field>

          {editing && (
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Save changes
              </button>
              <button
                onClick={() => {
                  setDraft(project.scriptJson);
                  setEditing(false);
                }}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}
