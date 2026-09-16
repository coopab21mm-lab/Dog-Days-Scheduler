"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import { ERA_PRESETS, TONE_OPTIONS } from "@/lib/types";
import type { ProjectWithBeats } from "@/lib/types";

export function NewProjectForm({
  onCreated,
}: {
  onCreated: (project: ProjectWithBeats) => void;
}) {
  const [role, setRole] = useState("");
  const [tone, setTone] = useState<string>(TONE_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim()) {
      setError("Enter a role and setting first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { project } = await api.projects.create(role.trim(), tone);
      onCreated(project);
      setRole("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New project</h2>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Role &amp; setting
        </label>
        <textarea
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. A young samurai retainer, Kyoto, Japan, 1603"
          rows={2}
          className="w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ERA_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            onClick={() => setRole(preset)}
            className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {preset.split(",")[0]}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tone</label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {TONE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {busy ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
