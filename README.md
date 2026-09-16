# Daybook Agent

Turns a historical role/era into a finished, ready-to-post vertical short video
(9:16, ~45-60s) end to end:

**script → compliance check → voiceover → AI-generated video clips → burned-in captions → assembled final .mp4**

Runs entirely from a local dashboard — no editing tools or terminal use required after setup.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Install ffmpeg

ffmpeg (and ffprobe) must be on your system `PATH`.

- **macOS**: `brew install ffmpeg`
- **Linux (Debian/Ubuntu)**: `sudo apt-get update && sudo apt-get install -y ffmpeg`
- **Linux (Fedora)**: `sudo dnf install -y ffmpeg`
- **Windows**: `winget install Gyan.FFmpeg`, then restart your terminal

The app checks for ffmpeg on load and shows a banner with these instructions if it's
missing — you don't need to remember this.

### 3. Add your API keys

```bash
cp .env.local.example .env.local
```

Then fill in `.env.local`:

| Key | Used for | Get it at |
|---|---|---|
| `ANTHROPIC_API_KEY` | Script writing + compliance review | console.anthropic.com/settings/keys |
| `ELEVENLABS_API_KEY` | Voiceover (text-to-speech) | elevenlabs.io/app/settings/api-keys |
| `KLING_API_KEY` | AI video generation (via fal.ai's hosted Kling models) | fal.ai/dashboard/keys |

The app never fails silently on a missing key — the dashboard banner and the Settings
page both show exactly which key is missing, and each pipeline step returns a clear
error naming the key it needs.

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000.

## How it works

Each project goes through six independently-retriable steps, tracked per-project in a
local SQLite database (`data/daybook.sqlite3`) with generated media stored under
`media/{projectId}/`:

1. **Script** — Claude writes a title/hook/beats/close-line JSON script for the given
   role, setting and tone.
2. **Compliance** — Claude reviews the script against platform synthetic-media policy
   risks. A verdict other than "looks fine" blocks video generation behind a
   confirmation dialog.
3. **Voiceover** — ElevenLabs text-to-speech. Uses ElevenLabs' timestamped endpoint
   when available for accurate caption timing, falling back to word-count pacing
   otherwise.
4. **Captions** — a `.srt` file built from the voiceover timestamps (or estimated
   pacing).
5. **Video** — a single character reference image, then one Kling image-to-video clip
   per beat (consistent character across beats). Shows a cost estimate and requires
   confirmation before spending money; each beat is retriable individually.
6. **Assembly** — ffmpeg concatenates the beat clips, conforms the video length to the
   voiceover, burns in the captions, and muxes the final `final.mp4`.

Retrying a step never re-runs (or re-pays for) the steps before it.

## Settings

The in-app Settings page (`/settings`) lets you configure:

- Which ElevenLabs voice ID to use
- The Kling per-second price used for cost estimates (update if fal.ai/Kling pricing
  changes)
- A daily spend cap, with a warning before any video generation that would exceed it

## Out of scope

- Auto-posting to YouTube/TikTok/Instagram (needs OAuth + platform review — a separate
  project)
- Multi-language support
- A manual video editor — take `final.mp4` into CapCut or similar for manual tweaks
