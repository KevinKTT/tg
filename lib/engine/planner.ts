import { addDays, startOfWeek } from "../dates";
import {
  doseRangeFor,
  eligibleCatalog,
  type EquipmentProfile,
  type Modality,
  type MovementDef,
  type MovementPattern,
} from "./movements";
import {
  availableGymPatterns,
  availableLoadedPatterns,
  candidatesForSlot,
  hasBarbell,
  hasEngine,
  hasLoadedAnchor,
  isFiller,
  slotLabel,
  type PieceSlot,
} from "./roles";
import { formatText, schemeMinutes, type Scheme } from "./scheme";

export type Focus = "mixed" | "strength" | "heavy" | "cardio" | "engine" | "gymnastics" | "olympic";

export type LoadKind = "heavy" | "moderate" | "light";
export type Domain = "short" | "medium" | "long";

export type SessionShape =
  | "strength_metcon"
  | "heavy"
  | "couplet"
  | "triplet"
  | "quad"
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
  slots?: PieceSlot[];
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
  avoidDumbbell: boolean;
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

function normaliseFocus(value: string | undefined): Focus | "auto" {
  if (!value || value === "auto") return "auto";
  if (value === "cardio") return "engine";
  if (isFocus(value)) return value;
  return "auto";
}

type ClassPick = { shape: SessionShape; focus: Focus; domain: Domain };

/** Real classes. The weekday is not an input, and the same focus may repeat. */
const CLASS_MENU: ClassPick[] = [
  { shape: "triplet", focus: "mixed", domain: "medium" },
  { shape: "quad", focus: "mixed", domain: "medium" },
  { shape: "chipper", focus: "mixed", domain: "long" },
  { shape: "emom", focus: "mixed", domain: "medium" },
  { shape: "ladder", focus: "mixed", domain: "medium" },
  { shape: "strength_metcon", focus: "strength", domain: "medium" },
  { shape: "heavy", focus: "heavy", domain: "short" },
  { shape: "gymnastics", focus: "gymnastics", domain: "medium" },
  { shape: "intervals", focus: "engine", domain: "medium" },
];

function mix(date: string, salt: number, label = ""): string {
  if (!salt) return label ? `${date}:${label}` : date;
  return label ? `${date}:${salt}:${label}` : `${date}:${salt}`;
}

function classForShape(shape: SessionShape): ClassPick {
  return (
    CLASS_MENU.find((item) => item.shape === shape) ?? {
      shape,
      focus: "mixed",
      domain: shape === "couplet" || shape === "max_effort" ? "short" : "medium",
    }
  );
}

function optionsForFocus(focus: Focus): ClassPick[] {
  if (focus === "strength") return CLASS_MENU.filter((item) => item.shape === "strength_metcon" || item.shape === "heavy");
  if (focus === "heavy") return CLASS_MENU.filter((item) => item.shape === "heavy");
  if (focus === "engine") return CLASS_MENU.filter((item) => item.shape === "intervals" || item.shape === "emom" || item.shape === "chipper");
  if (focus === "gymnastics") return CLASS_MENU.filter((item) => item.shape === "gymnastics" || item.shape === "triplet" || item.shape === "chipper");
  if (focus === "olympic") return CLASS_MENU.filter((item) => item.shape === "strength_metcon");
  return CLASS_MENU;
}

function pickClass(focus: Focus | "auto", date: string, salt: number): ClassPick {
  const options = focus === "auto" ? CLASS_MENU : optionsForFocus(focus);
  // Deterministic: the same date and salt still draw the same class.
  return options[hashString(mix(date, salt, "class")) % options.length];
}

