"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import type { ProjectWithBeats } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";

export function VideoTab({
  project,
  onUpdate,
}: {
  project: ProjectWithBeats;
  onUpdate: (p: ProjectWithBeats) => void;
}) {
  const [busyAll, setBusyAll] = useState(false);
  const [busyBeat, setBusyBeat] = useState<number | null>(null);
  const [busyRef, setBusyRef] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complianceBlocked =
    project.complianceStatus === "done" &&
    project.complianceJson &&
    project.complianceJson.verdict !== "looks fine" &&
    !project.complianceOverride;

  async function confirmComplianceIfNeeded(): Promise<boolean> {
    if (!complianceBlocked) return true;
    const risks = project.complianceJson!.risks.map((r) => `• ${r.issue}`).join("\n");
    const ok = window.confirm(
      `Compliance check returned "${project.complianceJson!.verdict}":\n\n${risks}\n\nGenerate video anyway?`
    );
    if (!ok) return false;
    try {
      const { project: updated } = await api.projects.overrideCompliance(project.id);
      onUpdate(updated);
      return true;
    } catch {
      return false;
    }
  }

  async function generateReference() {
    setBusyRef(true);
    setError(null);
    try {
      const { project: updated } = await api.projects.generateReferenceImage(project.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate reference image.");
    } finally {
      setBusyRef(false);
    }
  }

  async function generateBeat(idx: number) {
    if (!(await confirmComplianceIfNeeded())) return;
    setBusyBeat(idx);
    setError(null);
    try {
      const { project: updated } = await api.projects.generateBeat(project.id, idx);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to generate beat ${idx + 1}.`);
    } finally {
      setBusyBeat(null);
    }
  }

  async function generateAll() {
    if (!(await confirmComplianceIfNeeded())) return;

    setError(null);
    let estimate;
    try {
      estimate = await api.projects.videoEstimate(project.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to estimate cost.");
      return;
    }

    const capWarning = estimate.wouldExceedCap
      ? `\n\nWARNING: this would bring today's spend to $${(estimate.spentToday + estimate.estimatedCost).toFixed(
          2
        )}, over your daily cap of $${estimate.dailySpendCap.toFixed(2)}.`
      : "";
    const ok = window.confirm(
      `This will generate ${project.beats.length} beat clip(s) totaling ~${estimate.totalRoundedSeconds}s ` +
        `at $${estimate.pricePerSecond.toFixed(2)}/s ≈ $${estimate.estimatedCost.toFixed(2)}.` +
        capWarning +
        `\n\nProceed with AI video generation?`
    );
    if (!ok) return;

    setBusyAll(true);
    try {
      const { project: updated } = await api.projects.generateVideo(project.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate video.");
    } finally {
      setBusyAll(false);
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
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Character reference image
            </h3>
            <StatusBadge status={project.referenceImageStatus} />
          </div>
          <button
            onClick={generateReference}
            disabled={busyRef || busyAll}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {busyRef ? "Generating…" : project.referenceImagePath ? "Regenerate" : "Generate"}
          </button>
        </div>
        {project.referenceImageError && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {project.referenceImageError}
          </p>
        )}
        {project.referenceImagePath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/media-files/${project.id}/reference.png`}
            alt="Character reference"
            className="h-48 w-32 rounded-md border border-zinc-200 object-cover dark:border-zinc-800"
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Beat clips ({project.beats.length})
          </h3>
          <button
            onClick={generateAll}
            disabled={busyAll || busyRef}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busyAll ? "Generating all beats…" : "Generate all beats"}
          </button>
        </div>

        {complianceBlocked && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            Compliance check flagged this script ({project.complianceJson!.verdict}). Generating
            video will ask you to confirm an override.
          </p>
        )}

        <ul className="space-y-3">
          {project.beats.map((beat) => (
            <li
              key={beat.idx}
              className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500">Beat {beat.idx + 1}</span>
                  <StatusBadge status={beat.videoStatus} />
                </div>
                <button
                  onClick={() => generateBeat(beat.idx)}
                  disabled={busyBeat === beat.idx || busyAll}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {busyBeat === beat.idx ? "Generating…" : beat.videoPath ? "Retry" : "Generate"}
                </button>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{beat.visual}</p>
              {beat.videoError && (
                <p className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {beat.videoError}
                </p>
              )}
              {beat.videoPath && (
                <video
                  controls
                  className="h-64 w-36 rounded-md border border-zinc-200 dark:border-zinc-800"
                  src={`/media-files/${project.id}/clips/beat-${beat.idx}.mp4`}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
