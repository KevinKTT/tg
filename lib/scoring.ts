export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export function parseTime(minutes: number, seconds: number): number | null {
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

export function roundsValue(rounds: number, reps: number): number {
  return rounds * 10000 + reps;
}

export function formatRounds(value: number): string {
  const rounds = Math.floor(value / 10000);
  const reps = Math.round(value - rounds * 10000);
  return `${rounds}+${reps}`;
}

export function lbFrom(value: number, unit: "lb" | "kg"): number {
  return unit === "kg" ? value * 2.2046226218 : value;
}

export function fromLb(lb: number, unit: "lb" | "kg"): number {
  return unit === "kg" ? lb / 2.2046226218 : lb;
}

export function roundLoad(value: number, unit: "lb" | "kg"): number {
  if (unit === "kg") return Math.round(value * 10) / 10;
  return Math.round(value);
}

export function formatLoad(lb: number, unit: "lb" | "kg"): string {
  const shown = roundLoad(fromLb(lb, unit), unit);
  return `${shown} ${unit}`;
}

export function higherIsBetter(kind: string): boolean {
  return kind !== "time";
}

export function isBetter(kind: string, candidate: number, current: number): boolean {
  return higherIsBetter(kind) ? candidate > current : candidate < current;
}

export type ScoreInput = {
  scoreType: string;
  minutes?: number;
  seconds?: number;
  reps?: number;
  rounds?: number;
  load?: number;
  unit?: "lb" | "kg";
};

export function normalizeScore(input: ScoreInput): { value: number; display: string } | null {
  if (input.scoreType === "time") {
    const value = parseTime(input.minutes ?? 0, input.seconds ?? 0);
    if (value == null) return null;
    return { value, display: formatTime(value) };
  }
  if (input.scoreType === "reps") {
    const reps = input.reps ?? NaN;
    if (!Number.isFinite(reps) || reps < 0) return null;
    return { value: reps, display: String(Math.round(reps)) };
  }
  if (input.scoreType === "rounds_reps") {
    const rounds = input.rounds ?? NaN;
    const reps = input.reps ?? NaN;
    if (!Number.isFinite(rounds) || !Number.isFinite(reps) || rounds < 0 || reps < 0) return null;
    return { value: roundsValue(Math.round(rounds), Math.round(reps)), display: `${Math.round(rounds)}+${Math.round(reps)}` };
  }
  if (input.scoreType === "load") {
    const load = input.load ?? NaN;
    if (!Number.isFinite(load) || load <= 0) return null;
    const unit = input.unit === "kg" ? "kg" : "lb";
    return { value: lbFrom(load, unit), display: `${roundLoad(load, unit)} ${unit}` };
  }
  if (input.scoreType === "done") return { value: 1, display: "Done" };
  return null;
}
