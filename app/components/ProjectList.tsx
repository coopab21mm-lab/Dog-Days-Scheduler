"use client";

import type { ProjectWithBeats } from "@/lib/types";
import { displayStatus } from "@/lib/projectStatus";

export function ProjectList({
  projects,
  selectedId,
  onSelect,
}: {
  projects: ProjectWithBeats[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-zinc-500 dark:text-zinc-400">
        No projects yet — create one below to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {projects.map((p) => {
        const status = displayStatus(p);
        const isFailed = status.startsWith("failed");
        const isReady = status === "ready";
        return (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                selectedId === p.id
                  ? "border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
                  : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {p.scriptJson?.title ?? p.role}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{p.role}</p>
              <div className="mt-1 flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    isFailed
                      ? "text-red-600 dark:text-red-400"
                      : isReady
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {status}
                </span>
                <span className="text-xs text-zinc-400">${p.costActual.toFixed(2)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
