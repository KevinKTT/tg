export type JsonMode = "schema" | "object" | "none";

export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type ProviderConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
  jsonMode: JsonMode;
  reasoningEffort: ReasoningEffort | null;
};

export type EnvReader = (name: string) => string;

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-4o-mini";
export const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";

function parseJsonMode(value: string): JsonMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "object" || normalized === "none") return normalized;
  return "schema";
}

function parseEffort(value: string): ReasoningEffort | null {
  const normalized = value.trim().toLowerCase();
  return (REASONING_EFFORTS as readonly string[]).includes(normalized) ? (normalized as ReasoningEffort) : null;
}

export function resolveProvider(get: EnvReader): ProviderConfig {
  const baseURL = get("AI_BASE_URL") || DEFAULT_BASE_URL;
  const explicitEffort = parseEffort(get("AI_REASONING_EFFORT"));
  return {
    apiKey: get("AI_API_KEY") || get("FIREWORKS_API_KEY"),
    baseURL,
    model: get("AI_MODEL") || DEFAULT_MODEL,
    jsonMode: parseJsonMode(get("AI_JSON_MODE")),
    reasoningEffort: explicitEffort ?? (/fireworks/i.test(baseURL) ? "none" : null),
  };
}

export function modeOrder(mode: JsonMode): JsonMode[] {
  if (mode === "none") return ["none"];
  if (mode === "object") return ["object", "none"];
  return ["schema", "object", "none"];
}

export function isFormatError(error: unknown): boolean {
  const value = error as { status?: number; message?: unknown } | null;
  if (typeof value?.status === "number" && value.status !== 400) return false;
  const message =
    error instanceof Error ? error.message : typeof value?.message === "string" ? value.message : String(error ?? "");
  return /schema|response_format|json|unsupported|not supported/i.test(message);
}
