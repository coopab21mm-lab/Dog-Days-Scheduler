import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  Beat,
  ComplianceResult,
  Project,
  ProjectStatus,
  ProjectWithBeats,
  Script,
  StepStatus,
  WordTimestamp,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "daybook.sqlite3");

declare global {
  var __daybookDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      tone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',

      script_json TEXT,
      script_status TEXT NOT NULL DEFAULT 'pending',
      script_error TEXT,
      script_raw TEXT,

      compliance_json TEXT,
      compliance_status TEXT NOT NULL DEFAULT 'pending',
      compliance_error TEXT,
      compliance_override INTEGER NOT NULL DEFAULT 0,

      voiceover_status TEXT NOT NULL DEFAULT 'pending',
      voiceover_error TEXT,
      voiceover_path TEXT,
      voiceover_timestamps_json TEXT,

      captions_status TEXT NOT NULL DEFAULT 'pending',
      captions_error TEXT,
      captions_path TEXT,
      captions_source TEXT,

      reference_image_status TEXT NOT NULL DEFAULT 'pending',
      reference_image_error TEXT,
      reference_image_path TEXT,

      assemble_status TEXT NOT NULL DEFAULT 'pending',
      assemble_error TEXT,
      final_video_path TEXT,

      cost_estimate REAL NOT NULL DEFAULT 0,
      cost_actual REAL NOT NULL DEFAULT 0,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beats (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      text TEXT NOT NULL,
      visual TEXT NOT NULL,
      seconds REAL NOT NULL,
      video_status TEXT NOT NULL DEFAULT 'pending',
      video_error TEXT,
      video_path TEXT,
      job_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_beats_project ON beats(project_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__daybookDb) {
    globalThis.__daybookDb = createDb();
  }
  return globalThis.__daybookDb;
}

// ---------- row <-> domain mapping ----------

interface ProjectRow {
  id: string;
  role: string;
  tone: string;
  status: ProjectStatus;
  script_json: string | null;
  script_status: StepStatus;
  script_error: string | null;
  script_raw: string | null;
  compliance_json: string | null;
  compliance_status: StepStatus;
  compliance_error: string | null;
  compliance_override: number;
  voiceover_status: StepStatus;
  voiceover_error: string | null;
  voiceover_path: string | null;
  voiceover_timestamps_json: string | null;
  captions_status: StepStatus;
  captions_error: string | null;
  captions_path: string | null;
  captions_source: "timestamps" | "estimated" | null;
  reference_image_status: StepStatus;
  reference_image_error: string | null;
  reference_image_path: string | null;
  assemble_status: StepStatus;
  assemble_error: string | null;
  final_video_path: string | null;
  cost_estimate: number;
  cost_actual: number;
  created_at: string;
  updated_at: string;
}

interface BeatRow {
  id: string;
  project_id: string;
  idx: number;
  text: string;
  visual: string;
  seconds: number;
  video_status: StepStatus;
  video_error: string | null;
  video_path: string | null;
  job_id: string | null;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    role: row.role,
    tone: row.tone,
    status: row.status,
    scriptJson: row.script_json ? (JSON.parse(row.script_json) as Script) : null,
    scriptStatus: row.script_status,
    scriptError: row.script_error,
    scriptRaw: row.script_raw,
    complianceJson: row.compliance_json
      ? (JSON.parse(row.compliance_json) as ComplianceResult)
      : null,
    complianceStatus: row.compliance_status,
    complianceError: row.compliance_error,
    complianceOverride: Boolean(row.compliance_override),
    voiceoverStatus: row.voiceover_status,
    voiceoverError: row.voiceover_error,
    voiceoverPath: row.voiceover_path,
    voiceoverTimestamps: row.voiceover_timestamps_json
      ? (JSON.parse(row.voiceover_timestamps_json) as WordTimestamp[])
      : null,
    captionsStatus: row.captions_status,
    captionsError: row.captions_error,
    captionsPath: row.captions_path,
    captionsSource: row.captions_source,
    referenceImageStatus: row.reference_image_status,
    referenceImageError: row.reference_image_error,
    referenceImagePath: row.reference_image_path,
    assembleStatus: row.assemble_status,
    assembleError: row.assemble_error,
    finalVideoPath: row.final_video_path,
    costEstimate: row.cost_estimate,
    costActual: row.cost_actual,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBeat(row: BeatRow): Beat {
  return {
    id: row.id,
    projectId: row.project_id,
    idx: row.idx,
    text: row.text,
    visual: row.visual,
    seconds: row.seconds,
    videoStatus: row.video_status,
    videoError: row.video_error,
    videoPath: row.video_path,
    jobId: row.job_id,
  };
}

// ---------- projects ----------

export function createProject(role: string, tone: string): Project {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, role, tone, status, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?)`
  ).run(id, role, tone, now, now);
  return getProject(id)!;
}

export function listProjects(): Project[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all() as ProjectRow[];
  return rows.map(rowToProject);
}

export function getProject(id: string): Project | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function getProjectWithBeats(id: string): ProjectWithBeats | null {
  const project = getProject(id);
  if (!project) return null;
  return { ...project, beats: listBeats(id) };
}

type ProjectPatch = Partial<{
  status: ProjectStatus;
  scriptJson: Script | null;
  scriptStatus: StepStatus;
  scriptError: string | null;
  scriptRaw: string | null;
  complianceJson: ComplianceResult | null;
  complianceStatus: StepStatus;
  complianceError: string | null;
  complianceOverride: boolean;
  voiceoverStatus: StepStatus;
  voiceoverError: string | null;
  voiceoverPath: string | null;
  voiceoverTimestamps: WordTimestamp[] | null;
  captionsStatus: StepStatus;
  captionsError: string | null;
  captionsPath: string | null;
  captionsSource: "timestamps" | "estimated" | null;
  referenceImageStatus: StepStatus;
  referenceImageError: string | null;
  referenceImagePath: string | null;
  assembleStatus: StepStatus;
  assembleError: string | null;
  finalVideoPath: string | null;
  costEstimate: number;
  costActual: number;
}>;

const PATCH_COLUMN_MAP: Record<keyof ProjectPatch, string> = {
  status: "status",
  scriptJson: "script_json",
  scriptStatus: "script_status",
  scriptError: "script_error",
  scriptRaw: "script_raw",
  complianceJson: "compliance_json",
  complianceStatus: "compliance_status",
  complianceError: "compliance_error",
  complianceOverride: "compliance_override",
  voiceoverStatus: "voiceover_status",
  voiceoverError: "voiceover_error",
  voiceoverPath: "voiceover_path",
  voiceoverTimestamps: "voiceover_timestamps_json",
  captionsStatus: "captions_status",
  captionsError: "captions_error",
  captionsPath: "captions_path",
  captionsSource: "captions_source",
  referenceImageStatus: "reference_image_status",
  referenceImageError: "reference_image_error",
  referenceImagePath: "reference_image_path",
  assembleStatus: "assemble_status",
  assembleError: "assemble_error",
  finalVideoPath: "final_video_path",
  costEstimate: "cost_estimate",
  costActual: "cost_actual",
};

const JSON_PATCH_KEYS = new Set<keyof ProjectPatch>([
  "scriptJson",
  "complianceJson",
  "voiceoverTimestamps",
]);

export function updateProject(id: string, patch: ProjectPatch): Project {
  const db = getDb();
  const keys = Object.keys(patch) as (keyof ProjectPatch)[];
  if (keys.length === 0) return getProject(id)!;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const key of keys) {
    const column = PATCH_COLUMN_MAP[key];
    let value = patch[key];
    if (JSON_PATCH_KEYS.has(key) && value !== null && value !== undefined) {
      value = JSON.stringify(value) as never;
    }
    if (key === "complianceOverride") {
      value = (value ? 1 : 0) as never;
    }
    setClauses.push(`${column} = ?`);
    values.push(value ?? null);
  }
  setClauses.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
  return getProject(id)!;
}

export function deleteProject(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
}

// ---------- beats ----------

export function replaceBeats(
  projectId: string,
  beats: { text: string; visual: string; seconds: number }[]
): Beat[] {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM beats WHERE project_id = ?`).run(projectId);
    const insert = db.prepare(
      `INSERT INTO beats (id, project_id, idx, text, visual, seconds, video_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    );
    beats.forEach((b, idx) => {
      insert.run(randomUUID(), projectId, idx, b.text, b.visual, b.seconds);
    });
  });
  tx();
  return listBeats(projectId);
}

export function listBeats(projectId: string): Beat[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM beats WHERE project_id = ? ORDER BY idx ASC`)
    .all(projectId) as BeatRow[];
  return rows.map(rowToBeat);
}

