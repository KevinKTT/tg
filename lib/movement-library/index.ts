import movementsJson from "./data/movements.json";
import patternMapJson from "./data/pattern-map.json";
import stretchesJson from "./data/stretches.json";
import warmupsJson from "./data/warmups.json";

export type LibraryPattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "horizontal push"
  | "vertical push"
  | "horizontal pull"
  | "vertical pull"
  | "carry"
  | "core/midline"
  | "jump"
  | "locomotion"
  | "full-body/olympic-style"
  | "rotation";

export type LibraryMovement = {
  id: string;
  name: string;
  aliases: string[];
  category: "dumbbell" | "bodyweight" | "jump_rope" | "plyometric" | "weighted_vest";
  equipment: string[];
  dumbbell_count: 0 | 1 | 2;
  modality: "weightlifting" | "gymnastics" | "monostructural";
  movement_pattern: LibraryPattern;
  primary_muscles: string[];
  unilateral: boolean;
  vest_compatible: boolean;
  skill_level: "beginner" | "intermediate" | "advanced";
  intensity: "low" | "moderate" | "high";
  typical_unit: "reps" | "time" | "distance";
  scaling_options: { easier: string[]; harder: string[] };
  impact: "low" | "high";
  short_description: string;
  source_url: string;
};

export type LibraryWarmup = {
  id: string;
  name: string;
  aliases: string[];
  type: "general_raise" | "activation" | "dynamic_mobility" | "movement_prep";
  equipment: string[];
  target_areas: string[];
  pairs_with_patterns: LibraryPattern[];
  typical_dose: string;
  short_description: string;
  source_url: string;
};

export type LibraryStretch = {
  id: string;
  name: string;
  aliases: string[];
  type: "static_stretch" | "mobility" | "foam_roll_or_soft_tissue" | "breathing/downregulation";
  equipment: string[];
  target_areas: string[];
  pairs_with_patterns: LibraryPattern[];
  typical_hold: string;
  short_description: string;
  source_url: string;
};

export type LibraryInventoryItem = {
  slug: string;
  category: string;
  quantity: number;
  owned: boolean;
};

export type MovementMenu = {
  movements: LibraryMovement[];
  eligibleMovementIds: string[];
  warmups: LibraryWarmup[];
  prep: LibraryWarmup[];
  cooldowns: LibraryStretch[];
};

type PatternMap = Record<LibraryPattern, { warmups: string[]; stretches: string[]; movement_count: number }>;

export const MOVEMENT_LIBRARY = movementsJson as LibraryMovement[];
export const WARMUP_LIBRARY = warmupsJson as LibraryWarmup[];
export const STRETCH_LIBRARY = stretchesJson as LibraryStretch[];
const PATTERN_MAP = patternMapJson as PatternMap;

const MOVEMENT_BY_ID = new Map(MOVEMENT_LIBRARY.map((movement) => [movement.id, movement]));
const WARMUP_BY_ID = new Map(WARMUP_LIBRARY.map((movement) => [movement.id, movement]));
const STRETCH_BY_ID = new Map(STRETCH_LIBRARY.map((movement) => [movement.id, movement]));

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function libraryEquipment(items: LibraryInventoryItem[]): Set<string> {
  const owned = items.filter((item) => item.owned);
  const slugs = new Set(owned.map((item) => item.slug));
  const equipment = new Set<string>();
  if (owned.some((item) => item.category === "dumbbell")) equipment.add("dumbbell");
  if (slugs.has("jump_rope")) equipment.add("jump_rope");
  if (slugs.has("weight_vest")) equipment.add("weighted_vest");
  if ([...slugs].some((slug) => slug.startsWith("box_"))) equipment.add("box");
  if (slugs.has("bench")) equipment.add("bench");
  if ([...slugs].some((slug) => slug.startsWith("band_") || slug === "jump_band")) {
    equipment.add("band");
    equipment.add("band_or_pvc");
  }
  if (slugs.has("pvc")) equipment.add("band_or_pvc");
  if (slugs.has("foam_roller")) equipment.add("foam_roller");
  if (slugs.has("lacrosse_ball")) equipment.add("massage_ball");
  if (slugs.has("wall_target")) equipment.add("wall");
  return equipment;
}

function hasDumbbellPair(items: LibraryInventoryItem[]): boolean {
  return items.some((item) => item.owned && item.category === "dumbbell" && item.quantity >= 2);
}

function eligible(equipment: string[], available: Set<string>): boolean {
  return equipment.every((token) => available.has(token));
}

export function eligibleMovements(items: LibraryInventoryItem[]): LibraryMovement[] {
  const available = libraryEquipment(items);
  const pair = hasDumbbellPair(items);
  const canRun = items.some((item) => item.owned && item.slug === "running");
  return MOVEMENT_LIBRARY.filter(
    (movement) =>
      eligible(movement.equipment, available) &&
      (movement.dumbbell_count < 2 || pair) &&
      (!movement.id.includes("run") || canRun),
  );
}

export function libraryPatterns(pattern: string, mono = "none"): LibraryPattern[] {
  if (mono === "jump_rope") return ["jump", "locomotion"];
  if (mono === "carry") return ["carry", "locomotion"];
  if (mono === "run") return ["locomotion"];
  if (pattern === "squat") return ["squat", "lunge"];
  if (pattern === "hinge") return ["hinge"];
  if (pattern === "press") return ["horizontal push", "vertical push"];
  if (pattern === "pull") return ["horizontal pull", "vertical pull"];
  if (pattern === "olympic") return ["full-body/olympic-style"];
  if (pattern === "carry") return ["carry"];
  return ["core/midline", "jump", "locomotion", "rotation"];
}

