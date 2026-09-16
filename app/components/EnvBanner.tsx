"use client";

import { useEffect, useState } from "react";
import { api, type EnvCheckResponse } from "@/lib/client-api";

export function EnvBanner() {
  const [data, setData] = useState<EnvCheckResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.envCheck().then(setData).catch(() => setData(null));
  }, []);

  if (!data || dismissed) return null;

  const missingKeys = data.env.filter((e) => !e.configured);
  const ffmpegMissing = !data.ffmpeg.ffmpeg || !data.ffmpeg.ffprobe;

  if (missingKeys.length === 0 && !ffmpegMissing) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
        <div className="space-y-1">
          {missingKeys.length > 0 && (
            <p>
              <strong>Missing API keys:</strong>{" "}
              {missingKeys.map((k) => k.label).join(", ")}. Add them to{" "}
              <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">.env.local</code>{" "}
              (see <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">.env.local.example</code>) and restart the app.
            </p>
          )}
          {ffmpegMissing && (
            <p>
              <strong>ffmpeg not found on PATH.</strong> {data.ffmpeg.installInstructions}
            </p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded px-2 py-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
