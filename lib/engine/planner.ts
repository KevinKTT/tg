import { addDays, startOfWeek } from "../dates";
import {
  compoundScore,
  doseRangeFor,
  eligibleCatalog,
  intervalFriendly,
  isAccessory,
  isAdvancedSkill,
  isSkillMovement,
  movementEligible,
  movementById,
  type EquipmentProfile,
  type Modality,
  type MovementDef,
  type MovementPattern,
} from "./movements";
import { formatText, type Scheme } from "./scheme";

export type Focus = "mixed" | "strength" | "heavy" | "cardio" | "engine" | "gymnastics" | "olympic";

export type LoadKind = "heavy" | "moderate" | "light";
export type Domain = "short" | "medium" | "long";

export type SessionShape =
  | "strength_metcon"
  | "heavy"
  | "couplet"
  | "triplet"
  | "chipper"
  | "intervals"
  | "emom"
  | "ladder"
  | "gymnastics"
  | "max_effort";

export type PieceKind = "strength" | "metcon" | "skill";

export type PieceBrief = {
  kind: PieceKind;
  name: string;
  scheme: Scheme;
  pattern: MovementPattern;
  load: LoadKind;
  modalities: Modality[];
  estimatedDurationMin: number;
  movementCount: { min: number; max: number };
  allowSkill?: boolean;
};

export type DayAssignment = {
  date: string;
  focus: Focus;
  shape: SessionShape;
  domain: Domain;
  load: LoadKind;
  pieces: PieceBrief[];
  brief: string;
  seed: number;
  avoidMovements: string[];
  avoidPatterns: MovementPattern[];
  avoidDumbbell: boolean;
};

export type RecentSignal = {
  date: string;
  pattern: MovementPattern;
  scheme?: string;
  movements: string[];
  load?: LoadKind;
};

const FOCUS_VALUES: Focus[] = ["mixed", "strength", "heavy", "cardio", "engine", "gymnastics", "olympic"];