function accessoryPatterns(patterns: LibraryPattern[]): LibraryPattern[] {
  const extras: LibraryPattern[] = ["core/midline", "rotation"];
  if (!patterns.includes("jump")) extras.push("jump");
  return [...new Set([...patterns, ...extras])];
}

function pickMapped<T extends { id: string; equipment: string[] }>(
  patterns: LibraryPattern[],
  field: "warmups" | "stretches",
  lookup: Map<string, T>,
  available: Set<string>,
): T[] {
  const ids = patterns.flatMap((pattern) => PATTERN_MAP[pattern]?.[field] ?? []);
  return [...new Set(ids)].flatMap((id) => {
    const item = lookup.get(id);
    return item && eligible(item.equipment, available) ? [item] : [];
  });
}

export function movementMenu(input: {
  items: LibraryInventoryItem[];
  pattern: string;
  mono?: string;
  recentIds?: string[];
  random?: () => number;
}): MovementMenu {
  const random = input.random ?? Math.random;
  const patterns = libraryPatterns(input.pattern, input.mono);
  const allPatterns = accessoryPatterns(patterns);
  const recent = new Set(input.recentIds ?? []);
  const available = libraryEquipment(input.items);
  const eligibleMoves = eligibleMovements(input.items);
  const primary = eligibleMoves.filter(
    (movement) => patterns.includes(movement.movement_pattern) && !recent.has(movement.id),
  );
  const accessory = eligibleMoves.filter(
    (movement) => allPatterns.includes(movement.movement_pattern) && !primary.includes(movement) && !recent.has(movement.id),
  );
  const fallback = eligibleMoves.filter((movement) => !recent.has(movement.id));
  const movements = [
    ...shuffle(primary, random).slice(0, 9),
    ...shuffle(accessory, random).slice(0, 5),
  ];
  if (movements.length < 10) {
    movements.push(...shuffle(fallback.filter((movement) => !movements.includes(movement)), random).slice(0, 10 - movements.length));
  }

  const mappedWarmups = pickMapped(allPatterns, "warmups", WARMUP_BY_ID, available);
  const general = mappedWarmups.filter((item) => item.type === "general_raise");
  const activation = mappedWarmups.filter((item) => item.type === "activation");
  const mobility = mappedWarmups.filter((item) => item.type === "dynamic_mobility");
  const prep = mappedWarmups.filter((item) => item.type === "movement_prep");
  const warmups = [
    ...shuffle(general, random).slice(0, 3),
    ...shuffle(activation, random).slice(0, 4),
    ...shuffle(mobility, random).slice(0, 5),
  ];
  const cooldownPool = pickMapped(allPatterns, "stretches", STRETCH_BY_ID, available);
  const cooldowns = [
    ...shuffle(cooldownPool.filter((item) => item.type === "static_stretch" || item.type === "mobility"), random).slice(0, 7),
    ...shuffle(cooldownPool.filter((item) => item.type === "foam_roll_or_soft_tissue"), random).slice(0, 1),
    ...shuffle(cooldownPool.filter((item) => item.type === "breathing/downregulation"), random).slice(0, 2),
  ];
  return {
    movements: movements.slice(0, 14),
    eligibleMovementIds: eligibleMoves.map((movement) => movement.id),
    warmups,
    prep: shuffle(prep, random).slice(0, 8),
    cooldowns,
  };
}

function scalingNames(movement: LibraryMovement, eligibleIds: Set<string>): string {
  const easier = movement.scaling_options.easier
    .filter((id) => eligibleIds.has(id))
    .map((id) => MOVEMENT_BY_ID.get(id)?.name)
    .filter(Boolean)
    .slice(0, 2);
  return easier.length ? `; easier: ${easier.join(" / ")}` : "";
}

export function movementMenuPrompt(menu: MovementMenu): string {
  const eligibleIds = new Set(menu.eligibleMovementIds);
  const movements = menu.movements
    .map(
      (movement) =>
        `- ${movement.name} [${movement.id}] - ${movement.modality}, ${movement.movement_pattern}, ${movement.skill_level}, ${movement.intensity}, unit ${movement.typical_unit}${scalingNames(movement, eligibleIds)}`,
    )
    .join("\n");
  const warmups = menu.warmups
    .map((item) => `- ${item.name} [${item.id}] - ${item.type}; ${item.typical_dose}`)
    .join("\n");
  const prep = menu.prep.map((item) => `- ${item.name} [${item.id}] - ${item.typical_dose}`).join("\n");
  const cooldowns = menu.cooldowns
    .map((item) => `- ${item.name} [${item.id}] - ${item.type}; ${item.typical_hold}`)
    .join("\n");
  return `CURATED MOVEMENT LIBRARY (already filtered for owned equipment):
For dumbbell, bodyweight, jump-rope, plyometric, or vest work, choose from this movement list and use the exact displayed name. Other owned-equipment movements remain allowed.
${movements || "- No eligible movement-library entries for this assignment."}

MATCHED WARM-UP OPTIONS:
${warmups || "- Use equipment-free general and dynamic preparation."}

MATCHED WORKOUT-PREP OPTIONS:
${prep || "- Build the exact workout movements from easy to working intensity."}

MATCHED COOL-DOWN OPTIONS:
${cooldowns || "- Use equipment-free stretches for the patterns trained."}`;
}

export function movementMenuIds(menu: MovementMenu): string[] {
  const eligible = new Set(menu.eligibleMovementIds);
  return [
    ...new Set(
      menu.movements.flatMap((movement) => [movement.id, ...movement.scaling_options.easier.filter((id) => eligible.has(id))]),
    ),
  ];
}

export function isLibraryMovementId(id: string): boolean {
  return MOVEMENT_BY_ID.has(id);
}
