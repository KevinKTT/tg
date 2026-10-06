import { formatById, type FormatId } from "./formats";

export type Element = "M" | "G" | "W";
export type Load = "heavy" | "moderate" | "light";
export type Domain = "short" | "medium" | "long";
export type Pattern = "squat" | "hinge" | "press" | "pull" | "olympic" | "carry" | "none";
export type Mono = "run" | "jump_rope" | "burpee" | "carry" | "none";
export type Shape =
  | "heavy_only"
  | "strength_metcon"
  | "couplet"
  | "triplet"
  | "chipper"
  | "intervals"
  | "gymnastics"
  | "ladder"
  | "benchmark";

export type ProgramTag = {
  elements: Element[];
  load: Load;
  domain: Domain;
  pattern: Pattern;
  mono: Mono;
  movements: string[];
  shape: Shape;
  format: string;
};

export type Assignment = {
  focus: string;
  formatLabel: string;
  tag: ProgramTag;
  brief: string;
  bannedMovements: string[];
  bans: string[];
  yesterday: string;
};

type MovementHit = { slug: string; pattern: Pattern; element: Element };

const DETECTORS: { re: RegExp; slug: string; pattern: Pattern; element: Element }[] = [
  { re: /\bthrusters?\b/i, slug: "thruster", pattern: "squat", element: "W" },
  { re: /\boverhead squats?\b/i, slug: "overhead_squat", pattern: "squat", element: "W" },
  { re: /\bfront squats?\b/i, slug: "front_squat", pattern: "squat", element: "W" },
  { re: /\bback squats?\b/i, slug: "back_squat", pattern: "squat", element: "W" },
  { re: /\bgoblet squats?\b/i, slug: "goblet_squat", pattern: "squat", element: "W" },
  { re: /\bair squats?\b/i, slug: "air_squat", pattern: "squat", element: "G" },
  { re: /\bsquats?\b/i, slug: "squat", pattern: "squat", element: "W" },
  { re: /\bdeadlifts?\b/i, slug: "deadlift", pattern: "hinge", element: "W" },
  { re: /\bswings?\b/i, slug: "swing", pattern: "hinge", element: "W" },
  { re: /\bclean and jerks?\b/i, slug: "clean_and_jerk", pattern: "olympic", element: "W" },
  { re: /\bsnatches?\b/i, slug: "snatch", pattern: "olympic", element: "W" },
  { re: /\bcleans?\b/i, slug: "clean", pattern: "olympic", element: "W" },
  { re: /\bjerks?\b/i, slug: "jerk", pattern: "olympic", element: "W" },
  { re: /\bpush presses?\b/i, slug: "push_press", pattern: "press", element: "W" },
  { re: /\bbench presses?\b/i, slug: "bench_press", pattern: "press", element: "W" },
  { re: /\bpress(?:es)?\b/i, slug: "press", pattern: "press", element: "W" },
  { re: /\bhandstand push-?ups?\b|\bhspu\b/i, slug: "hspu", pattern: "press", element: "G" },
  { re: /\bpush-?ups?\b/i, slug: "pushup", pattern: "press", element: "G" },
  { re: /\bpull-?ups?\b/i, slug: "pullup", pattern: "pull", element: "G" },
  { re: /\btoes-?to-?bar\b/i, slug: "toes_to_bar", pattern: "pull", element: "G" },
  { re: /\bmuscle-?ups?\b/i, slug: "muscle_up", pattern: "pull", element: "G" },
  { re: /\bwall ?balls?\b/i, slug: "wall_ball", pattern: "squat", element: "W" },
  { re: /\blunges?\b/i, slug: "lunge", pattern: "squat", element: "W" },
  { re: /\bburpees?\b/i, slug: "burpee", pattern: "none", element: "G" },
  { re: /\b(double-?unders?|single-?unders?|jump ropes?)\b/i, slug: "jump_rope", pattern: "none", element: "M" },
  { re: /\b(runs?|running)\b/i, slug: "run", pattern: "none", element: "M" },
  { re: /\b(farmer'?s? )?carries\b|\bcarry\b/i, slug: "carry", pattern: "carry", element: "W" },
  { re: /\bbox jumps?\b/i, slug: "box_jump", pattern: "none", element: "G" },
];

const LOADS = new Set<Load>(["heavy", "moderate", "light"]);
const DOMAINS = new Set<Domain>(["short", "medium", "long"]);
const PATTERNS = new Set<Pattern>(["squat", "hinge", "press", "pull", "olympic", "carry", "none"]);
const MONOS = new Set<Mono>(["run", "jump_rope", "burpee", "carry", "none"]);
const SHAPES = new Set<Shape>([
  "heavy_only",
  "strength_metcon",
  "couplet",
  "triplet",
  "chipper",
  "intervals",
  "gymnastics",
  "ladder",
  "benchmark",
]);
const ELEMENTS = new Set<Element>(["M", "G", "W"]);

const ELEMENT_NAME: Record<Element, string> = {
  M: "monostructural",
  G: "gymnastics",
  W: "weightlifting",
};

type Recipe = {
  shape: Shape;
  format: FormatId;
  elements: Element[];
  load: Load;
  domain: Domain;
  pattern: Pattern | "vary";
  mono: Mono | "vary" | "none";
  needs?: "load" | "barbell";
  brief: string;
};

const RECIPES: Recipe[] = [
  {
    shape: "heavy_only",
    format: "heavy",
    elements: ["W"],
    load: "heavy",
    domain: "short",
    pattern: "vary",
    mono: "none",
    needs: "load",
    brief: "One heavy strength piece only. Build to a heavy set of 3, 2, or 1. Score is load. No metcon, no running.",
  },
  {
    shape: "strength_metcon",
    format: "rounds",
    elements: ["W", "G"],
    load: "moderate",
    domain: "short",
    pattern: "vary",
    mono: "none",
    needs: "load",
    brief: "A hard strength piece first, sets of 5 or 3, then a short 6-9 minute metcon that is not the same pattern as the lift. Two scored pieces. No running.",
  },
  {
    shape: "strength_metcon",
    format: "for_time",
    elements: ["W", "M"],
    load: "heavy",
    domain: "short",
    pattern: "vary",
    mono: "vary",
    needs: "load",
    brief: "A heavy strength piece first, then a short nasty finisher under 8 minutes. The finisher is not a second heavy lift.",
  },
  {
    shape: "couplet",
    format: "for_time",
    elements: ["W", "G"],
    load: "moderate",
    domain: "short",
    pattern: "vary",
    mono: "none",
    needs: "load",
    brief: "One scored couplet for time, about 5-9 minutes. Two movements. No separate strength piece. No running. Rx should feel like a sprint you might not finish unbroken.",
  },
  {
    shape: "couplet",
    format: "amrap",
    elements: ["G", "M"],
    load: "light",
    domain: "medium",
    pattern: "none",
    mono: "vary",
    brief: "One scored couplet AMRAP, 10-14 minutes. Gymnastics plus engine. No separate strength piece. No heavy barbell or dumbbell complex.",
  },
  {
    shape: "triplet",
    format: "amrap",
    elements: ["W", "G", "M"],
    load: "moderate",
    domain: "medium",
    pattern: "vary",
    mono: "vary",
    needs: "load",
    brief: "One AMRAP, 10-15 minutes. Three movements, one from each modality. No separate strength piece. Dense enough that sets break.",
  },
  {
    shape: "chipper",
    format: "chipper",
    elements: ["W", "G", "M"],
    load: "moderate",
    domain: "long",
    pattern: "vary",
    mono: "vary",
    needs: "load",
    brief: "One chipper, 16-25 minutes, once through for time. No separate strength piece. A grind, not a sprint.",
  },
  {
    shape: "intervals",
    format: "interval",
    elements: ["M"],
    load: "light",
    domain: "medium",
    pattern: "none",
    mono: "vary",
    brief: "Monostructural intervals only. No lifting piece. Repeated hard efforts with short rest, 12-20 minutes of work.",
  },
  {
    shape: "intervals",
    format: "for_time",
    elements: ["M"],
    load: "light",
    domain: "long",
    pattern: "none",
    mono: "vary",
    brief: "One monostructural piece, 15-25 minutes. A time trial or a long steady effort. No lifting. No gymnastics couplet.",
  },
  {
    shape: "gymnastics",
    format: "skill_metcon",
    elements: ["G"],
    load: "light",
    domain: "short",
    pattern: "vary",
    mono: "none",
    brief: "A short gymnastics skill piece, then a brief bodyweight metcon. No heavy load. No running.",
  },
  {
    shape: "gymnastics",
    format: "emom",
    elements: ["G"],
    load: "light",
    domain: "medium",
    pattern: "vary",
    mono: "none",
    brief: "One gymnastics EMOM, 10-16 minutes. No heavy load. No running. No separate strength piece.",
  },
  {
    shape: "ladder",
    format: "ladder",
    elements: ["W", "G"],
    load: "moderate",
    domain: "medium",
    pattern: "vary",
    mono: "none",
    needs: "load",
    brief: "One ascending or descending ladder, 10-16 minutes. No separate strength piece. No running.",
  },
  {
    shape: "benchmark",
    format: "benchmark",
    elements: ["W", "G"],
    load: "moderate",
    domain: "short",
    pattern: "vary",
    mono: "none",
    needs: "barbell",
    brief: "One named classic benchmark that does not include running. Rx is the original stimulus and hard to finish clean. No extra strength piece.",
  },
  {
    shape: "couplet",
    format: "emom",
    elements: ["W"],
    load: "moderate",
    domain: "short",
    pattern: "vary",
    mono: "none",
    needs: "load",
    brief: "One EMOM, 10-16 minutes, built on a single lift pattern plus a bodyweight movement. No running. Sets should be hard at the top of the minute.",
  },
];

type Candidate = {
  shape: Shape;
  format: FormatId;
  elements: Element[];
  load: Load;
  domain: Domain;
  pattern: Pattern;
  mono: Mono;
  brief: string;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function scanMovements(text: string): MovementHit[] {
  let rest = text;
  const found: MovementHit[] = [];
  for (const detector of DETECTORS) {
    if (!new RegExp(detector.re.source, "i").test(rest)) continue;
    found.push({ slug: detector.slug, pattern: detector.pattern, element: detector.element });
    rest = rest.replace(new RegExp(detector.re.source, "gi"), " ");
  }
  return found;
}

export function parseProgram(raw: string): ProgramTag | null {
  if (!raw.trim()) return null;
  try {
    const value = JSON.parse(raw) as Partial<ProgramTag>;
    if (!value || !LOADS.has(value.load as Load)) return null;
    const elements = Array.isArray(value.elements) ? value.elements.filter((item): item is Element => ELEMENTS.has(item as Element)) : [];
    const movements = Array.isArray(value.movements)
      ? value.movements.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [];
    return {
      elements: elements.length ? elements : ["W"],
      load: value.load as Load,
      domain: DOMAINS.has(value.domain as Domain) ? (value.domain as Domain) : "medium",
      pattern: PATTERNS.has(value.pattern as Pattern) ? (value.pattern as Pattern) : "none",
      mono: MONOS.has(value.mono as Mono) ? (value.mono as Mono) : "none",
      movements,
      shape: SHAPES.has(value.shape as Shape) ? (value.shape as Shape) : "couplet",
      format: typeof value.format === "string" ? value.format : "",
    };
  } catch {
    return null;
  }
}

export function inferProgram(input: { focus: string; format: string; text: string; stimulus?: string }): ProgramTag {
  const hits = scanMovements(input.text);
  const elements = unique(hits.map((hit) => hit.element));
  if (!elements.length) {
    if (input.focus === "cardio" || input.focus === "engine") elements.push("M");
    else if (input.focus === "gymnastics") elements.push("G");
    else elements.push("W");
  }
  const pattern = hits.find((hit) => hit.pattern !== "none")?.pattern ?? "none";
  let mono: Mono = "none";
  if (hits.some((hit) => hit.slug === "run") || input.focus === "cardio") {
    mono = hits.some((hit) => hit.slug === "run") ? "run" : hits.some((hit) => hit.slug === "jump_rope") ? "jump_rope" : "none";
  } else if (hits.some((hit) => hit.slug === "jump_rope")) mono = "jump_rope";
  else if (hits.some((hit) => hit.slug === "burpee") && elements.length === 1) mono = "burpee";
  else if (hits.some((hit) => hit.slug === "carry") && pattern === "carry") mono = "carry";
  if (hits.some((hit) => hit.slug === "run")) mono = "run";

  let load: Load = "moderate";
  if (input.focus === "heavy" || input.format === "heavy" || /\b(heavy single|1\s?rm|build to a heavy|9[05]%)\b/i.test(input.text)) {
    load = "heavy";
  } else if ((input.focus === "cardio" || input.focus === "gymnastics" || input.focus === "engine") && !hits.some((hit) => hit.element === "W")) {
    load = "light";
  }

  let domain: Domain = "medium";
  if (input.format === "heavy" || input.format === "benchmark") domain = "short";
  else if (input.format === "chipper") domain = "long";
  else {
    const range = input.stimulus?.match(/(\d+)\s*[-–]\s*(\d+)/);
    const one = input.stimulus?.match(/(\d+)/);
    const minutes = range ? Number(range[2]) : one ? Number(one[1]) : 0;
    if (minutes && minutes < 8) domain = "short";
    else if (minutes >= 15) domain = "long";
  }

  let shape: Shape = "couplet";
  if (input.format === "heavy") shape = "heavy_only";
  else if (input.format === "chipper") shape = "chipper";
  else if (input.format === "interval") shape = "intervals";
  else if (input.format === "ladder") shape = "ladder";
  else if (input.format === "benchmark") shape = "benchmark";
  else if (input.format === "skill_metcon" || input.focus === "gymnastics") shape = "gymnastics";
  else if (input.focus === "strength" || input.focus === "heavy") shape = "strength_metcon";
  else if (input.format === "amrap") shape = "triplet";

  return {
    elements,
    load,
    domain,
    pattern,
    mono,
    movements: unique(hits.map((hit) => hit.slug)).slice(0, 3),
    shape,
    format: input.format || "for_time",
  };
}

export function tagFromSignal(input: { program: string; focus: string; format: string; text: string; stimulus?: string }): ProgramTag {
  return parseProgram(input.program) ?? inferProgram(input);
}

export function tagFromDraft(base: ProgramTag, text: string): ProgramTag {
  const hits = scanMovements(text);
  const movements = unique(hits.map((hit) => hit.slug)).slice(0, 3);
  const pattern = hits.find((hit) => hit.pattern !== "none")?.pattern ?? base.pattern;
  const elements = unique(hits.map((hit) => hit.element));
  return {
    ...base,
    movements: movements.length ? movements : base.movements,
    pattern,
    mono: hits.some((hit) => hit.slug === "run") ? "run" : base.mono,
    elements: elements.length ? elements : base.elements,
  };
}

function gearOk(recipe: Recipe, caps: Set<string>): boolean {
  if (recipe.needs === "barbell") return caps.has("barbell");
  if (recipe.needs === "load") {
    return caps.has("barbell") || caps.has("dumbbell") || caps.has("kettlebell") || caps.has("plates");
  }
  return true;
}

function patternOptions(recipe: Recipe, caps: Set<string>): Pattern[] {
  if (recipe.pattern !== "vary") return [recipe.pattern];
  if (recipe.elements.includes("W")) {
    const options: Pattern[] = ["squat", "hinge", "press", "pull", "carry"];
    if (caps.has("barbell") || caps.has("dumbbell")) options.push("olympic");
    return options;
  }
  if (recipe.elements.includes("G")) return ["press", "pull", "none"];
  return ["none"];
}

function monoOptions(recipe: Recipe, caps: Set<string>): Mono[] {
  if (recipe.mono === "none") return ["none"];
  if (recipe.mono !== "vary") return [recipe.mono];
  if (!recipe.elements.includes("M")) return ["none"];
  const options: Mono[] = ["burpee"];
  if (caps.has("running")) options.push("run");
  if (caps.has("jump_rope")) options.push("jump_rope");
  if (caps.has("weight_vest") || caps.has("dumbbell") || caps.has("kettlebell")) options.push("carry");
  return options;
}

function expand(recipe: Recipe, caps: Set<string>): Candidate[] {
  const candidates: Candidate[] = [];
  for (const pattern of patternOptions(recipe, caps)) {
    for (const mono of monoOptions(recipe, caps)) {
      candidates.push({
        shape: recipe.shape,
        format: recipe.format,
        elements: recipe.elements,
        load: recipe.load,
        domain: recipe.domain,
        pattern,
        mono,
        brief: recipe.brief,
      });
    }
  }
  return candidates;
}

function isRunDay(tag: ProgramTag | undefined): boolean {
  return tag?.mono === "run" || Boolean(tag?.movements.includes("run"));
}

function weeklyOk(candidate: Candidate, week: ProgramTag[]): boolean {
  if (candidate.load === "heavy" && week.filter((tag) => tag.load === "heavy").length >= 2) return false;
  if (candidate.mono === "run" && week.filter((tag) => isRunDay(tag)).length >= 2) return false;
  if (candidate.domain === "long" && week.filter((tag) => tag.domain === "long").length >= 2) return false;
  if (candidate.pattern !== "none" && week.filter((tag) => tag.pattern === candidate.pattern).length >= 2) return false;
  return true;
}

function biasOk(candidate: Candidate, bias: string | undefined): boolean {
  if (!bias || bias === "auto" || bias === "mixed") {
    if (bias === "mixed") return ["couplet", "triplet", "chipper", "ladder"].includes(candidate.shape);
    return true;
  }
  if (bias === "heavy") return candidate.load === "heavy";
  if (bias === "strength") return candidate.elements.includes("W") && (candidate.shape === "heavy_only" || candidate.shape === "strength_metcon");
  if (bias === "cardio" || bias === "engine") return candidate.elements.includes("M");
  if (bias === "gymnastics") return candidate.elements.includes("G") && !candidate.elements.includes("W");
  if (bias === "olympic") return candidate.pattern === "olympic";
  return true;
}

function focusFor(candidate: Candidate, bias: string | undefined): string {
  if (candidate.load === "heavy" || candidate.shape === "heavy_only") return "heavy";
  if (candidate.shape === "strength_metcon") return "strength";
  if (bias === "olympic" && candidate.pattern === "olympic") return "olympic";
  if (candidate.shape === "gymnastics" || (candidate.elements.length === 1 && candidate.elements[0] === "G")) return "gymnastics";
  if (candidate.elements.length === 1 && candidate.elements[0] === "M") return "cardio";
  return "mixed";
}

function domainLine(candidate: Candidate): string {
  if (candidate.shape === "heavy_only") return "Time domain: a few heavy sets. No metcon clock.";
  if (candidate.domain === "short") return "Time domain: short, about 4-9 minutes.";
  if (candidate.domain === "long") return "Time domain: long, about 16-25 minutes.";
  return "Time domain: medium, about 8-15 minutes.";
}

function patternLine(pattern: Pattern): string {
  if (pattern === "none") return "Do not center the day on a squat, hinge, or press.";
  if (pattern === "olympic") return "Primary pattern: olympic. The main lift is a snatch, clean, or jerk. A barbell only if one is owned.";
  if (pattern === "carry") return "Primary pattern: carry. The main work is a loaded carry.";
  return `Primary pattern: ${pattern}. The main lift is a ${pattern}. Do not switch the main lift to another pattern.`;
}

function monoLine(mono: Mono): string {
  if (mono === "run") return "Engine: running.";
  if (mono === "jump_rope") return "Engine: jump rope. Do not program running.";
  if (mono === "burpee") return "Engine: burpees. Do not program running.";
  if (mono === "carry") return "Engine: a loaded carry. Do not program running.";
  return "Do not program running.";
}

function loadLine(load: Load): string {
  if (load === "heavy") {
    return "Load: heavy. Rx is 85-95% of a logged PR, or the heaviest owned implement at RPE 9. A good athlete might miss a rep.";
  }
  if (load === "light") {
    return "Load: light or bodyweight. Difficulty is density, not a max. Rx is still hard to finish unbroken.";
  }
  return "Load: moderate-heavy. Rx uses the upper half of owned implements, or 70-80% of a PR. Sets should break. Never the lightest bell for Rx.";
}

function yesterdayLine(tag: ProgramTag | undefined): string {
  if (!tag) return "none";
  const movements = tag.movements.length ? tag.movements.map((slug) => slug.replace(/_/g, " ")).join(", ") : "unspecified";
  return `${tag.load} ${tag.pattern}, ${tag.shape}, ${tag.domain}${tag.mono === "run" ? ", running" : ""}. Movements: ${movements}.`;
}

function pick<T>(items: T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

export function planDay(input: {
  bias?: string;
  caps: Set<string>;
  recent: ProgramTag[];
  week: ProgramTag[];
  random?: () => number;
}): Assignment {
  const random = input.random ?? Math.random;
  const yesterday = input.recent[0];
  const recentFormats = new Set(input.recent.slice(0, 3).map((tag) => tag.format).filter(Boolean));
  const hard = RECIPES.filter((recipe) => gearOk(recipe, input.caps))
    .flatMap((recipe) => expand(recipe, input.caps))
    .filter((candidate) => {
      if (yesterday?.load === "heavy" && candidate.load === "heavy") return false;
      if (isRunDay(yesterday) && candidate.mono === "run") return false;
      if (candidate.mono === "run" && !input.caps.has("running")) return false;
      return true;
    });

  let pool = hard;
  const filters: ((candidate: Candidate) => boolean)[] = [
    (candidate) => weeklyOk(candidate, input.week),
    (candidate) => !yesterday || yesterday.pattern === "none" || candidate.pattern !== yesterday.pattern,
    (candidate) => biasOk(candidate, input.bias),
    (candidate) => !yesterday || candidate.domain !== yesterday.domain,
    (candidate) => !recentFormats.has(candidate.format),
    (candidate) => !yesterday || candidate.shape !== yesterday.shape,
    (candidate) => candidate.shape !== "benchmark" || !input.recent.slice(0, 14).some((tag) => tag.shape === "benchmark"),
  ];
  for (const filter of filters) {
    const next = pool.filter(filter);
    if (next.length) pool = next;
  }
  if (!pool.length) {
    pool = [
      {
        shape: "gymnastics",
        format: "emom",
        elements: ["G"],
        load: "light",
        domain: yesterday?.domain === "short" ? "medium" : "short",
        pattern: yesterday?.pattern === "press" ? "none" : "press",
        mono: "none",
        brief: "A bodyweight gymnastics EMOM. One scored piece. No running. No heavy lifting.",
      },
    ];
  }

  const chosen = pick(pool, random);
  const bannedMovements = yesterday?.movements.slice(0, 3) ?? [];
  const bans = [
    chosen.load !== "heavy" ? "a heavy max-out" : "",
    chosen.mono !== "run" ? "running" : "",
    yesterday && yesterday.pattern !== "none" ? `${yesterday.pattern} as the primary pattern` : "",
  ].filter(Boolean);
  const format = formatById(chosen.format);
  const brief = [
    chosen.brief,
    `- ${patternLine(chosen.pattern)}`,
    `- ${monoLine(chosen.mono)}`,
    `- ${loadLine(chosen.load)}`,
    `- ${domainLine(chosen)}`,
    `- Elements: ${chosen.elements.map((element) => ELEMENT_NAME[element]).join(" + ")}. Do not add a modality that is not listed.`,
  ].join("\n");

  return {
    focus: focusFor(chosen, input.bias),
    formatLabel: format?.label ?? "For Time",
    tag: {
      elements: chosen.elements,
      load: chosen.load,
      domain: chosen.domain,
      pattern: chosen.pattern,
      mono: chosen.mono,
      movements: [],
      shape: chosen.shape,
      format: chosen.format,
    },
    brief,
    bannedMovements,
    bans,
    yesterday: yesterdayLine(yesterday),
  };
}

export function assignmentPrompt(assignment: Assignment): string {
  const banned = assignment.bannedMovements.map((slug) => slug.replace(/_/g, " ")).join(", ") || "none";
  const format = formatById(assignment.tag.format);
  return `TODAY'S ASSIGNMENT (follow this; do not invent a different day):
${assignment.brief}
- Format: ${assignment.formatLabel}. ${format?.brief ?? ""}
- Lead the main workout's "format" field with the exact words "${assignment.formatLabel}".
- Banned movements: ${banned}
- Banned today: ${assignment.bans.join("; ") || "none"}

YESTERDAY (tags only — you are not shown the workout, do not remix one): ${assignment.yesterday}`;
}

export function neighborBans(yesterday: ProgramTag | undefined): string {
  if (!yesterday) return "";
  const lines = [
    yesterday.load === "heavy" ? "Do not make this a heavy day." : "",
    isRunDay(yesterday) ? "Do not program running." : "",
    yesterday.pattern !== "none" ? `Do not use ${yesterday.pattern} as the primary pattern.` : "",
    yesterday.movements.length
      ? `Banned movements: ${yesterday.movements.map((slug) => slug.replace(/_/g, " ")).join(", ")}.`
      : "",
    "If a ban conflicts with the rewrite focus, obey the ban.",
  ].filter(Boolean);
  return `\n\nNEIGHBOR BANS (you are not shown the other workouts):\n${lines.map((line) => `- ${line}`).join("\n")}`;
}
