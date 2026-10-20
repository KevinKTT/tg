/**
 * One canonical description of a workout's structure.
 *
 * The scheme is the single source of truth for:
 * - the whiteboard label ("AMRAP 16", "5 rounds for time", ...)
 * - how the piece is scored (time, rounds + reps, done, load, reps)
 * - which clock the UI shows
 * - which fields the score form asks for
 *
 * Nothing else in the app is allowed to re-infer those from free text.
 */
export type SchemeType =
  | "for_time"
  | "amrap"
  | "emom"
  | "intervals"
  | "chipper"
  | "ladder"
  | "strength"
  | "max_load"
  | "max_reps"
  | "skill";

export type ScoreType = "time" | "reps" | "rounds_reps" | "load" | "done" | "none";

export type ForTimeScheme = {
  type: "for_time";
  rounds?: number;
  repScheme?: number[];
  capMin?: number;
};

export type AmrapScheme = { type: "amrap"; minutes: number };
export type EmomScheme = { type: "emom"; minutes: number; everySec?: number };

export type IntervalScheme = {
  type: "intervals";
  rounds: number;
  workSec: number;
  restSec: number;
  task: "amrap" | "fixed";
};

export type ChipperScheme = { type: "chipper"; capMin?: number };
export type LadderScheme = { type: "ladder"; reps: number[]; capMin?: number };

export type StrengthScheme = {
  type: "strength";
  sets: number;
  reps: string;
  intent: "moderate" | "heavy";
};

export type MaxLoadScheme = { type: "max_load"; repMax: number };
export type MaxRepsScheme = { type: "max_reps"; minutes: number };
export type SkillScheme = { type: "skill"; minutes: number };

export type Scheme =
  | ForTimeScheme
  | AmrapScheme
  | EmomScheme
  | IntervalScheme
  | ChipperScheme
  | LadderScheme
  | StrengthScheme
  | MaxLoadScheme
  | MaxRepsScheme
  | SkillScheme;

export const SCHEME_TYPES: SchemeType[] = [
  "for_time",
  "amrap",
  "emom",
  "intervals",
  "chipper",
  "ladder",
  "strength",
  "max_load",
  "max_reps",
  "skill",
];

export function scoreTypeForScheme(scheme: Scheme): ScoreType {
  switch (scheme.type) {
    case "for_time":
    case "chipper":
    case "ladder":
      return "time";
    case "amrap":
      return "rounds_reps";
    case "emom":
      return "done";
    case "intervals":
      return scheme.task === "amrap" ? "reps" : "done";
    case "strength":
      return "done";
    case "max_load":
      return "load";
    case "max_reps":
      return "reps";
    case "skill":
      return "none";
  }
}

export function scoreDirectionForScheme(scheme: Scheme): "asc" | "desc" {
  return scoreTypeForScheme(scheme) === "time" ? "asc" : "desc";
}

export function isScored(scheme: Scheme): boolean {
  return scoreTypeForScheme(scheme) !== "none";
}

/** The cap shown next to a scheme, in seconds. Only time-scored pieces can carry one. */
export function capSecForScheme(scheme: Scheme): number | null {
  const scoreType = scoreTypeForScheme(scheme);
  if (scoreType !== "time") return null;
  if (scheme.type === "for_time" || scheme.type === "chipper" || scheme.type === "ladder") {
    return scheme.capMin && scheme.capMin > 0 ? Math.round(scheme.capMin * 60) : null;
  }
  return null;
}

export function formatText(scheme: Scheme): string {
  switch (scheme.type) {
    case "for_time":
      if (scheme.repScheme?.length) return `${scheme.repScheme.join("-")} for time`;
      if (scheme.rounds && scheme.rounds > 0) return `${scheme.rounds} rounds for time`;
      return "For time";
    case "amrap":
      return `AMRAP ${scheme.minutes}`;
    case "emom":
      return scheme.everySec && scheme.everySec !== 60
        ? `Every ${formatSpan(scheme.everySec)} for ${scheme.minutes} min`
        : `EMOM ${scheme.minutes}`;
    case "intervals":
      return `${scheme.rounds} rounds: ${formatSpan(scheme.workSec)} ${scheme.task === "amrap" ? "AMRAP" : "work"} / ${formatSpan(scheme.restSec)} rest`;
    case "chipper":
      return "Chipper for time";
    case "ladder":
      return `${scheme.reps.join("-")} ladder for time`;
    case "strength":
      return `${scheme.sets} x ${scheme.reps}`;
    case "max_load":
      return scheme.repMax === 1 ? "Build to a heavy single" : `Build to a heavy ${scheme.repMax}`;
    case "max_reps":
      return `${scheme.minutes} min max reps`;
    case "skill":
      return `${scheme.minutes} min practice`;
  }
}

