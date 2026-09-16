"use client";

import type { ProjectWithBeats } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, data);
  }
  return data as T;
}

export class ApiError extends Error {
  data: unknown;
  constructor(message: string, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.data = data;
  }
}

export interface EnvCheckResponse {
  env: { key: string; label: string; configured: boolean }[];
  ffmpeg: { ffmpeg: boolean; ffprobe: boolean; installInstructions: string };
}

export const api = {
  envCheck: () => request<EnvCheckResponse>("/api/env-check"),

  settings: {
    get: () =>
      request<{ settings: Record<string, string>; todaySpend: number }>("/api/settings"),
    update: (patch: Record<string, string>) =>
      request<{ settings: Record<string, string> }>("/api/settings", {
        method: "POST",
        body: JSON.stringify(patch),
      }),
  },

  projects: {
    list: () => request<{ projects: ProjectWithBeats[] }>("/api/projects"),
    get: (id: string) => request<{ project: ProjectWithBeats }>(`/api/projects/${id}`),
    create: (role: string, tone: string) =>
      request<{ project: ProjectWithBeats }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ role, tone }),
      }),
    delete: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),

    generateScript: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/script`, { method: "POST" }),
    editScript: (id: string, script: ProjectWithBeats["scriptJson"]) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/script`, {
        method: "PATCH",
        body: JSON.stringify({ script }),
      }),

    runCompliance: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/compliance`, { method: "POST" }),
    overrideCompliance: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/compliance`, {
        method: "POST",
        body: JSON.stringify({ override: true }),
      }),

    generateVoiceover: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/voiceover`, { method: "POST" }),
    rebuildCaptions: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/captions`, { method: "POST" }),

    videoEstimate: (id: string) =>
      request<{
        beatSeconds: { idx: number; estimated: number; billedAs: number }[];
        totalRoundedSeconds: number;
        pricePerSecond: number;
        estimatedCost: number;
        dailySpendCap: number;
        spentToday: number;
        wouldExceedCap: boolean;
      }>(`/api/projects/${id}/video/estimate`),
    generateVideo: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/video`, {
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      }),
    generateReferenceImage: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/video/reference`, {
        method: "POST",
      }),
    generateBeat: (id: string, idx: number) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/video/beats/${idx}`, {
        method: "POST",
      }),

    assemble: (id: string) =>
      request<{ project: ProjectWithBeats }>(`/api/projects/${id}/assemble`, { method: "POST" }),
  },
};
