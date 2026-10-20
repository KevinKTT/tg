import { formatTime } from "./scoring";
import { capSecForScheme, type Scheme } from "./engine/scheme";

export type ClockKind = "up" | "capped" | "down" | "minute" | "interval";

export type ClockPlan = {
  kind: ClockKind;
  seconds: number;
  restSec: number;
  savesTime: boolean;
  label: string;
  count: number;
};

export type ClockPart = {
  id: number;
  name: string;
  kind: string;
  scoreType: string;
  timeCapSec: number | null;
  format: string;
  scheme?: Scheme | null;
};

export type ClockOption = {
  id: number;
  name: string;
  kind: string;
  scoreType: string;
  format: string;
  scheme?: Scheme | null;
  plan: ClockPlan;
};

export function sessionElapsedSec(accumulatedSec: number, runningSince: number | null, nowMs: number): number {
  const base = Math.max(0, accumulatedSec);
  if (runningSince == null) return Math.floor(base);
  return Math.floor(base + Math.max(0, nowMs - runningSince) / 1000);
}

export function roundTotal(format: string, scheme?: Scheme | null): number | null {
  if (scheme?.type === "for_time" && scheme.rounds) return scheme.rounds;
  const match = format.match(/(\d+)\s+rounds?\b/i);
  if (!match) return null;
  const total = Number(match[1]);
  return total > 0 ? total : null;
}

export function showsRoundCounter(option: Pick<ClockOption, "scoreType" | "format"> & { scheme?: Scheme | null }): boolean {
  if (option.scheme?.type === "amrap") return true;
  if (option.scheme?.type === "for_time" && option.scheme.rounds) return true;
  return option.scoreType === "rounds_reps" || roundTotal(option.format) != null || /\brounds?\s+for\s+time\b/i.test(option.format);
}

export type ClockWorkout = {
  date: string;
  athlete: string;
  defaultId: number;
  parts: ClockOption[];
};

export type ClockFace = {
  display: string;
  caption: string;
  mark: number;
};

export const PRESTART_SEC = 10;

export type PrestartCue = "tick" | "go";

export function prestartSecond(leftSec: number): number {
  if (leftSec <= 0) return 0;
  return Math.min(PRESTART_SEC, Math.ceil(leftSec));
}

export function prestartCues(previous: number, next: number): PrestartCue[] {
  if (next >= previous) return [];
  const cues: PrestartCue[] = [];
  for (let second = previous - 1; second >= next; second -= 1) {
    if (second === 0) cues.push("go");
    else if (second >= 1 && second <= 3) cues.push("tick");
  }
  return cues;
}

export const OPEN_CLOCK: ClockPlan = {
  kind: "up",
  seconds: 0,
  restSec: 0,
  savesTime: false,
  label: "Clock",
  count: 0,
};

const CLASS_KIND = new Set(["warmup", "prep", "cooldown"]);
const CLASS_NAME = /warm-?up|workout prep|cool-?down/i;

function clockable(part: ClockPart) {
  return part.scoreType !== "none" && !CLASS_KIND.has(part.kind) && !CLASS_NAME.test(part.name);
}

export function clockWorkout(dayFormat: string, date: string, athlete: string, parts: ClockPart[]): ClockWorkout | null {
  const scored = parts.filter(clockable);
  if (!scored.length) return null;
  const options = scored.map((part) => ({
    id: part.id,
    name: part.name,
    kind: part.kind,
    scoreType: part.scoreType,
    format: part.format,
    scheme: part.scheme ?? null,
    plan: clockPlan(dayFormat, part),
  }));
  const metcons = scored.filter((part) => part.kind === "metcon");
  const timed = metcons.find((part) => (part.timeCapSec && part.timeCapSec > 0) || /\d/.test(part.format));
  const chosen = timed ?? metcons[0] ?? scored[0];
  return { date, athlete, defaultId: chosen.id, parts: options };
}

