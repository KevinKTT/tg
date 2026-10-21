import {
  doseRangeFor,
  eligibleCatalog,
  isAccessory,
  type Dose,
  type EquipmentProfile,
  type MovementDef,
  type MovementPattern,
} from "./movements";
import type { Scheme } from "./scheme";

/**
 * Roles are how a coach builds a piece. The catalog is full of variations;
 * a scored piece may only use movements that belong in one of these roles.
 */
export type SlotRole = "strength" | "loaded" | "gymnastics" | "engine" | "skill" | "carry";

export type PieceSlot = {
  role: SlotRole;
  pattern?: MovementPattern;
};

const STRENGTH_STAPLES = [
  "back_squat",
  "front_squat",
  "deadlift",
  "strict_press",
  "push_press",
  "bench_press",
  "power_clean",
  "hang_power_clean",
  "squat_clean",
  "power_snatch",
  "push_jerk",
  "db-front-squat",
  "db-deadlift",
  "goblet-squat",
  "db-strict-press",
  "db-push-press",
  "db-bent-over-row",
  "db-hang-power-clean",
  "db-power-clean",
  "db-power-snatch",
  "kb-goblet-squat",
  "kb-clean",
  "kb-swing",
] as const;

const LOADED_STAPLES = [
  "db-thruster",
  "thruster",
  "wall-ball",
  "kb-swing",
  "db-deadlift",
  "deadlift",
  "goblet-squat",
  "db-front-squat",
  "front_squat",
  "db-push-press",
  "push_press",
  "kb-goblet-squat",
  "med-ball-clean",
  "push_jerk",
] as const;

const GYM_STAPLES = [
  "burpee",
  "box-jump",
  "box-jump-over",
  "burpee-box-jump-over",
  "push-up",
  "air-squat",
  "pull-up",
  "sit-up",
  "v-up",
] as const;

const ENGINE_STAPLES = [
  "row",
  "air-bike",
  "bike-erg",
  "ski-erg",
  "run",
  "double-under",
  "single-under",
  "shuttle-run",
  "sprint",
] as const;

const SKILL_STAPLES = [
  "wall-walk",
  "handstand-hold",
  "pike-push-up",
  "handstand-push-up-negative",
  "wall-handstand-push-up",
  "pistol",
] as const;

const STAPLE_IDS = new Set<string>([
  ...STRENGTH_STAPLES,
  ...LOADED_STAPLES,
  ...GYM_STAPLES,
  ...ENGINE_STAPLES,
  ...SKILL_STAPLES,
]);

const FILLER =
  /\b(boxer|penguin|alternate[- ]foot|bell|inchworm|bear|curtsy|transverse|crunch|flutter|heel tap|scaption|shrug|arnold|gorilla|upright|renegade|sumo|suitcase|lateral lunge|knee push|bent-knee|hand-release|shoulder tap|spiderman|hindu|archer|staggered|diamond|plank|good morning|muscle snatch|power skip|jumping jack|star jump|tuck jump)\b/i;

const LIFT_PATTERNS = new Set<MovementPattern>(["squat", "hinge", "lunge", "press", "pull", "olympic"]);

/** Burpees are cyclical gymnastics, not an Olympic lift, even if the library tags them that way. */
export function programmingPattern(movement: MovementDef): MovementPattern {
  if (/burpee/i.test(movement.id) || /burpee/i.test(movement.name)) return "jump";
  if (isEngineStaple(movement)) return "locomotion";
  return movement.pattern;
}

export function isEngineStaple(movement: MovementDef): boolean {
  return ENGINE_STAPLES.includes(movement.id as (typeof ENGINE_STAPLES)[number]);
}

export function isFiller(movement: MovementDef): boolean {
  if (STAPLE_IDS.has(movement.id)) return false;
  if (isAccessory(movement)) return true;
  if (FILLER.test(movement.name) || FILLER.test(movement.id)) return true;
  if (movement.modality === "M" && !isEngineStaple(movement)) return true;
  if (movement.intensity === "low") return true;
  if (movement.pattern === "core" && movement.doses.every((dose) => dose.unit === "seconds")) return true;
  return false;
}

export function hasEngine(profile: EquipmentProfile): boolean {
  return eligibleCatalog(profile).some((movement) => isEngineStaple(movement));
}

export function hasLoadedAnchor(profile: EquipmentProfile, avoidDumbbell = false): boolean {
  return eligibleCatalog(profile).some(
    (movement) =>
      LOADED_STAPLES.includes(movement.id as (typeof LOADED_STAPLES)[number]) &&
      !(avoidDumbbell && movement.load === "dumbbell"),
  );
}

