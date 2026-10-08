export type FormatId =
  | "for_time"
  | "amrap"
  | "emom"
  | "rounds"
  | "chipper"
  | "interval"
  | "heavy"
  | "benchmark"
  | "skill_metcon"
  | "ladder";

export type FormatDef = {
  id: FormatId;
  label: string;
  brief: string;
  focuses: string[];
  needsLoad?: boolean;
  needsBarbell?: boolean;
};

export const FORMATS: FormatDef[] = [
  {
    id: "for_time",
    label: "For Time",
    brief: "A fixed amount of work to complete as fast as possible. Score is time.",
    focuses: ["mixed", "cardio", "engine", "gymnastics", "strength", "heavy", "olympic"],
  },
  {
    id: "amrap",
    label: "AMRAP",
    brief: "As many rounds or reps as possible in a fixed time window. Score is reps or rounds+reps.",
    focuses: ["mixed", "cardio", "engine", "gymnastics"],
  },
  {
    id: "emom",
    label: "EMOM",
    brief: "Every minute on the minute: a set amount of work at the top of each minute for a fixed number of minutes.",
    focuses: ["strength", "heavy", "cardio", "engine", "mixed", "olympic", "gymnastics"],
  },
  {
    id: "rounds",
    label: "Rounds for Time",
    brief: "A fixed number of rounds to complete as fast as possible. Score is time.",
    focuses: ["mixed", "strength", "heavy", "cardio", "engine", "gymnastics", "olympic"],
  },
  {
    id: "chipper",
    label: "Chipper",
    brief: "A long list of movements done once through, in order, for time.",
    focuses: ["mixed", "cardio", "engine"],
  },
  {
    id: "interval",
    label: "Intervals",
    brief: "Repeated work and rest intervals, such as Tabata or 4x2:00 on / 1:00 off.",
    focuses: ["cardio", "engine", "mixed"],
  },
  {
    id: "heavy",
    label: "Heavy Day",
    brief: "Build to a heavy set of 5, 3, or 1 on a primary lift. Score is load. No conditioning piece.",
    focuses: ["strength", "heavy", "olympic"],
    needsLoad: true,
  },
  {
    id: "benchmark",
    label: "Benchmark",
    brief: "A named classic benchmark workout, such as Fran, Cindy, or Helen.",
    focuses: ["mixed", "cardio", "strength"],
    needsBarbell: true,
  },
  {
    id: "skill_metcon",
    label: "Skill + Metcon",
    brief: "A short skill or gymnastics practice, then a brief conditioning piece.",
    focuses: ["gymnastics", "mixed", "strength"],
  },
  {
    id: "ladder",
    label: "Ladder",
    brief: "Ascending or descending reps or loads across rounds.",
    focuses: ["mixed", "cardio", "engine", "strength", "heavy", "gymnastics", "olympic"],
  },
];

const BY_ID = new Map(FORMATS.map((format) => [format.id, format]));

export function formatById(id: string): FormatDef | undefined {
  return BY_ID.get(id as FormatId);
}

export function formatLabel(id: string): string {
  return BY_ID.get(id as FormatId)?.label ?? "";
}

export function formatFromScheme(text: string): FormatId | null {
  const value = text.toLowerCase();
  if (/\bamrap\b/.test(value)) return "amrap";
  if (/\be\d*\s*mom\b|\bemom\b|every minute/.test(value)) return "emom";
  if (/\bon\b\s*\/\s*\S+\s*off\b|\bintervals?\b/.test(value)) return "interval";
  if (/\bchipper\b/.test(value)) return "chipper";
  if (/\b\d+\s*rounds?\b/.test(value)) return "rounds";
  if (/\bfor time\b/.test(value)) return "for_time";
  return null;
}

export function formatFitsGear(format: FormatDef, caps: Set<string>): boolean {
  if (format.needsBarbell && !caps.has("barbell")) return false;
  if (format.needsLoad) {
    return caps.has("barbell") || caps.has("dumbbell") || caps.has("kettlebell") || caps.has("plates");
  }
  return true;
}

export function formatPool(focus: string, caps: Set<string>): FormatDef[] {
  const geared = FORMATS.filter((format) => formatFitsGear(format, caps));
  const byFocus = geared.filter((format) => format.focuses.includes(focus));
  return byFocus.length ? byFocus : geared;
}

export function pickFormat(focus: string, caps: Set<string>, recent: string[]): FormatDef {
  const pool = formatPool(focus, caps);
  const fresh = pool.filter((format) => !recent.includes(format.id));
  const choices = fresh.length ? fresh : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}
