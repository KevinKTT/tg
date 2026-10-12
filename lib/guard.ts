import { scanMovements } from "./program";

export type GuardItem = {
  slug: string;
  name: string;
  category: string;
  owned: boolean;
  loadValue: number | null;
  unit: string | null;
};

export type GuardPart = {
  name: string;
  details: string;
  equipment: string[];
};

export type GuardTrack = {
  summary?: string;
  warmup: string;
  prep?: string;
  cooldown: string;
  parts: GuardPart[];
};

export type ProgramCheck = {
  load: "heavy" | "moderate" | "light";
  allowRun: boolean;
  allowHeavy: boolean;
};

const KEYWORDS: { pattern: RegExp; cap: string; label: string }[] = [
  { pattern: /\b(row erg|rower|concept\s?2|\d+\s*m\s+rows?|rows?\s+\d+|(?:cal|calorie)s?\s+rows?)\b/i, cap: "rower", label: "rower" },
  { pattern: /\b(assault bike|echo bike|air bike|airdyne)\b/i, cap: "air_bike", label: "air bike" },
  { pattern: /\bski\s?erg\b/i, cap: "ski_erg", label: "SkiErg" },
  { pattern: /\bbike\s?erg\b/i, cap: "bike_erg", label: "BikeErg" },
  { pattern: /\bwall\s?balls?\b/i, cap: "wall_ball", label: "wall ball" },
  { pattern: /\bmedicine balls?\b|\bmed\s?balls?\b/i, cap: "med_ball", label: "med ball" },
  { pattern: /\bslam balls?\b/i, cap: "slam_ball", label: "slam ball" },
  { pattern: /\b(ghd|glute[- ]ham)\b/i, cap: "ghd", label: "GHD" },
  { pattern: /\b(rope climbs?|climbing rope)\b/i, cap: "climb_rope", label: "climbing rope" },
  { pattern: /\bring muscle-?ups?\b/i, cap: "rings", label: "rings" },
  { pattern: /\brings\b/i, cap: "rings", label: "rings" },
  { pattern: /\b(pull-?ups?|chest-to-bar|chest to bar|toes-to-bar|toes to bar|kipping(?!\s+handstand)|bar muscle-?ups?)\b/i, cap: "pullup_bar", label: "pull-up bar" },
  { pattern: /\b(double-?unders?|single-?unders?|jump ropes?)\b/i, cap: "jump_rope", label: "jump rope" },
  { pattern: /\b(?:weighted\s+vests?|weight\s+vests?|vests?)\b/i, cap: "weight_vest", label: "weight vest" },
  { pattern: /\bkettlebells?\b|\bkbs?\b/i, cap: "kettlebell", label: "kettlebell" },
  { pattern: /\bdumbbells?\b|\bdbs?\b/i, cap: "dumbbell", label: "dumbbell" },
  { pattern: /\bbox jumps?\b/i, cap: "box", label: "box" },
  { pattern: /\bsled\b/i, cap: "sled", label: "sled" },
  { pattern: /\bsandbag\b/i, cap: "sandbag", label: "sandbag" },
  { pattern: /\bpegboard\b/i, cap: "pegboard", label: "pegboard" },
  { pattern: /\b(run|running)\b/i, cap: "running", label: "running" },
];

const BARBELL_EXPLICIT = /\bbarbells?\b|\b(?:men'?s|women'?s|technique|trap)\s+bar\b/i;

const BARBELL_MOVEMENTS =
  /\b(deadlifts?|cleans?|snatches?|thrusters?|(?:front|back|overhead)\s+squats?|(?:push|split)\s+jerks?)\b/i;

