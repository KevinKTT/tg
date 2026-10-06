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
  bannedMovements: string[];
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
  { pattern: /\b(pull-?ups?|chest-to-bar|chest to bar|toes-to-bar|toes to bar|kipping|bar muscle-?ups?)\b/i, cap: "pullup_bar", label: "pull-up bar" },
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
  }
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
      if (!check.allowRun && hits.some((hit) => hit.slug === "run")) {
        violations.push(`${track} programs running, which is banned today`);
      }
      if (!check.allowHeavy && /\b(1\s?rm|one[- ]rep max|build to a heavy|heavy single|find a (?:heavy|1))\b/i.test(scored)) {
        violations.push(`${track} programs a heavy max, which is banned today`);
      }
      for (const slug of check.bannedMovements) {
        if (hits.some((hit) => hit.slug === slug)) {
          violations.push(`${track} repeats ${slug.replace(/_/g, " ")}, which is banned today`);
        }
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