export function isFocus(value: string | undefined): value is Focus {
  return Boolean(value && FOCUS_VALUES.includes(value as Focus));
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function between(min: number, max: number, random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}


function normaliseFocus(value: string | undefined): Focus | "auto" {
  if (!value || value === "auto") return "auto";
  if (value === "cardio") return "engine";
  if (isFocus(value)) return value;
  return "auto";
}

function weekdayShape(date: string): { shape: SessionShape; focus: Focus; domain: Domain } {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (weekday === 1) return { shape: "strength_metcon", focus: "strength", domain: "medium" };
  if (weekday === 2) return { shape: "intervals", focus: "engine", domain: "medium" };
  if (weekday === 3) return { shape: "gymnastics", focus: "gymnastics", domain: "short" };
  if (weekday === 4) return { shape: "heavy", focus: "heavy", domain: "short" };
  if (weekday === 5) return { shape: "chipper", focus: "mixed", domain: "long" };
  if (weekday === 6) return { shape: "triplet", focus: "mixed", domain: "medium" };
  return { shape: "couplet", focus: "mixed", domain: "short" };
}

function shapeForFocus(focus: Focus, date: string): { shape: SessionShape; domain: Domain } {
  if (focus === "strength") return { shape: "strength_metcon", domain: "medium" };
  if (focus === "heavy") return { shape: "heavy", domain: "short" };
  if (focus === "engine") return { shape: "intervals", domain: "medium" };
  if (focus === "gymnastics") return { shape: "gymnastics", domain: "short" };
  if (focus === "olympic") return { shape: "strength_metcon", domain: "medium" };
  const templates: SessionShape[] = ["couplet", "triplet", "chipper", "ladder", "emom"];
  const shape = templates[hashString(date) % templates.length];
  return { shape, domain: shape === "chipper" ? "long" : "medium" };
}

export function planDay(input: {
  date: string;
  focus?: string;
  profile: EquipmentProfile;
  recent?: RecentSignal[];
  random?: () => number;
}): DayAssignment {
  const random = input.random ?? rng(hashString(input.date));
  const requested = normaliseFocus(input.focus);
  const template = weekdayShape(input.date);
  const focus = requested === "auto" ? template.focus : requested;
  const focused = requested === "auto" ? template : { ...shapeForFocus(focus, input.date), focus };
  const shaped = { shape: focused.shape, domain: focused.domain };
  const hasLoad = eligibleCatalog(input.profile).some((movement) => movement.load);
  let sessionFocus: Focus = focus;
  if (!hasLoad && (shaped.shape === "heavy" || shaped.shape === "strength_metcon")) {
    shaped.shape = "gymnastics";
    shaped.domain = "short";
    sessionFocus = "gymnastics";
  }
  let load = pickLoad(sessionFocus, shaped.shape, input.profile, random);  const recent = input.recent ?? [];
  const weekStart = startOfWeek(input.date);
  const recentDumbbellDays = recent
    .filter((signal) => signal.date >= weekStart)
    .filter((signal) => signal.movements.some((id) => movementById(id)?.load === "dumbbell")).length;
  const hasOtherLoad =
    input.profile.caps.has("barbell") ||
    input.profile.kettlebells.length > 0 ||
    ["wall_ball", "med_ball", "slam_ball", "sandbag", "sled", "farmer_handles"].some((cap) => input.profile.caps.has(cap));
  const avoidDumbbell =
    recentDumbbellDays >= 2 &&
    !hasOtherLoad &&
    (requested === "auto" || sessionFocus === "mixed" || sessionFocus === "engine" || sessionFocus === "gymnastics");
  if (avoidDumbbell && (shaped.shape === "heavy" || shaped.shape === "strength_metcon")) {
    shaped.shape = "gymnastics";
    shaped.domain = "short";
    sessionFocus = "gymnastics";
    load = "light";
  }
  const avoidMovements = [...new Set(recent.slice(0, 10).flatMap((item) => item.movements))];
  if (avoidDumbbell) {
    for (const movement of eligibleCatalog(input.profile)) {
      if (movement.load === "dumbbell") avoidMovements.push(movement.id);
    }
  }
  const avoidPatterns = [...new Set(recent.slice(0, 2).map((item) => item.pattern).filter((pattern) => pattern !== "none"))];
  const pattern = pickPattern(shaped.shape, sessionFocus, input.profile, avoidPatterns, random);
  const pieces = buildPieces({
    date: input.date,
    shape: shaped.shape,
    focus: sessionFocus,
    domain: shaped.domain,
    load,
    pattern,
    profile: input.profile,
    random,
  });
  const brief = pieces
    .map(
      (piece) =>
        `${piece.kind.toUpperCase()}: ${formatText(piece.scheme)}. ${piece.movementCount.min}-${piece.movementCount.max} movements. Modalities: ${piece.modalities.join(" + ")}. Load: ${piece.load}.`,
    )
    .join("\n");
  return {
    date: input.date,
    focus: sessionFocus,
    shape: shaped.shape,
    domain: shaped.domain,
    load,
    pieces,
    brief,
    seed: hashString(`${input.date}:${sessionFocus}:${pattern}`),
    avoidMovements,
    avoidPatterns,
    avoidDumbbell,
  };
}

function pickLoad(focus: Focus, shape: SessionShape, profile: EquipmentProfile, random: () => number): LoadKind {
  const loaded = eligibleCatalog(profile).some((movement) => movement.load);
  if (!loaded) return "light";
  if (focus === "heavy") return profile.hasHeavyLoad ? "heavy" : "moderate";
  if (shape === "heavy") return profile.hasHeavyLoad ? "heavy" : "moderate";
  if (focus === "strength" || focus === "olympic") return "moderate";
  if (focus === "engine" || focus === "gymnastics") return "light";
  if (!profile.hasHeavyLoad) return pick(["moderate", "moderate", "light"] as LoadKind[], random);
  return pick(["moderate", "moderate", "light", "heavy"] as LoadKind[], random);
}

function patternsFor(shape: SessionShape, profile: EquipmentProfile): MovementPattern[] {
  const eligible = eligibleCatalog(profile);
  const available = new Set<MovementPattern>();
  for (const movement of eligible) {
    if (movement.modality !== "W") continue;
    if (movement.pattern === "none" || movement.pattern === "locomotion") continue;
    available.add(movement.pattern);
  }
  const lifting: MovementPattern[] = ["squat", "hinge", "lunge", "press", "pull", "olympic"];
  const preferred: MovementPattern[] =
    shape === "intervals"
      ? ["locomotion"]
      : shape === "gymnastics"
        ? ["squat", "press", "pull", "core", "jump"]
        : shape === "strength_metcon" || shape === "heavy" || shape === "emom" || shape === "ladder"
          ? [...lifting, "carry", "core", "jump"]
          : [...lifting, "carry", "core", "jump"];
  const result = preferred.filter((pattern) => pattern === "locomotion" || available.has(pattern));
  return result.length ? result : ["squat"];
}

function pickPattern(
  shape: SessionShape,
  focus: Focus,
  profile: EquipmentProfile,
  avoid: MovementPattern[],
  random: () => number,
): MovementPattern {
  const options = patternsFor(shape, profile);
  if (focus === "olympic") return options.includes("olympic") ? "olympic" : "hinge";
  if (shape === "intervals") return "locomotion";
  const lifting = options.filter((pattern) => pattern !== "carry" && pattern !== "core" && pattern !== "jump");
  const strengthSafe = shape === "strength_metcon" || shape === "heavy" ? (lifting.length ? lifting : options) : options;
  if (shape === "gymnastics") return pick(strengthSafe.filter((pattern) => pattern !== "olympic"), random);
  const fresh = strengthSafe.filter((pattern) => !avoid.includes(pattern));
  return pick(fresh.length ? fresh : strengthSafe, random);
}

function contrastPattern(pattern: MovementPattern): MovementPattern {
  if (pattern === "squat") return "hinge";
  if (pattern === "hinge" || pattern === "lunge") return "squat";
  if (pattern === "press") return "pull";
  if (pattern === "pull") return "press";
  if (pattern === "olympic") return "squat";
  if (pattern === "carry") return "lunge";
  if (pattern === "core") return "press";
  if (pattern === "jump") return "squat";
  if (pattern === "locomotion") return "squat";
  return "squat";
}

function availableModalities(desired: Modality[], profile: EquipmentProfile): Modality[] {
  const available = new Set(eligibleCatalog(profile).map((movement) => movement.modality));
  const filtered = desired.filter((modality) => available.has(modality));
  return filtered.length ? filtered : [...available];
}

function buildPieces(input: {
  date: string;
  shape: SessionShape;
  focus: Focus;
  domain: Domain;
  load: LoadKind;
  pattern: MovementPattern;
  profile: EquipmentProfile;
  random: () => number;
}): PieceBrief[] {
  const { shape, focus, domain, load, pattern, profile, random } = input;
  const hasHeavy = profile.hasHeavyLoad;
  const modalities = (desired: Modality[]) => availableModalities(desired, profile);
  const strengthScheme = (intent: "moderate" | "heavy"): Scheme =>
    hasHeavy && intent === "heavy" && load === "heavy"
      ? { type: "max_load", repMax: pick([1, 3, 5], random) }
      : { type: "strength", sets: between(4, 6, random), reps: pick(["5", "6", "8"], random), intent };

  if (shape === "heavy") {
    const main: PieceBrief = {
      kind: "strength",
      name: load === "heavy" ? "Heavy lift" : "Loaded strength",
      scheme: strengthScheme(load === "heavy" ? "heavy" : "moderate"),
      pattern,
      load,
      modalities: modalities(["W"]),
      estimatedDurationMin: 22,
      movementCount: { min: 1, max: hasHeavy && load === "heavy" ? 1 : 2 },
    };
    if (load === "heavy") return [main];
    const finisher: PieceBrief = {
      kind: "metcon",
      name: "Finisher",
      scheme: { type: "for_time", rounds: between(3, 4, random) },
      pattern: contrastPattern(pattern),
      load: "light",
      modalities: modalities(["G", "M"]),
      estimatedDurationMin: 9,
      movementCount: { min: 2, max: 2 },
    };
    return [main, finisher];
  }

  if (shape === "strength_metcon") {
    const strength: PieceBrief = {
      kind: "strength",
      name: "Strength",
      scheme: strengthScheme(load === "heavy" ? "heavy" : "moderate"),
      pattern,
      load,
      modalities: modalities(["W"]),
      estimatedDurationMin: 16,
      movementCount: { min: 1, max: 2 },
    };
    const metcon: PieceBrief = {
      kind: "metcon",
      name: "Workout",
      scheme:
        domain === "short"
          ? { type: "for_time", rounds: between(3, 4, random) }
          : { type: "amrap", minutes: between(10, 14, random) },
      pattern: contrastPattern(pattern),
      load: load === "heavy" ? "moderate" : "moderate",
      modalities: modalities(["W", "G", "M"]),
      estimatedDurationMin: domain === "short" ? 10 : 12,
      movementCount: { min: 2, max: 3 },
    };
    return [strength, metcon];
  }

  if (shape === "gymnastics") {
    return [
      {
        kind: "skill",
        name: "Skill",
        scheme: { type: "skill", minutes: between(10, 12, random) },
        pattern: pick(["press", "pull", "core", "jump"], random),
        load: "light",
        modalities: modalities(["G"]),
        estimatedDurationMin: 12,
        movementCount: { min: 1, max: 2 },
        allowSkill: true,
      },
      {
        kind: "metcon",
        name: "Workout",
        scheme: { type: "amrap", minutes: between(12, 15, random) },
        pattern: pick(["core", "press", "pull", "jump"], random),
        load: "light",
        modalities: modalities(["G", "M"]),
        estimatedDurationMin: 14,
        movementCount: { min: 2, max: 3 },
        allowSkill: true,
      },
    ];
  }

  if (shape === "intervals") {
    const workSec = pick([60, 90, 120], random);
    const restSec = workSec === 120 ? 60 : 30;
    const rounds = workSec === 120 ? between(7, 8, random) : workSec === 90 ? between(10, 12, random) : between(13, 15, random);
    const intervalModalities = modalities(["M", "W", "G"]);
    const canMix = intervalModalities.length > 1;
    return [
      {
        kind: "metcon",
        name: "Intervals",
        scheme: { type: "intervals", rounds, workSec, restSec, task: "amrap" },
        pattern: "locomotion",
        load: "light",
        modalities: intervalModalities,
        estimatedDurationMin: Math.round((rounds * (workSec + restSec)) / 60),
        movementCount: { min: canMix ? 2 : 1, max: canMix ? (workSec <= 60 ? 2 : 3) : 1 },
      },
    ];
  }

  if (shape === "emom") {
    return [
      {
        kind: "metcon",
        name: "EMOM",
        scheme: { type: "emom", minutes: between(12, 20, random) },
        pattern,
        load: load === "heavy" ? "moderate" : load,
        modalities: modalities(["W", "G", "M"]),
        estimatedDurationMin: 20,
        movementCount: { min: 2, max: 3 },
      },
    ];
  }

  if (shape === "ladder") {
    return [
      {
        kind: "metcon",
        name: "Ladder",
        scheme: { type: "ladder", reps: pick([[21, 15, 9], [1, 2, 3, 4, 5], [15, 12, 9, 6, 3]], random) },
        pattern,
        load,
        modalities: modalities(["W", "G"]),
        estimatedDurationMin: 22,
        movementCount: { min: 2, max: 2 },
      },
    ];
  }

  if (shape === "chipper") {
    return [
      {
        kind: "metcon",
        name: "Workout",
        scheme: { type: "chipper", capMin: between(22, 30, random) },
        pattern,
        load: load === "light" ? "moderate" : load,
        modalities: modalities(["W", "G", "M"]),
        estimatedDurationMin: between(24, 32, random),
        movementCount: { min: 5, max: 7 },
      },
    ];
  }

  if (shape === "max_effort") {
    return [
      {
        kind: "metcon",
        name: "Max effort",
        scheme: { type: "max_reps", minutes: between(4, 8, random) },
        pattern: "none",
        load: "light",
        modalities: modalities(["G", "M"]),
        estimatedDurationMin: 10,
        movementCount: { min: 1, max: 2 },
      },
    ];
  }

  if (shape === "triplet") {
    return [
      {
        kind: "metcon",
        name: "Workout",
        scheme:
          focus === "mixed" && random() < 0.35
            ? { type: "for_time", rounds: between(4, 5, random) }
            : { type: "amrap", minutes: between(16, 20, random) },
        pattern,
        load: load === "light" ? "moderate" : load,
        modalities: modalities(["W", "G", "M"]),
        estimatedDurationMin: 20,
        movementCount: { min: 3, max: 3 },
      },
    ];
  }

  return [
    {
      kind: "metcon",
      name: "Workout",
      scheme:
        random() < 0.5
          ? { type: "for_time", rounds: between(3, 5, random) }
          : { type: "amrap", minutes: between(12, 16, random) },
      pattern,
      load: load === "light" ? "moderate" : load,
      modalities: modalities(["W", "G"]),
      estimatedDurationMin: 22,
      movementCount: { min: 2, max: 2 },
    },
  ];
}

export type Shortlist = {
  movements: MovementDef[];
  byId: Map<string, MovementDef>;
};

export function shortlistForPiece(
  piece: PieceBrief,
  profile: EquipmentProfile,
  avoid: string[],
  random: () => number,
): Shortlist {
  const eligible = eligibleCatalog(profile);
  const fresh = eligible.filter((movement) => !avoid.includes(movement.id));
  const pool = fresh.length >= 8 ? fresh : eligible;
  const primary = pool.filter((movement) => movement.pattern === piece.pattern);
  const supporting = pool.filter((movement) => movement.pattern !== piece.pattern);
  const wantedModalities = new Set(piece.modalities);

  const rank = (movement: MovementDef) => {
    let score = compoundScore(movement);
    if (wantedModalities.has(movement.modality)) score -= 10;
    if (primary.includes(movement)) score -= 6;
    if (movement.skill === "beginner") score -= 1;
    if (movement.source === "engine" && piece.modalities.includes("M")) score -= 4;
    if (piece.scheme.type === "intervals" && intervalFriendly(movement)) score -= 8;
    if (piece.scheme.type === "intervals" && /\b(row|run|sprint|shuttle|double-under|single-under|jump rope|skip)\b/i.test(movement.name)) score -= 8;
    if (piece.scheme.type === "intervals" && !intervalFriendly(movement) && movement.modality === "M") score += 6;
    if (piece.pattern === "carry" && movement.pattern === "carry") score -= 4;
    if (piece.kind === "strength" && !movement.load) score += 20;
    if (piece.kind === "strength" && movement.pattern === piece.pattern) score -= 4;
    if (piece.kind === "skill") {
      if (movement.load) score += 10;
      if (isSkillMovement(movement)) score -= 6;
    }
    if (piece.load === "light" && movement.intensity === "high") score += 2;
    return score;
  };

  const sorted = [...primary, ...supporting]
    .filter((movement) => movementEligible(movement, profile))
    .filter((movement) => wantedModalities.size === 0 || wantedModalities.has(movement.modality))
    .filter((movement) => piece.allowSkill || piece.kind === "skill" || !isAdvancedSkill(movement))
    .filter((movement) => {
      if (!isAccessory(movement)) return true;
      const alternatives = pool.filter((item) => !isAccessory(item) && item.modality === movement.modality);
      return alternatives.length < 6;
    })
    .sort((left, right) => rank(left) - rank(right));
  const jitter = rng(hashString(`${piece.name}:${piece.scheme.type}:${random()}`));
  const withJitter = sorted.map((movement) => ({ movement, score: rank(movement) + jitter() * 4 }));
  withJitter.sort((left, right) => left.score - right.score);
  const ranked = withJitter.map((item) => item.movement);

  const groups = new Map<MovementPattern, MovementDef[]>();
  for (const movement of ranked) {
    groups.set(movement.pattern, [...(groups.get(movement.pattern) ?? []), movement]);
  }
  const selected: MovementDef[] = [];
  const take = (movement: MovementDef | undefined) => {
    if (!movement || selected.some((item) => item.id === movement.id)) return;
    selected.push(movement);
  };
  const takeFrom = (pattern: MovementPattern, count: number) => {
    for (const movement of (groups.get(pattern) ?? []).slice(0, count)) take(movement);
  };

  if (piece.kind === "strength") {
    takeFrom(piece.pattern, 4);
    for (const pattern of ["squat", "hinge", "press", "pull", "olympic", "lunge"] as MovementPattern[]) {
      take((groups.get(pattern) ?? []).find((movement) => movement.load));
    }
  } else if (piece.kind === "skill") {
    for (const movement of ranked.filter((item) => isSkillMovement(item)).slice(0, 5)) take(movement);
    takeFrom(piece.pattern, 2);
  } else {
    if (piece.scheme.type === "intervals") {
      for (const movement of ranked.filter((item) => intervalFriendly(item)).slice(0, 5)) take(movement);
    } else {
      takeFrom(piece.pattern, 3);
    }
    for (const movement of ranked.filter((item) => item.modality === "M").slice(0, 4)) take(movement);
    for (const movement of ranked.filter((item) => item.modality === "G" && !selected.includes(item)).slice(0, 4)) take(movement);
    for (const pattern of groups.keys()) takeFrom(pattern, 1);
  }
  for (const movement of ranked) {
    if (selected.length >= 18) break;
    take(movement);
  }
  const byId = new Map(selected.map((movement) => [movement.id, movement]));
  return { movements: selected.slice(0, 18), byId };
}

export function assignmentPrompt(assignment: DayAssignment, shortlists: Shortlist[]): string {
  const pieces = assignment.pieces.map((piece, index) => {
    const shortlist = shortlists[index];
    const lines = shortlist.movements
      .map((movement) => {
        const doses = doseRangeFor(movement, piece.scheme)
          .map((range) => `${range.unit} ${range.min}-${range.max}`)
          .join(", ");
        const gear = movement.equipment.length ? ` · needs ${movement.equipment.join("+")}` : "";
        return `  - ${movement.id} — ${movement.name} (${movement.modality}, ${movement.pattern}${gear}; ${doses})`;
      })
      .join("\n");
    return `PIECE ${index + 1} — ${piece.kind.toUpperCase()} — ${formatText(piece.scheme)}
  movements: ${piece.movementCount.min}-${piece.movementCount.max}
  modalities: ${piece.modalities.join(" + ")}
  load: ${piece.load}
  primary pattern: ${piece.pattern}
  ${piece.scheme.type === "intervals" ? "This is an AMRAP circuit inside each work window. Choose 2-3 movements: at least one monostructural station and at least one contrasting station." : piece.kind === "metcon" ? "Use at least two modalities and pair contrasting patterns." : ""}
  choose only from:
${lines}`;
  });
  return `TODAY'S ASSIGNMENT
${pieces.join("\n\n")}

Do not change the scheme, piece count, or movement count. Use only the movement IDs listed above.`;
}

export function weekDates(date: string): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