export function planDay(input: {
  date: string;
  focus?: string;
  shape?: SessionShape;
  profile: EquipmentProfile;
  random?: () => number;
  salt?: number;
  avoid?: string[];
}): DayAssignment {
  const salt = input.salt || 0;
  const random = input.random ?? rng(hashString(mix(input.date, salt)));
  const requested = normaliseFocus(input.focus);
  const picked = input.shape ? classForShape(input.shape) : pickClass(requested, input.date, salt);
  const shaped = { shape: picked.shape, domain: picked.domain };
  const hasLoad = eligibleCatalog(input.profile).some((movement) => movement.load);
  let sessionFocus: Focus = picked.focus;
  if (!hasLoad && (shaped.shape === "heavy" || shaped.shape === "strength_metcon")) {
    shaped.shape = "gymnastics";
    shaped.domain = "medium";
    sessionFocus = "gymnastics";
  }
  const load = pickLoad(sessionFocus, shaped.shape, input.profile, random);
  const avoidDumbbell = false;
  // Only the current day's own movements survive here, so a rewrite does not
  // reproduce the session it is replacing. No previous day is consulted.
  const avoidMovements = [...new Set(input.avoid ?? [])];
  const pattern = pickPattern(shaped.shape, sessionFocus, input.profile, random);
  const pieces = buildPieces({
    date: input.date,
    shape: shaped.shape,
    focus: sessionFocus,
    domain: shaped.domain,
    load,
    pattern,
    profile: input.profile,
    avoidDumbbell,
    random,
    salt,
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
    seed: hashString(mix(input.date, salt, `${sessionFocus}:${pattern}`)),
    avoidMovements,
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
  random: () => number,
): MovementPattern {
  const options = patternsFor(shape, profile);
  if (focus === "olympic") return options.includes("olympic") ? "olympic" : "hinge";
  if (shape === "intervals") return "locomotion";
  const lifting = options.filter((pattern) => pattern !== "carry" && pattern !== "core" && pattern !== "jump");
  const strengthSafe = shape === "strength_metcon" || shape === "heavy" ? (lifting.length ? lifting : options) : options;
  const withoutOly = strengthSafe.filter((pattern) => pattern !== "olympic");
  const choosable = withoutOly.length ? withoutOly : strengthSafe;
  if (shape === "gymnastics") return pick(choosable.filter((pattern) => pattern !== "olympic"), random);
  return pick(choosable, random);
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

function brief(input: {
  kind: PieceKind;
  name: string;
  scheme: Scheme;
  pattern: MovementPattern;
  load: LoadKind;
  slots: PieceSlot[];
  minutes: number;
  profile: EquipmentProfile;
  allowSkill?: boolean;
}): PieceBrief {
  const modalities = new Set<Modality>();
  for (const slot of input.slots) {
    if (slot.role === "engine") {
      modalities.add(hasEngine(input.profile) ? "M" : "G");
    } else if (slot.role === "gymnastics" || slot.role === "skill") {
      modalities.add("G");
    } else {
      modalities.add("W");
    }
  }
  return {
    kind: input.kind,
    name: input.name,
    scheme: input.scheme,
    pattern: input.pattern,
    load: input.load,
    modalities: [...modalities],
    estimatedDurationMin: input.minutes,
    movementCount: { min: input.slots.length, max: input.slots.length },
    allowSkill: input.allowSkill,
    slots: input.slots,
  };
}

/**
 * A loaded anchor should be a lift the gym can actually load. The seed rotates
 * the choice, so two sessions on the same day still differ.
 */
function loadedAnchorPattern(
  profile: EquipmentProfile,
  preferred: MovementPattern,
  seed: number,
): MovementPattern {
  const available = availableLoadedPatterns(profile);
  const order: MovementPattern[] = [preferred, "squat", "hinge", "press", "olympic", "lunge"];
  const usable = order.filter((item) => available.has(item));
  if (!usable.length) return preferred;
  return usable[Math.abs(seed) % usable.length];
}

/**
 * Pick a gymnastics pattern that contrasts with the loaded movement. Press,
 * pull, jump, and core are all staples; the seed rotates among them.
 */
function gymPatternChoice(
  profile: EquipmentProfile,
  exclude: MovementPattern[],
  seed: number,
): MovementPattern {
  const available = availableGymPatterns(profile);
  const order: MovementPattern[] = ["press", "pull", "jump", "core", "squat"];
  const usable = order.filter((item) => available.has(item) && !exclude.includes(item));
  const pool = usable.length ? usable : order.filter((item) => !exclude.includes(item));
  return pool[Math.abs(seed) % pool.length] ?? "jump";
}

/** An EMOM wants an engine station when one is available; an odd seed asks coupletSlots for exactly that. */
function engineSeed(seed: number): number {
  return seed % 2 === 0 ? seed + 1 : seed;
}

function coupletSlots(
  profile: EquipmentProfile,
  avoidDumbbell: boolean,
  pattern: MovementPattern,
  seed: number,
  allowEngine = true,
): PieceSlot[] {  if (hasLoadedAnchor(profile, avoidDumbbell)) {
    const preferred =
      pattern === "jump" || pattern === "core" || pattern === "carry" || pattern === "locomotion" ? "hinge" : pattern;
    const loadedPattern = loadedAnchorPattern(profile, preferred, seed);
    const second: PieceSlot =
      allowEngine && hasEngine(profile) && seed % 2 === 1
        ? { role: "engine" }
        : { role: "gymnastics", pattern: gymPatternChoice(profile, [loadedPattern], seed) };
    return [{ role: "loaded", pattern: loadedPattern }, second];
  }
  if (hasEngine(profile)) return [{ role: "gymnastics", pattern: "jump" }, { role: "engine" }];
  return [
    { role: "gymnastics", pattern: "jump" },
    { role: "gymnastics", pattern: "press" },
  ];
}

function tripletSlots(
  profile: EquipmentProfile,
  avoidDumbbell: boolean,
  pattern: MovementPattern,
  seed = 0,
): PieceSlot[] {
  const loaded = hasLoadedAnchor(profile, avoidDumbbell);
  const engine = hasEngine(profile);
  const preferred =
    pattern === "jump" || pattern === "core" || pattern === "carry" || pattern === "locomotion" ? "hinge" : pattern;
  const loadedPattern = loadedAnchorPattern(profile, preferred, seed);
  const gym = gymPatternChoice(profile, [loadedPattern], seed);
  if (loaded && engine) {
    return [
      { role: "loaded", pattern: loadedPattern },
      { role: "gymnastics", pattern: gym },
      { role: "engine" },
    ];
  }
  if (loaded) {
    return [
      { role: "loaded", pattern: loadedPattern },
      { role: "gymnastics", pattern: gym },
      { role: "gymnastics", pattern: gymPatternChoice(profile, [loadedPattern, gym], seed + 1) },
    ];
  }
  if (engine) {
    return [
      { role: "gymnastics", pattern: "jump" },
      { role: "gymnastics", pattern: "press" },
      { role: "engine" },
    ];
  }
  return [
    { role: "gymnastics", pattern: "jump" },
    { role: "gymnastics", pattern: "press" },
    { role: "gymnastics", pattern: "squat" },
  ];
}

function chipperSlots(
  profile: EquipmentProfile,
  avoidDumbbell: boolean,
  seed = 0,
): PieceSlot[] {
  const engine = hasEngine(profile);
  const loaded = hasLoadedAnchor(profile, avoidDumbbell);
  const loadedPattern = loadedAnchorPattern(profile, "hinge", seed);
  const second: MovementPattern = engine ? "jump" : "squat";
  const fourth: MovementPattern = loaded ? loadedPattern : "core";
  const fifth = gymPatternChoice(profile, [second, fourth], seed + 3);
  const gym = gymPatternChoice(profile, [second, fourth, fifth], seed);
  return [
    engine ? { role: "engine" } : { role: "gymnastics", pattern: "jump" },
    { role: "gymnastics", pattern: second },
    loaded ? { role: "loaded", pattern: loadedPattern } : { role: "gymnastics", pattern: "core" },
    { role: "gymnastics", pattern: gym },
    { role: "gymnastics", pattern: fifth },
  ];
}

function quadSlots(
  profile: EquipmentProfile,
  avoidDumbbell: boolean,
  pattern: MovementPattern,
  seed = 0,
): PieceSlot[] {
  const base = tripletSlots(profile, avoidDumbbell, pattern, seed);
  const used = new Set(base.map((slot) => slot.pattern).filter((item): item is MovementPattern => Boolean(item)));
  const available = availableGymPatterns(profile);
  const extras: MovementPattern[] = ["core", "squat", "jump", "press", "lunge", "pull"];
  const usable = extras.filter((item) => available.has(item));
  const pool = usable.length ? usable : extras;
  const next = pool.find((item) => !used.has(item)) ?? "core";
  return [...base, { role: "gymnastics", pattern: next }];
}

function coupletScheme(date: string, domain: Domain, slots: PieceSlot[], salt = 0): Scheme {
  const mono = slots.some((slot) => slot.role === "engine");
  const pick = hashString(mix(date, salt, "couplet")) % 3;
  if (!mono && pick === 0) return { type: "for_time", repScheme: [21, 15, 9], capMin: domain === "short" ? 12 : 15 };
  if (pick === 1) return { type: "for_time", rounds: domain === "short" ? 4 : 5, capMin: domain === "short" ? 14 : 18 };
  const minutes = domain === "short" ? 12 : domain === "long" ? 18 : 14;
  return { type: "amrap", minutes };
}

function buildPieces(input: {
  date: string;
  shape: SessionShape;
  focus: Focus;
  domain: Domain;
  load: LoadKind;
  pattern: MovementPattern;
  profile: EquipmentProfile;
  avoidDumbbell: boolean;
  random: () => number;
  salt: number;
}): PieceBrief[] {
  const { date, shape, focus, domain, load, pattern, profile, avoidDumbbell, salt } = input;
  const seed = hashString(mix(date, salt, `${shape}:${pattern}`));
  const strengthScheme = (): Scheme =>
    hasBarbell(profile) && load === "heavy"
      ? { type: "max_load", repMax: 3 }
      : { type: "strength", sets: 5, reps: load === "heavy" ? "3" : "5", intent: load === "heavy" ? "heavy" : "moderate" };

  const lift: PieceSlot[] = [{ role: "strength", pattern }];
  const metconLoad = load === "heavy" ? "moderate" : load;

  if (shape === "heavy") {
    return [
      brief({
        kind: "strength",
        name: load === "heavy" ? "Heavy lift" : "Strength",
        scheme: strengthScheme(),
        pattern,
        load,
        slots: lift,
        minutes: 18,
        profile,
      }),
      brief({
        kind: "metcon",
        name: "Finisher",
        scheme: { type: "amrap", minutes: 8 },
        pattern: contrastPattern(pattern),
        load: "light",
        slots: tripletSlots(profile, avoidDumbbell, contrastPattern(pattern), seed),
        minutes: 8,
        profile,
      }),
    ];
  }

  if (shape === "strength_metcon") {
    const slots = tripletSlots(profile, avoidDumbbell, contrastPattern(pattern), seed);
    return [
      brief({
        kind: "strength",
        name: "Strength",
        scheme: strengthScheme(),
        pattern,
        load,
        slots: lift,
        minutes: 16,
        profile,
      }),
      brief({
        kind: "metcon",
        name: "Workout",
        scheme: coupletScheme(date, "short", slots, salt),
        pattern: contrastPattern(pattern),
        load: metconLoad,
        slots,
        minutes: 12,
        profile,
      }),
    ];
  }

  if (shape === "gymnastics") {
    const gymSeed = hashString(mix(date, salt, "gym"));
    return [
      brief({
        kind: "skill",
        name: "Skill",
        scheme: { type: "skill", minutes: 10 },
        pattern: "press",
        load: "light",
        slots: [{ role: "skill" }],
        minutes: 10,
        profile,
        allowSkill: true,
      }),
      brief({
        kind: "metcon",
        name: "Workout",
        scheme: { type: "amrap", minutes: 14 },
        pattern: gymSeed % 2 === 0 ? "jump" : "squat",
        load: "light",
        slots: quadSlots(profile, avoidDumbbell, gymSeed % 2 === 0 ? "jump" : "squat", gymSeed),
        minutes: 14,
        profile,
      }),
    ];
  }

  if (shape === "intervals") {
    return [
      brief({
        kind: "metcon",
        name: "Intervals",
        scheme: { type: "intervals", rounds: 6, workSec: 60, restSec: 60, task: "amrap" },
        pattern: "locomotion",
        load: "light",
        slots: coupletSlots(profile, avoidDumbbell, pattern === "locomotion" ? "hinge" : pattern, engineSeed(seed)),
        minutes: 12,
        profile,
      }),
    ];
  }

  if (shape === "emom") {
    return [
      brief({
        kind: "metcon",
        name: "EMOM",
        scheme: { type: "emom", minutes: 12 },
        pattern,
        load: metconLoad,
        slots: coupletSlots(profile, avoidDumbbell, pattern, engineSeed(seed)),
        minutes: 12,
        profile,
      }),
    ];
  }

  if (shape === "ladder") {
    return [
      brief({
        kind: "metcon",
        name: "Ladder",
        scheme: { type: "ladder", reps: [21, 15, 9], capMin: 15 },
        pattern,
        load: metconLoad,
        slots: tripletSlots(profile, avoidDumbbell, pattern, seed),
        minutes: 15,
        profile,
      }),
    ];
  }

  if (shape === "chipper") {
    const slots = chipperSlots(profile, avoidDumbbell, seed);
    return [
      brief({
        kind: "metcon",
        name: "Workout",
        scheme: { type: "chipper", capMin: 22 },
        pattern,
        load: metconLoad,
        slots,
        minutes: 22,
        profile,
      }),
    ];
  }

  if (shape === "max_effort") {
    return [
      brief({
        kind: "metcon",
        name: "Max effort",
        scheme: { type: "max_reps", minutes: 5 },
        pattern: "jump",
        load: "light",
        slots: [{ role: "gymnastics", pattern: "jump" }],
        minutes: 8,
        profile,
      }),
    ];
  }

  if (shape === "quad") {
    const slots = quadSlots(profile, avoidDumbbell, pattern, seed);
    return [
      brief({
        kind: "metcon",
        name: "Workout",
        scheme: seed % 2 === 0 ? { type: "for_time", rounds: 4, capMin: 18 } : { type: "amrap", minutes: 16 },
        pattern,
        load: metconLoad,
        slots,
        minutes: 18,
        profile,
      }),
    ];
  }

  if (shape === "triplet") {
    const slots = tripletSlots(profile, avoidDumbbell, pattern, seed);
    return [
      brief({
        kind: "metcon",
        name: "Workout",
        scheme: focus === "mixed" && seed % 3 === 0 ? { type: "for_time", rounds: 5, capMin: 18 } : { type: "amrap", minutes: 16 },
        pattern,
        load: metconLoad,
        slots,
        minutes: 18,
        profile,
      }),
    ];
  }

  const slots = coupletSlots(profile, avoidDumbbell, pattern, seed);
  return [
    brief({
      kind: "metcon",
      name: "Workout",
      scheme: coupletScheme(date, domain, slots, salt),
      pattern,
      load: metconLoad,
      slots,
      minutes: domain === "short" ? 14 : 18,
      profile,
    }),
  ];
}

export type Shortlist = {
  movements: MovementDef[];
  byId: Map<string, MovementDef>;
  slots?: MovementDef[][];
};

function doseLine(movement: MovementDef, scheme: Scheme): string {
  const doses = doseRangeFor(movement, scheme)
    .map((range) => `${range.unit} ${range.min}-${range.max}`)
    .join(", ");
  const gear = movement.equipment.length ? ` · needs ${movement.equipment.join("+")}` : "";
  return `  - ${movement.id} — ${movement.name} (${movement.modality}${gear}; ${doses})`;
}

export function shortlistForPiece(
  piece: PieceBrief,
  profile: EquipmentProfile,
  avoid: string[],
  random: () => number,
): Shortlist {
  const pool = eligibleCatalog(profile);
  const seed = hashString(`${piece.name}:${piece.scheme.type}:${piece.pattern}`) + Math.floor(random() * 997);
  if (piece.slots?.length) {
    const usedImplements = new Set<string>();
    const grouped = piece.slots.map((slot, index) => {
      const group = candidatesForSlot(slot, pool, avoid, profile, seed + index * 13, usedImplements);
      const head = group[0];
      if (head?.load && ["dumbbell", "barbell", "kettlebell"].includes(head.load)) usedImplements.add(head.load);
      return group;
    });
    const selected: MovementDef[] = [];
    for (const group of grouped) {
      for (const movement of group) {
        if (!selected.some((item) => item.id === movement.id)) selected.push(movement);
      }
    }
    return {
      movements: selected.slice(0, 18),
      byId: new Map(selected.map((movement) => [movement.id, movement])),
      slots: grouped,
    };
  }

  const fresh = pool.filter((movement) => !avoid.includes(movement.id));
  const source = fresh.length >= 4 ? fresh : pool;
  const ranked = source
    .filter((movement) => !isFiller(movement))
    .filter((movement) => piece.modalities.includes(movement.modality))
    .filter((movement) => piece.kind !== "strength" || movement.load)
    .slice(0, 12);
  return { movements: ranked, byId: new Map(ranked.map((movement) => [movement.id, movement])) };
}

export function assignmentPrompt(assignment: DayAssignment, shortlists: Shortlist[]): string {
  const pieces = assignment.pieces.map((piece, index) => {
    const shortlist = shortlists[index];
    if (piece.slots?.length && shortlist.slots?.length) {
      const slots = piece.slots
        .map((slot, slotIndex) => {
          const options = (shortlist.slots?.[slotIndex] ?? [])
            .map((movement) => doseLine(movement, piece.scheme))
            .join("\n");
          return `  Slot ${slotIndex + 1} — ${slotLabel(slot)}. Prefer the first:\n${options}`;
        })
        .join("\n");
      return `PIECE ${index + 1} — ${piece.kind.toUpperCase()} — ${formatText(piece.scheme)}
  Return ${piece.slots.length} movements, in slot order.
${slots}`;
    }
    const lines = shortlist.movements.map((movement) => doseLine(movement, piece.scheme)).join("\n");
    return `PIECE ${index + 1} — ${piece.kind.toUpperCase()} — ${formatText(piece.scheme)}
  movements: ${piece.movementCount.min}-${piece.movementCount.max}
  choose only from:
${lines}`;
  });
  return `TODAY'S ASSIGNMENT
${pieces.join("\n\n")}

Do not change the scheme, piece count, or slot order. Use only the movement IDs listed above.`;
}

export function withMetconScheme(assignment: DayAssignment, scheme: Scheme): DayAssignment {
  const pieces = assignment.pieces.map((piece) =>
    piece.kind === "metcon" ? { ...piece, scheme, estimatedDurationMin: schemeMinutes(scheme) } : piece,
  );
  const brief = pieces
    .map(
      (piece) =>
        `${piece.kind.toUpperCase()}: ${formatText(piece.scheme)}. ${piece.movementCount.min}-${piece.movementCount.max} movements. Modalities: ${piece.modalities.join(" + ")}. Load: ${piece.load}.`,
    )
    .join("\n");
  return { ...assignment, pieces, brief };
}

export function weekDates(date: string): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