export function clockPlan(dayFormat: string, part: ClockPart): ClockPlan {
  if (part.scheme) return clockPlanForScheme(part.scheme);
  const text = (part.kind === "metcon" ? `${part.format} ${dayFormat}` : part.format).toLowerCase();
  const cap = part.timeCapSec && part.timeCapSec > 0 ? part.timeCapSec : null;
  const every = readEvery(part.format);

  if (isEmom(text)) {
    const seconds = every && every > 60 ? every : 60;
    return { kind: "minute", seconds, restSec: 0, savesTime: false, label: "EMOM", count: readEmomCount(part.format) };
  }

  if (part.scoreType === "load" || (dayFormat === "heavy" && part.scoreType !== "time")) {
    return { kind: "interval", seconds: every ?? 300, restSec: 0, savesTime: false, label: "Set", count: 0 };
  }

  if (every) {
    const seconds = every > 60 ? every : 60;
    return { kind: "minute", seconds, restSec: 0, savesTime: false, label: "EMOM", count: readEmomCount(part.format) };
  }

  const split = readOnOff(part.format);
  if (split) {
    return { kind: "interval", seconds: split.work, restSec: split.rest, savesTime: false, label: "Work", count: 0 };
  }

  const duration = cap ?? readAmrap(part.format) ?? readCap(part.format);
  const amrap = dayFormat === "amrap" || /\bamrap\b/.test(text);
  if (amrap || ((part.scoreType === "reps" || part.scoreType === "rounds_reps") && duration)) {
    if (duration) return { kind: "down", seconds: duration, restSec: 0, savesTime: false, label: "AMRAP", count: 0 };
  }

  if (part.scoreType === "time" && duration && !isEmom(part.format)) {
    return { kind: "capped", seconds: duration, restSec: 0, savesTime: true, label: "Cap", count: 0 };
  }
  if (part.scoreType === "time") {
    return { kind: "up", seconds: 0, restSec: 0, savesTime: true, label: "For time", count: 0 };
  }
  return OPEN_CLOCK;
}

export function clockPlanForScheme(scheme: Scheme): ClockPlan {
  switch (scheme.type) {
    case "amrap":
      return { kind: "down", seconds: scheme.minutes * 60, restSec: 0, savesTime: false, label: "AMRAP", count: 0 };
    case "emom":
      return {
        kind: "minute",
        seconds: scheme.everySec && scheme.everySec > 0 ? scheme.everySec : 60,
        restSec: 0,
        savesTime: false,
        label: "EMOM",
        count: scheme.minutes,
      };
    case "intervals":
      return {
        kind: "interval",
        seconds: scheme.workSec,
        restSec: scheme.restSec,
        savesTime: false,
        label: scheme.task === "amrap" ? "AMRAP" : "Work",
        count: 0,
      };
    case "for_time":
    case "chipper":
    case "ladder": {
      const cap = capSecForScheme(scheme);
      return cap
        ? { kind: "capped", seconds: cap, restSec: 0, savesTime: true, label: "Cap", count: 0 }
        : { kind: "up", seconds: 0, restSec: 0, savesTime: true, label: "For time", count: 0 };
    }
    case "strength":
    case "max_load":
      return { kind: "interval", seconds: 300, restSec: 0, savesTime: false, label: "Set", count: 0 };
    case "max_reps":
      return { kind: "down", seconds: scheme.minutes * 60, restSec: 0, savesTime: false, label: "Max reps", count: 0 };
    case "skill":
      return OPEN_CLOCK;
  }
}

export function clockFace(plan: ClockPlan, elapsedSec: number): ClockFace {
  const elapsed = Math.max(0, Math.floor(elapsedSec));
  if ((plan.kind === "minute" || plan.kind === "interval") && plan.seconds <= 0) {
    return { display: formatTime(elapsed), caption: plan.label, mark: 0 };
  }
  if (plan.kind === "minute") {
    const window = Math.floor(elapsed / plan.seconds);
    if (plan.count > 0 && window >= plan.count) {
      return { display: "0:00", caption: "Done", mark: plan.count };
    }
    return {
      display: formatTime(elapsed % plan.seconds),
      caption: plan.seconds === 60 ? `Min ${window + 1}` : `Rd ${window + 1}`,
      mark: window,
    };
  }
  if (plan.kind === "interval") return intervalFace(plan, elapsed);
  if (plan.kind === "down") {
    const left = Math.max(0, plan.seconds - elapsed);
    return { display: formatTime(left), caption: plan.label, mark: left === 0 && plan.seconds > 0 ? 1 : 0 };
  }
  if (plan.kind === "capped") {
    if (elapsed < plan.seconds) return { display: formatTime(plan.seconds - elapsed), caption: plan.label, mark: 0 };
    if (elapsed === plan.seconds) return { display: "0:00", caption: plan.label, mark: 1 };
    return { display: `+${formatTime(elapsed - plan.seconds)}`, caption: "Over", mark: 1 };
  }
  return { display: formatTime(elapsed), caption: plan.label, mark: 0 };
}

