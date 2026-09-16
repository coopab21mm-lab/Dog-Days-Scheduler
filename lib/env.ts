export interface EnvCheckResult {
  key: string;
  label: string;
  configured: boolean;
}

const REQUIRED_KEYS: { key: string; label: string }[] = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (script + compliance)" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs (voiceover)" },
  { key: "KLING_API_KEY", label: "Kling (AI video generation)" },
];

export function checkEnv(): EnvCheckResult[] {
  return REQUIRED_KEYS.map(({ key, label }) => ({
    key,
    label,
    configured: Boolean(process.env[key] && process.env[key]!.trim().length > 0),
  }));
}

export function requireEnv(key: string, label: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvError(key, label);
  }
  return value;
}

export class MissingEnvError extends Error {
  key: string;
  constructor(key: string, label: string) {
    super(
      `Missing required API key: ${key} (${label}). Add it to .env.local and restart the app.`
    );
    this.name = "MissingEnvError";
    this.key = key;
  }
}