export function getBeat(projectId: string, idx: number): Beat | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM beats WHERE project_id = ? AND idx = ?`)
    .get(projectId, idx) as BeatRow | undefined;
  return row ? rowToBeat(row) : null;
}

type BeatPatch = Partial<{
  videoStatus: StepStatus;
  videoError: string | null;
  videoPath: string | null;
  jobId: string | null;
}>;

const BEAT_PATCH_COLUMN_MAP: Record<keyof BeatPatch, string> = {
  videoStatus: "video_status",
  videoError: "video_error",
  videoPath: "video_path",
  jobId: "job_id",
};

export function updateBeat(projectId: string, idx: number, patch: BeatPatch): Beat | null {
  const db = getDb();
  const keys = Object.keys(patch) as (keyof BeatPatch)[];
  if (keys.length === 0) return getBeat(projectId, idx);
  const setClauses = keys.map((k) => `${BEAT_PATCH_COLUMN_MAP[k]} = ?`);
  const values = keys.map((k) => patch[k] ?? null);
  db.prepare(
    `UPDATE beats SET ${setClauses.join(", ")} WHERE project_id = ? AND idx = ?`
  ).run(...values, projectId, idx);
  return getBeat(projectId, idx);
}

// ---------- settings ----------

const SETTINGS_DEFAULTS: Record<string, string> = {
  elevenlabs_voice_id: "21m00Tcm4TlvDq8ikWAM", // ElevenLabs default "Rachel" voice
  kling_price_per_second: "0.35",
  daily_spend_cap: "20",
};

export function getSetting(key: string): string {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? SETTINGS_DEFAULTS[key] ?? "";
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as {
    key: string;
    value: string;
  }[];
  const result = { ...SETTINGS_DEFAULTS };
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

// Sum of cost_actual across all projects created today (local server time), for spend-cap checks.
export function todaySpend(): number {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const row = db
    .prepare(`SELECT COALESCE(SUM(cost_actual), 0) as total FROM projects WHERE updated_at >= ?`)
    .get(startOfDay.toISOString()) as { total: number };
  return row.total;
}
