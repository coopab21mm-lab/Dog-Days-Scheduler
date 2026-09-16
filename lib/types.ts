export type StepStatus = "pending" | "running" | "done" | "failed";

export type ProjectStatus =
  | "draft"
  | "script"
  | "compliance"
  | "voice"
  | "captions"
  | "video"
  | "assembling"
  | "ready"
  | "failed";

export interface ScriptBeat {
  text: string;
  visual: string;
  seconds: number;
}

export interface Script {
  title: string;
  hook: string;
  beats: ScriptBeat[];
  closeLine: string;
}

export type ComplianceVerdict =
  | "looks fine"
  | "minor fixes suggested"
  | "risky — fix before posting";

export interface ComplianceRisk {
  issue: string;
  why: string;
  fix: string;
}

export interface ComplianceResult {
  verdict: ComplianceVerdict;
  risks: ComplianceRisk[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface Beat {
  id: string;
  projectId: string;
  idx: number;
  text: string;
  visual: string;
  seconds: number;
  videoStatus: StepStatus;
  videoError: string | null;
  videoPath: string | null;
  jobId: string | null;
}

export interface Project {
  id: string;
  role: string;
  tone: string;
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

  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithBeats extends Project {
  beats: Beat[];
}

export const TONE_OPTIONS = [
  "grounded & cinematic",
  "warm & intimate",
  "tense & urgent",
  "wry & observational",
  "reverent & quiet",
] as const;

export const ERA_PRESETS = [
  "A young samurai retainer, Kyoto, Japan, 1603",
  "A dockworker in ancient Alexandria, Egypt, 200 BCE",
  "A weaver's apprentice in medieval Florence, Italy, 1350",
  "A homesteader on the American prairie, Nebraska, 1888",
  "A silk road caravan trader near Samarkand, 1350",
  "A Roman legionary stationed at Hadrian's Wall, 130 CE",
] as const;