export function splitElapsed(elapsedSec: number): { minutes: number; seconds: number } | null {
  const total = Math.round(elapsedSec);
  if (total <= 0) return null;
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

function intervalFace(plan: ClockPlan, elapsed: number): ClockFace {
  if (plan.restSec > 0) {
    const cycle = plan.seconds + plan.restSec;
    const window = Math.floor(elapsed / cycle);
    const into = elapsed % cycle;
    if (into < plan.seconds) {
      return { display: formatTime(plan.seconds - into), caption: "Work", mark: window * 2 };
    }
    return { display: formatTime(cycle - into), caption: "Rest", mark: window * 2 + 1 };
  }
  const window = Math.floor(elapsed / plan.seconds);
  const into = elapsed % plan.seconds;
  const left = into === 0 ? plan.seconds : plan.seconds - into;
  return { display: formatTime(left), caption: `Set ${window + 1}`, mark: window };
}

function isEmom(text: string) {
  return /\be\d*\s*mom\b|\bemom\b|every minute/.test(text);
}

function readEmomCount(format: string): number {
  const lead = format.match(/\b(?:e\d*\s*mom|emom)\s+(\d+)/i);
  if (lead) return Number(lead[1]);
  const trail = format.match(/(\d+)\s*(?:min(?:ute)?s?)?\s*(?:e\d*\s*mom|emom)\b/i);
  if (trail) return Number(trail[1]);
  const every = format.match(/every minute(?:\s+on the minute)?(?:\s+for)?\s+(\d+)/i);
  if (every) return Number(every[1]);
  const times = format.match(/(\d+)\s*(?:min(?:ute)?s?)?\s*(?:of\s+)?every minute/i);
  if (times) return Number(times[1]);
  return 0;
}

function readEvery(format: string): number | null {
  const em = format.match(/\be(\d+)\s*mom\b/i);
  if (em) return Number(em[1]) * 60;
  const clock = format.match(/every\s+(\d+)\s*:\s*(\d+)/i);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const mins = format.match(/every\s+(\d+)\s*(?:min|mins|minute|minutes)/i);
  if (mins) return Number(mins[1]) * 60;
  const secs = format.match(/every\s+(\d+)\s*(?:sec|secs|second|seconds)/i);
  if (secs) return Number(secs[1]);
  return null;
}

function readAmrap(format: string): number | null {
  const clock = format.match(/amrap\s+(\d+)\s*:\s*(\d+)/i) || format.match(/(\d+)\s*:\s*(\d+)\s*amrap/i);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const mins = format.match(/amrap\s+(\d+)/i) || format.match(/(\d+)\s*(?:min|mins|minute|minutes)\s*amrap/i);
  if (!mins) return null;
  const n = Number(mins[1]);
  return n > 0 ? n * 60 : null;
}

function readCap(format: string): number | null {
  const clock = format.match(/\bcap\s+(\d+)\s*:\s*(\d+)/i);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const mins = format.match(/\bcap\s+(\d+)/i);
  if (!mins) return null;
  const n = Number(mins[1]);
  return n > 0 ? n * 60 : null;
}

function readOnOff(format: string): { work: number; rest: number } | null {
  const match = format.match(/(.+?)\bon\b\s*\/\s*(.+?)\boff\b/i);
  if (!match) return null;
  const work = readSpan(match[1]);
  const rest = readSpan(match[2]);
  if (!work || !rest) return null;
  return { work, rest };
}

function readSpan(source: string): number | null {
  const clock = source.match(/(\d+)\s*:\s*(\d+)/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const unit = source.match(/(\d+)\s*(sec|secs|seconds|min|mins|minutes)/i);
  if (unit) {
    const n = Number(unit[1]);
    return /min/i.test(unit[2]) ? n * 60 : n;
  }
  const bare = source.match(/(\d+)\s*$/);
  if (!bare) return null;
  const n = Number(bare[1]);
  return n > 0 ? n : null;
}
