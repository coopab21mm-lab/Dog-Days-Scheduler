"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import type { ProjectWithBeats } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";

const VERDICT_STYLES: Record<string, string> = {
  "looks fine": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "minor fixes suggested": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "risky — fix before posting": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function ComplianceTab({
  project,
  onUpdate,
}: {
  project: ProjectWithBeats;
  onUpdate: (p: ProjectWithBeats) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const { project: updated } = await api.projects.runCompliance(project.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to run compliance check.");
    } finally {
      setBusy(false);
    }
  }

  if (!project.scriptJson) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Generate a script first.</p>;
  }

  const result = project.complianceJson;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusBadge status={project.complianceStatus} />
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Checking…" : result ? "Re-run check" : "Run compliance check"}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {!result && !busy && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Not checked yet. This reviews the script against platform synthetic-media and
          misinformation policies before you spend money on video generation.
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${VERDICT_STYLES[result.verdict]}`}
          >
            {result.verdict}
          </span>

          {result.risks.length > 0 && (
            <ul className="space-y-2">
              {result.risks.map((risk, i) => (
                <li
                  key={i}
                  className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{risk.issue}</p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{risk.why}</p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">Fix: </span>
                    {risk.fix}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {result.verdict !== "looks fine" && (
            <p
              className={`text-xs ${
                project.complianceOverride
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {project.complianceOverride
                ? "Overridden — video generation is unblocked despite the verdict above."
                : "Video generation is blocked until you fix these or explicitly override, from the Video tab."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
