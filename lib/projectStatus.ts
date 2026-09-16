import type { Project } from "./types";

// Human-readable pipeline status for the project list, e.g. "script", "compliance",
// "ready", or "failed at voice" when a step errored out.
export function displayStatus(project: Project): string {
  const stepOrder: { key: keyof Project; label: string }[] = [
    { key: "scriptStatus", label: "script" },
    { key: "complianceStatus", label: "compliance" },
    { key: "voiceoverStatus", label: "voice" },
    { key: "captionsStatus", label: "captions" },
    { key: "referenceImageStatus", label: "video" },
    { key: "assembleStatus", label: "assembling" },
  ];

  const failedStep = stepOrder.find((s) => project[s.key] === "failed");
  if (failedStep) return `failed at ${failedStep.label}`;

  if (project.status === "ready") return "ready";
  if (project.status === "draft") return "draft";
  return project.status;
}

export function totalCost(project: Project): number {
  return project.costActual;
}