/** Expected work time for a scheme, used for class budgeting. */
export function schemeMinutes(scheme: Scheme): number {
  switch (scheme.type) {
    case "amrap":
    case "emom":
    case "max_reps":
    case "skill":
      return scheme.minutes;
    case "intervals":
      return Math.max(1, Math.round((scheme.rounds * (scheme.workSec + scheme.restSec)) / 60));
    case "for_time":
    case "chipper":
    case "ladder":
      return scheme.capMin ?? 15;
    case "strength":
      return 15;
    case "max_load":
      return 20;
  }
}

export function formatSpan(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}:00`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function parseScheme(raw: string | null | undefined): Scheme | null {
  if (!raw?.trim()) return null;
  try {
    const value = JSON.parse(raw) as Partial<Scheme>;
    if (!value || typeof value !== "object") return null;
    return validateSchemeShape(value as Scheme) ? (value as Scheme) : null;
  } catch {
    return null;
  }
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateSchemeShape(scheme: Scheme): boolean {
  switch (scheme.type) {
    case "for_time":
      return (
        (scheme.rounds == null || positiveInt(scheme.rounds)) &&
        (scheme.repScheme == null || (Array.isArray(scheme.repScheme) && scheme.repScheme.every(positiveInt))) &&
        (scheme.capMin == null || positiveInt(scheme.capMin))
      );
    case "amrap":
      return positiveInt(scheme.minutes);
    case "emom":
      return positiveInt(scheme.minutes) && (scheme.everySec == null || positiveInt(scheme.everySec));
    case "intervals":
      return (
        positiveInt(scheme.rounds) &&
        positiveInt(scheme.workSec) &&
        positiveInt(scheme.restSec) &&
        (scheme.task === "amrap" || scheme.task === "fixed")
      );
    case "chipper":
      return scheme.capMin == null || positiveInt(scheme.capMin);
    case "ladder":
      return Array.isArray(scheme.reps) && scheme.reps.length >= 2 && scheme.reps.every(positiveInt);
    case "strength":
      return positiveInt(scheme.sets) && typeof scheme.reps === "string" && scheme.reps.trim().length > 0;
    case "max_load":
      return positiveInt(scheme.repMax);
    case "max_reps":
      return positiveInt(scheme.minutes);
    case "skill":
      return positiveInt(scheme.minutes);
    default:
      return false;
  }
}

export type SchemeKindHint = "strength" | "metcon" | "skill" | string;

/**
 * Legacy adapter for workouts saved before the structured scheme existed.
 * New code never creates rows through this path.
 */
export function schemeFromLegacy(input: {
  format: string;
  scoreType?: string;
  kind?: SchemeKindHint;
  capMin?: number | null;
}): Scheme {
  const text = input.format.toLowerCase();
  const kind = input.kind ?? "metcon";
  const capMin = input.capMin && input.capMin > 0 ? input.capMin : undefined;

  if (kind === "skill") return { type: "skill", minutes: 10 };
  if (/\bamrap\b/.test(text)) {
    const minutes = readNumber(text, /amrap\s+(\d+)/) ?? readNumber(text, /(\d+)\s*(?:min|minute)/) ?? 12;
    return { type: "amrap", minutes };
  }
  if (/\be\d*\s*mom\b|\bemom\b|every minute/.test(text)) {
    return { type: "emom", minutes: readNumber(text, /(\d+)\s*(?:min|minute)/) ?? 10 };
  }
  if (/\bon\b\s*\/\s*.+\boff\b|\btabata\b/.test(text)) {
    const work = readClock(text, /(\d+(?::\d+)?)\s*(?:sec|secs|seconds|min|mins|minutes)?\s*on/i) ?? 120;
    const rest = readClock(text, /(?:on\b.*?\/\s*)(\d+(?::\d+)?)\s*(?:sec|secs|seconds|min|mins|minutes)?\s*off/i) ?? 60;
    return { type: "intervals", rounds: readNumber(text, /(\d+)\s*rounds?/) ?? 4, workSec: work, restSec: rest, task: "fixed" };
  }
  if (/\bchipper\b/.test(text)) return { type: "chipper", capMin };
  if (/\bladder\b/.test(text)) return { type: "ladder", reps: [21, 15, 9], capMin };
  if (kind === "strength" || /\b(?:build to|heavy|1\s?rm|one[- ]rep max)\b/.test(text)) {
    const repMax = readNumber(text, /heavy\s+(\d+)/) ?? readNumber(text, /(\d+)\s?rm/) ?? 3;
    return { type: "max_load", repMax };
  }
  const rounds = readNumber(text, /(\d+)\s*rounds?/);
  return { type: "for_time", rounds: rounds ?? undefined, capMin };
}

function readNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function readClock(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const raw = match[1];
  if (raw.includes(":")) {
    const [minutes, seconds] = raw.split(":").map(Number);
    return minutes * 60 + seconds;
  }
  return Number(raw);
}