const OWNED_SUBSTITUTES =
  /\b(dumbbells?|dbs?|kettlebells?|kbs?|goblet|wall\s?balls?|medicine balls?|med\s?balls?|slam\s?balls?|sandbags?|d-?balls?|farmer'?s?\s+handles?|weight(?:ed)?\s+vests?|air\s+squats?|bodyweight|pistols?|split\s+squats?|bulgarian\s+split\s+squats?)\b/i;

export function capabilities(items: GuardItem[]): Set<string> {
  const caps = new Set<string>(["bodyweight"]);
  for (const item of items) {
    if (!item.owned) continue;
    caps.add(item.slug);
    if (item.slug === "mens_bar" || item.slug === "womens_bar" || item.slug === "technique_bar") caps.add("barbell");
    if (item.category === "kettlebell") caps.add("kettlebell");
    if (item.category === "dumbbell") caps.add("dumbbell");
    if (item.slug.startsWith("wall_ball")) caps.add("wall_ball");
    if (item.slug.startsWith("med_ball")) caps.add("med_ball");
    if (item.slug.startsWith("slam_ball")) caps.add("slam_ball");
    if (item.slug.startsWith("box_")) caps.add("box");
    if (item.category === "plates") caps.add("plates");
    const pounds = item.loadValue == null ? 0 : item.unit === "kg" ? item.loadValue * 2.2046226218 : item.loadValue;
    if ((item.category === "dumbbell" || item.category === "kettlebell") && pounds >= 35) caps.add("heavier_load");
  }
  if (caps.has("barbell")) caps.add("heavier_load");
  return caps;
}

function ownedImplements(items: GuardItem[], category: string) {
  return items.filter((item) => item.owned && item.category === category && item.loadValue != null && item.unit);
}

function matchesImplement(items: GuardItem[], category: string, value: number, unit: string): boolean {
  return ownedImplements(items, category).some((item) => {
    if (!item.loadValue || !item.unit) return false;
    if (item.unit === unit) return Math.abs(item.loadValue - value) < 0.26;
    const left = item.unit === "kg" ? item.loadValue * 2.2046226218 : item.loadValue;
    const right = unit === "kg" ? value * 2.2046226218 : value;
    return Math.abs(left - right) < 0.6;
  });
}

function prescribedLoads(text: string, category: "kettlebell" | "dumbbell" | "odd", noun: string) {
  const hits: { value: number; unit: string }[] = [];
  const first = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(kg|lb)\\s*(?:${noun})`, "gi");
  const second = new RegExp(`(?:${noun})\\s*(?:@|at)?\\s*(\\d+(?:\\.\\d+)?)\\s*(kg|lb)`, "gi");
  for (const match of text.matchAll(first)) hits.push({ value: Number(match[1]), unit: match[2].toLowerCase() });
  for (const match of text.matchAll(second)) hits.push({ value: Number(match[1]), unit: match[2].toLowerCase() });
  return hits.map((hit) => ({ ...hit, category }));
}

function toPounds(value: number, unit: string): number {
  return unit === "kg" ? value * 2.2046226218 : value;
}

function heavyRxViolation(summary: string, items: GuardItem[]): string | null {
  if (!/\d+\s*(kg|lb)/i.test(summary) && !/%/.test(summary)) return "heavy day is missing an Rx load";
  const lines = summary.split("\n").filter((line) => /\brx\b/i.test(line) && !/%/.test(line));
  const loads: { value: number; unit: string }[] = [];
  for (const line of lines) {
    for (const match of line.matchAll(/(\d+(?:\.\d+)?)\s*(kg|lb)/gi)) {
      loads.push({ value: Number(match[1]), unit: match[2].toLowerCase() });
    }
  }
  if (!loads.length) return null;
  const prescribed = loads.reduce((best, load) => (toPounds(load.value, load.unit) > toPounds(best.value, best.unit) ? load : best));
  for (const category of ["dumbbell", "kettlebell"] as const) {
    const owned = items.filter((item) => item.owned && item.category === category && item.loadValue != null && item.unit);
    if (owned.length < 2) continue;
    const lightest = owned.reduce((best, item) => (toPounds(item.loadValue ?? 0, item.unit ?? "lb") < toPounds(best.loadValue ?? 0, best.unit ?? "lb") ? item : best));
    if (matchesImplement([lightest], category, prescribed.value, prescribed.unit)) {
      return `Rx uses the lightest ${category}. Use a heavier owned implement.`;
    }
  }
  return null;
}

export type SchemePart = {
  name: string;
  kind: string;
  format: string;
  details?: string;
  scoreType: string;
  timeCapMin: number | null;
};

export type DurationPart = {
  name: string;
  estimatedDurationMin: number | null;
};

const CLOCK_SCHEME = /\b(amrap|e\d*\s*mom|emom|every minute(?:\s+on the minute)?|\d+\s*rounds?\s+for\s+time|for time|cap\s+\d+)\b/i;
const CLASS_NAME = /warm-?up|workout prep|^prep$|cool-?down/i;

export function schemeViolations(input: {
  warmup: string;
  prep?: string;
  cooldown: string;
  parts: SchemePart[];
}): string[] {
  const problems: string[] = [];
  const intro = [input.warmup, input.prep ?? "", input.cooldown].join("\n");
  if (CLOCK_SCHEME.test(intro)) {
    problems.push("warm-up, prep, or cool-down contains the metcon scheme. Put the scheme only on the scored piece.");
  }
  const classPart = input.parts.find((part) => CLASS_NAME.test(part.name) && (part.scoreType !== "none" || part.timeCapMin));
  if (classPart) {
    problems.push(`${classPart.name} is not scored and has no clock. Put the scheme on the metcon.`);
  }
  const metcons = input.parts.filter(
    (part) => part.kind === "metcon" && part.scoreType !== "none" && !CLASS_NAME.test(part.name),
  );
  for (const part of metcons) {
    if (!/\d/.test(part.format)) {
      problems.push(`${part.name} format is missing its count. Write "5 rounds for time" or "AMRAP 12", not the label alone.`);
    }
  }
  if (metcons.length) {
    for (const part of input.parts) {
      if (part.timeCapMin && !metcons.includes(part)) {
        problems.push(`timeCapMin belongs on the metcon, not ${part.name}.`);
      }
    }
  }
  return problems;
}

export function sessionDurationViolations(input: {
  warmupDurationMin: number | null;
  prepDurationMin: number | null;
  cooldownDurationMin: number | null;
  parts: DurationPart[];
}): string[] {
  const sections = [
    { name: "warm-up", value: input.warmupDurationMin },
    { name: "workout prep", value: input.prepDurationMin },
    ...input.parts.map((part) => ({ name: part.name, value: part.estimatedDurationMin })),
    { name: "cool-down", value: input.cooldownDurationMin },
  ];
  const missing = sections.filter((section) => section.value == null || !Number.isFinite(section.value));
  if (missing.length) {
    return [`estimated duration is missing for ${missing.map((section) => section.name).join(", ")}`];
  }
  const problems: string[] = [];
  if ((input.warmupDurationMin ?? 0) < 8 || (input.warmupDurationMin ?? 0) > 12) {
    problems.push("warm-up estimate must be 8-12 minutes");
  }
  if ((input.prepDurationMin ?? 0) < 5 || (input.prepDurationMin ?? 0) > 10) {
    problems.push("workout prep estimate must be 5-10 minutes");
  }
  if ((input.cooldownDurationMin ?? 0) < 3 || (input.cooldownDurationMin ?? 0) > 7) {
    problems.push("cool-down estimate must be 3-7 minutes");
  }
  const work = input.parts.reduce((sum, part) => sum + (part.estimatedDurationMin ?? 0), 0);
  if (work < 24 || work > 40) problems.push("workout pieces must total 24-40 minutes");
  const total = sections.reduce((sum, section) => sum + (section.value ?? 0), 0);
  if (total < 45 || total > 60) {
    problems.push(`estimated session duration is ${total} minutes; make the complete session 45-60 minutes, centered on about 50`);
  }
  return problems;
}

export function scalingFindings(summary: string, usesLoad = true): string[] {
  if (!usesLoad) return [];
  const block = summary.match(/Loads:\s*([\s\S]*)/i)?.[1] ?? "";
  if (!block.trim()) {
    return ["the summary has no Loads: block; add one line each for Rx, Performance, and Lifestyle"];
  }
  const lower = block.toLowerCase();
  const missing = (["rx", "performance", "lifestyle"] as const).filter((tier) => !new RegExp(`\\b${tier}\\b`, "i").test(lower));
  return missing.length ? [`the Loads: block is missing ${missing.join(", ")}`] : [];
}

const LOAD_WORD = /\b(dumbbells?|kettlebells?|barbells?|weight(?:ed)?\s+vests?|wall\s?balls?|medicine\s+balls?|med\s?balls?|sandbags?|plates?|farmers?|goblet|thrusters?|snatches?|cleans?|deadlifts?|presses?|jerks?)\b/i;

export function usesExternalLoad(input: { summary: string; parts: { name: string; format: string; details: string; equipment: string[] }[] }): boolean {
  const text = [input.summary, ...input.parts.map((part) => `${part.name} ${part.format} ${part.details} ${part.equipment.join(" ")}`)].join("\n");
  return LOAD_WORD.test(text);
}

export type ReviewPart = {
  name: string;
  kind: string;
  format: string;
  details: string;
  equipment: string[];
  scoreType: string;
  timeCapMin: number | null;
  estimatedDurationMin: number | null;
};

const INTERVAL_WINDOW = /\bon\b\s*\/\s*.+\boff\b|\btabata\b/i;
const FIXED_DOSE = /(?:^|\n)\s*\d+\s+[a-z]/i;
const ALLOWS_AMRAP = /\bamrap\b|as many|\bmax(?:imum)?\b/i;

export function coherenceFindings(parts: SchemePart[], caps?: Set<string>): string[] {
  const problems: string[] = [];
  const metcons = parts.filter((part) => part.kind === "metcon" && part.scoreType !== "none");
  if (metcons.length > 1) {
    problems.push("there is more than one scored metcon; combine them into one coherent piece");
  }
  for (const part of metcons) {
    const scheme = part.format.toLowerCase();
    const body = (part.details ?? "").toLowerCase();
    const both = `${scheme} ${body}`;
    if (/\bamrap\b/.test(scheme) && part.scoreType !== "rounds_reps") {
      problems.push(`${part.name} is an AMRAP but is not scored by rounds + reps`);
    }
    if (/\be\d*\s*mom\b|\bemom\b|every minute/.test(scheme) && part.scoreType !== "done") {
      problems.push(`${part.name} is an EMOM but is not scored as done`);
    }
    if (INTERVAL_WINDOW.test(scheme) && part.scoreType !== "done" && part.scoreType !== "reps") {
      problems.push(`${part.name} is an interval but is not scored as done or reps`);
    }
    if (/\bfor time\b|\bchipper\b|\bladder\b/.test(scheme) && part.scoreType !== "time") {
      problems.push(`${part.name} is for time but is not scored by time`);
    }
    if (INTERVAL_WINDOW.test(scheme) && FIXED_DOSE.test(body) && !ALLOWS_AMRAP.test(both)) {
      problems.push(`${part.name} lists fixed reps inside a timed interval; make each work window an AMRAP or state the task`);
    }
  }
  if (caps && !caps.has("heavier_load")) {
    for (const part of parts) {
      if (part.kind === "strength" && part.scoreType === "load") {
        problems.push(`${part.name} is scored by load, but no heavy implement is owned; use rep-based strength scored as done`);
      }
    }
  }
  return problems;
}

export type ReviewWorkout = {
  summary: string;
  warmup: string;
  prep?: string;
  cooldown: string;
  warmupDurationMin: number | null;
  prepDurationMin: number | null;
  cooldownDurationMin: number | null;
  parts: ReviewPart[];
};

export function reviewWorkout(input: { parsed: ReviewWorkout; items: GuardItem[]; check?: ProgramCheck }): string[] {
  const parsed = input.parsed;
  const caps = capabilities(input.items);
  const parts = parsed.parts.map((part) => ({
    name: part.name,
    kind: part.kind,
    format: part.format,
    details: part.details,
    equipment: part.equipment,
    scoreType: part.scoreType,
    timeCapMin: part.timeCapMin,
    estimatedDurationMin: part.estimatedDurationMin,
  }));
  return [
    ...new Set([
      ...guardWorkout(
        {
          day: {
            summary: parsed.summary,
            warmup: parsed.warmup,
            prep: parsed.prep,
            cooldown: parsed.cooldown,
            parts,
          },
        },
        input.items,
        input.check,
      ),
      ...schemeViolations({ warmup: parsed.warmup, prep: parsed.prep, cooldown: parsed.cooldown, parts }),
      ...sessionDurationViolations({
        warmupDurationMin: parsed.warmupDurationMin,
        prepDurationMin: parsed.prepDurationMin,
        cooldownDurationMin: parsed.cooldownDurationMin,
        parts,
      }),
      ...scalingFindings(parsed.summary, usesExternalLoad({ summary: parsed.summary, parts })),
      ...coherenceFindings(parts, caps),
    ]),
  ];
}

export function guardWorkout(tracks: Record<string, GuardTrack>, items: GuardItem[], check?: ProgramCheck): string[] {
  const caps = capabilities(items);
  const violations: string[] = [];
  for (const [track, body] of Object.entries(tracks)) {
    if (!body.warmup.trim()) violations.push(`${track} is missing a warm-up`);
    if (!body.cooldown.trim()) violations.push(`${track} is missing a cool-down`);
    if (body.parts.length === 0) violations.push(`${track} has no workout pieces`);
    const text = [body.summary ?? "", body.warmup, body.prep ?? "", body.cooldown, ...body.parts.map((part) => `${part.name}\n${part.details}`)].join("\n");
    for (const keyword of KEYWORDS) {
      if (keyword.pattern.test(text) && !caps.has(keyword.cap)) {
        violations.push(`${track} uses a ${keyword.label}, which is not owned`);
      }
      keyword.pattern.lastIndex = 0;
    }
    if (!caps.has("barbell")) {
      if (BARBELL_EXPLICIT.test(text) || (BARBELL_MOVEMENTS.test(text) && !OWNED_SUBSTITUTES.test(text))) {
        violations.push(`${track} uses a barbell, which is not owned`);
      }
    }
    if (check) {
      const scored = [body.summary ?? "", ...body.parts.map((part) => `${part.name}\n${part.details}`)].join("\n");
      const hits = scanMovements(scored);
      if (!check.allowRun && hits.some((hit) => hit.slug === "run" || hit.slug.includes("run"))) {
        violations.push(`${track} programs running, which is banned today`);
      }
      if (!check.allowHeavy && /\b(1\s?rm|one[- ]rep max|build to a heavy|heavy single|find a (?:heavy|1))\b/i.test(scored)) {
        violations.push(`${track} programs a heavy max, which is banned today`);
      }
      if (check.load === "heavy") {
        const loadViolation = heavyRxViolation(body.summary ?? "", items);
        if (loadViolation) violations.push(`${track} ${loadViolation}`);
      }
    }
    const loads = [
      ...prescribedLoads(text, "kettlebell", "kbs?|kettlebells?"),
      ...prescribedLoads(text, "dumbbell", "dbs?|dumbbells?"),
      ...prescribedLoads(text, "odd", "wall\\s?balls?"),
    ];
    for (const load of loads) {
      const category = load.category === "odd" ? "odd" : load.category;
      if (!matchesImplement(items, category, load.value, load.unit)) {
        violations.push(`${track} prescribes ${load.value} ${load.unit} that is not in the inventory`);
      }
    }
  }
  return [...new Set(violations)];
}