export function hasBarbell(profile: EquipmentProfile): boolean {
  return profile.caps.has("barbell");
}

function stapleFor(slot: PieceSlot, movement: MovementDef): boolean {
  if (slot.role === "strength") return STRENGTH_STAPLES.includes(movement.id as (typeof STRENGTH_STAPLES)[number]);
  if (slot.role === "loaded") return LOADED_STAPLES.includes(movement.id as (typeof LOADED_STAPLES)[number]);
  if (slot.role === "gymnastics") return GYM_STAPLES.includes(movement.id as (typeof GYM_STAPLES)[number]);
  if (slot.role === "engine") return isEngineStaple(movement);
  if (slot.role === "skill") return SKILL_STAPLES.includes(movement.id as (typeof SKILL_STAPLES)[number]);
  if (slot.role === "carry") return movement.pattern === "carry" && !isFiller(movement);
  return false;
}

export function slotMatches(movement: MovementDef, slot: PieceSlot, profile: EquipmentProfile): boolean {
  if (slot.role === "engine") {
    if (isEngineStaple(movement)) return true;
    return !hasEngine(profile) && GYM_STAPLES.includes(movement.id as (typeof GYM_STAPLES)[number]);
  }
  if (slot.role === "skill") {
    if (movement.load || isFiller(movement)) return false;
    return SKILL_STAPLES.includes(movement.id as (typeof SKILL_STAPLES)[number]) || /\b(handstand|wall walk|pistol|pike push)/i.test(movement.name);
  }
  if (isFiller(movement)) return false;
  if (slot.role === "gymnastics") return GYM_STAPLES.includes(movement.id as (typeof GYM_STAPLES)[number]);
  if (slot.role === "loaded") return LOADED_STAPLES.includes(movement.id as (typeof LOADED_STAPLES)[number]);
  if (slot.role === "carry") return movement.pattern === "carry";
  if (slot.role === "strength") {
    if (STRENGTH_STAPLES.includes(movement.id as (typeof STRENGTH_STAPLES)[number])) return true;
    return movement.load != null && LIFT_PATTERNS.has(movement.pattern);
  }
  return false;
}

export function slotLabel(slot: PieceSlot): string {
  const hint = slot.pattern && slot.pattern !== "none" && slot.pattern !== "locomotion" ? ` (${slot.pattern})` : "";
  if (slot.role === "strength") return `strength lift${hint}`;
  if (slot.role === "loaded") return `loaded anchor${hint}`;
  if (slot.role === "gymnastics") return `cyclical gymnastics${hint}`;
  if (slot.role === "engine") return "engine: row, run, bike, ski, or double-unders";
  if (slot.role === "skill") return "skill practice: handstand, wall walk, or pike push-up";
  return "carry";
}

