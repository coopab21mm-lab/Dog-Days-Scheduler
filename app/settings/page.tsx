"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type EnvCheckResponse } from "@/lib/client-api";

export default function SettingsPage() {
  const [env, setEnv] = useState<EnvCheckResponse | null>(null);
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [todaySpend, setTodaySpend] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.envCheck().then(setEnv);
    api.settings.get().then(({ settings, todaySpend }) => {
      setSettings(settings);
      setTodaySpend(todaySpend);
    });
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const { settings: updated } = await api.settings.update(settings);
      setSettings(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <Link
          href="/"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Back to dashboard
        </Link>
      </div>

      <section className="mb-8 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">API keys</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Keys are set via <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">.env.local</code>{" "}
          — this page only shows whether each one is configured.
        </p>
        <ul className="space-y-1.5">
          {env?.env.map((e) => (
            <li
              key={e.key}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <span className="text-zinc-700 dark:text-zinc-300">{e.label}</span>
              <span
                className={
                  e.configured
                    ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    : "text-xs font-medium text-red-600 dark:text-red-400"
                }
              >
                {e.configured ? "Configured" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
        <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-zinc-700 dark:text-zinc-300">ffmpeg / ffprobe</span>
            <span
              className={
                env?.ffmpeg.ffmpeg && env?.ffmpeg.ffprobe
                  ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                  : "text-xs font-medium text-red-600 dark:text-red-400"
              }
            >
              {env?.ffmpeg.ffmpeg && env?.ffmpeg.ffprobe ? "Installed" : "Not found"}
            </span>
          </div>
          {env && (!env.ffmpeg.ffmpeg || !env.ffmpeg.ffprobe) && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {env.ffmpeg.installInstructions}
            </p>
          )}
        </div>
      </section>

      {settings && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pipeline settings</h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              ElevenLabs voice ID
            </label>
            <input
              className="input"
              value={settings.elevenlabs_voice_id}
              onChange={(e) => setSettings({ ...settings, elevenlabs_voice_id: e.target.value })}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Find voice IDs at elevenlabs.io/app/voice-library. Defaults to ElevenLabs&apos; stable
              &ldquo;Rachel&rdquo; voice.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Kling price per second ($)
            </label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={settings.kling_price_per_second}
              onChange={(e) => setSettings({ ...settings, kling_price_per_second: e.target.value })}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Used only to estimate cost before generating video — update this if fal.ai/Kling
              pricing changes.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Daily spend cap ($)
            </label>
            <input
              className="input"
              type="number"
              step="1"
              min="0"
              value={settings.daily_spend_cap}
              onChange={(e) => setSettings({ ...settings, daily_spend_cap: e.target.value })}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Today&apos;s spend so far: ${todaySpend.toFixed(2)}. You&apos;ll get a warning before
              generating video that would exceed this.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
            {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
