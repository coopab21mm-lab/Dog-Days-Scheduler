"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ProjectWithBeats } from "@/lib/types";
import { api } from "@/lib/client-api";
import { EnvBanner } from "@/app/components/EnvBanner";
import { ProjectList } from "@/app/components/ProjectList";
import { NewProjectForm } from "@/app/components/NewProjectForm";
import { ProjectView } from "@/app/components/ProjectView";

export default function Home() {
  const [projects, setProjects] = useState<ProjectWithBeats[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithBeats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshList = useCallback(async () => {
    const { projects } = await api.projects.list();
    setProjects(projects);
    return projects;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { projects } = await api.projects.list();
      if (cancelled) return;
      setProjects(projects);
      if (projects.length > 0) setSelectedId(projects[0].id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    api.projects.get(selectedId).then(({ project }) => {
      if (!cancelled) setSelectedProject(project);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const projectToShow =
    selectedId && selectedProject?.id === selectedId ? selectedProject : null;

  function handleProjectUpdate(updated: ProjectWithBeats) {
    setSelectedProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleCreated(project: ProjectWithBeats) {
    setProjects((prev) => [project, ...prev]);
    setSelectedId(project.id);
  }

  async function handleDeleted() {
    const remaining = await refreshList();
    setSelectedId(remaining[0]?.id ?? null);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <EnvBanner />
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Daybook Agent</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Role/era → script → compliance → voiceover → AI video → captions → final .mp4
            </p>
          </div>
          <Link
            href="/settings"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Settings
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-6 py-6">
        <aside className="w-80 shrink-0 space-y-4">
          <NewProjectForm onCreated={handleCreated} />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Projects</h2>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <ProjectList projects={projects} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          {projectToShow ? (
            <ProjectView
              key={projectToShow.id}
              project={projectToShow}
              onUpdate={handleProjectUpdate}
              onDeleted={handleDeleted}
            />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? "Loading…" : "Select or create a project to get started."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