function rotate<T>(items: T[], seed: number): T[] {
  if (items.length < 2) return items;
  const offset = Math.abs(seed) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

const STRENGTH_PRIMARY = new Set([
  "back_squat",
  "front_squat",
  "deadlift",
  "strict_press",
  "push_press",
  "db-front-squat",
  "db-deadlift",
  "goblet-squat",
  "db-strict-press",
  "db-push-press",
  "db-bent-over-row",
  "kb-goblet-squat",
]);

const LOADED_PRIMARY = new Set([
  "db-thruster",
  "thruster",
  "wall-ball",
  "kb-swing",
  "db-deadlift",
  "deadlift",
  "goblet-squat",
  "db-push-press",
  "push_press",
]);

const GYM_PRIMARY = new Set(["burpee", "box-jump", "box-jump-over", "push-up", "air-squat"]);
const ENGINE_PRIMARY = new Set(["row", "air-bike", "bike-erg", "ski-erg", "run", "double-under", "single-under"]);

function primaryIds(slot: PieceSlot): Set<string> | null {
  if (slot.role === "strength") return STRENGTH_PRIMARY;
  if (slot.role === "loaded") return LOADED_PRIMARY;
  if (slot.role === "gymnastics") return GYM_PRIMARY;
  if (slot.role === "engine") return ENGINE_PRIMARY;
  return null;
}

function tier(movement: MovementDef, slot: PieceSlot): number {
  let score = 0;
  if (slot.pattern && programmingPattern(movement) === slot.pattern) score -= 2;
  if (stapleFor(slot, movement)) score -= 1;
  if (slot.role === "strength" && STRENGTH_PRIMARY.has(movement.id)) score -= 2;
  if (slot.role === "loaded" && LOADED_PRIMARY.has(movement.id)) score -= 2;
  if (slot.role === "gymnastics" && GYM_PRIMARY.has(movement.id)) score -= 2;
  if (slot.role === "engine" && ENGINE_PRIMARY.has(movement.id)) score -= 2;
  if (slot.role === "skill" && movement.skill !== "advanced") score -= 1;
  if (movement.intensity === "high" && slot.role === "loaded") score -= 1;
  if (movement.skill === "advanced") score += 3;
  return score;
}

export function candidatesForSlot(
  slot: PieceSlot,
  pool: MovementDef[],
  avoid: string[],
  profile: EquipmentProfile,
  seed: number,
): MovementDef[] {
  const matches = pool.filter((movement) => slotMatches(movement, slot, profile));
  const staples = matches.filter((movement) => stapleFor(slot, movement));
  const patterned = staples.filter((movement) => !slot.pattern || programmingPattern(movement) === slot.pattern);
  const primary = primaryIds(slot);
  const preferred = (patterned.length ? patterned : staples).filter((movement) => !primary || primary.has(movement.id));
  const freshPreferred = preferred.filter((movement) => !avoid.includes(movement.id));
  const freshAny = (patterned.length ? patterned : staples.length ? staples : matches).filter(
    (movement) => !avoid.includes(movement.id),
  );
  // Repeat a classic before substituting a sprint, a sit-up, or a variation.
  const chosen = freshPreferred.length
    ? freshPreferred
    : preferred.length
      ? preferred
      : freshAny.length
        ? freshAny
        : patterned.length
          ? patterned
          : staples.length
            ? staples
            : matches;
  const groups = new Map<number, MovementDef[]>();
  for (const movement of chosen) {
    const key = tier(movement, slot);
    groups.set(key, [...(groups.get(key) ?? []), movement]);
  }
  const ordered = [...groups.keys()]
    .sort((left, right) => left - right)
    .flatMap((key) => rotate(groups.get(key) ?? [], seed + key * 17));
  return ordered.slice(0, 5);
}

const NAMED_DOSE: Record<string, number> = {
  "db-thruster": 10,
  thruster: 9,
  "db-deadlift": 12,
  deadlift: 8,
  "db-front-squat": 10,
  "front_squat": 8,
  "goblet-squat": 12,
  "kb-swing": 15,
  "kb-goblet-squat": 12,
  "db-push-press": 10,
  "push_press": 8,
  "wall-ball": 15,
  "db-hang-power-clean": 8,
  "hang_power_clean": 6,
  "db-power-clean": 8,
  burpee: 10,
  "box-jump": 12,
  "box-jump-over": 12,
  "burpee-box-jump-over": 8,
  "push-up": 12,
  "air-squat": 20,
  "sit-up": 15,
  "v-up": 10,
  row: 12,
  "air-bike": 12,
  "bike-erg": 12,
  "ski-erg": 10,
  run: 200,
  "shuttle-run": 100,
  sprint: 100,
  "double-under": 40,
  "single-under": 50,
};

function preferredRange(movement: MovementDef, scheme: Scheme) {
  const ranges = doseRangeFor(movement, scheme);
  if (movement.id === "row" || movement.id === "air-bike" || movement.id === "bike-erg" || movement.id === "ski-erg") {
    return ranges.find((range) => range.unit === "cal") ?? ranges[0];
  }
  return ranges[0];
}

/** A dose a coach would write, clamped to what this scheme allows. */
export function coachDose(movement: MovementDef, scheme: Scheme, bias = 0.45): Dose {
  const range = preferredRange(movement, scheme);
  if (!range) return { reps: 10 };
  let target: number;
  if (scheme.type === "emom") {
    target = range.min;
  } else if (scheme.type === "intervals") {
    target = range.min + Math.round((range.max - range.min) * 0.35);
  } else if (scheme.type === "chipper") {
    target = range.min + Math.round((range.max - range.min) * bias);
  } else if (scheme.type === "strength" || scheme.type === "max_load" || scheme.type === "skill" || scheme.type === "max_reps" || scheme.type === "ladder") {
    target = range.min;
  } else if (NAMED_DOSE[movement.id] != null) {
    target = NAMED_DOSE[movement.id];
  } else {
    target = range.min + Math.round((range.max - range.min) * bias);
  }
  const value = Math.max(range.min, Math.min(range.max, target));
  return { [range.unit]: value };
}
