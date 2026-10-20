import { movementMenu } from "../movement-library";
import {
  movementById,
  movementDisplayName,
  doseText,
  defaultDose,
  schemeStyle,
  intervalFriendly,
  isAccessory,
  isSkillMovement,
  type Dose,
  type MovementDef,
  type MovementDose,
  type InventoryItem,
} from "./movements";
import type { DayAssignment, PieceBrief, Shortlist } from "./planner";
import { formatText, type Scheme, type ScoreType, scoreTypeForScheme, capSecForScheme } from "./scheme";

export type PlannedPiece = {
  kind: PieceBrief["kind"];
  name: string;
  scheme: Scheme;
  movements: MovementDose[];
  estimatedDurationMin: number;
};

export type ClassPlan = {
  date: string;
  title: string;
  stimulus: string;
  focus: string;
  format: string;
  summary: string;
  warmup: string;
  warmupDurationMin: number;
  prep: string;
  prepDurationMin: number;
  cooldown: string;
  cooldownDurationMin: number;
  pieces: PlannedPiece[];
};

export type AiPiece = {
  movements: MovementDose[];
};

export type AiWorkout = {
  title: string;
  stimulus: string;
  pieces: AiPiece[];
};

function legacyPattern(pattern: string): string {
  if (pattern === "lunge") return "squat";
  if (pattern === "press" || pattern === "pull" || pattern === "squat" || pattern === "hinge" || pattern === "olympic" || pattern === "carry") {
    return pattern;
  }
  return "none";
}

function monoFor(assignment: DayAssignment, caps: Set<string>): string {
  if (assignment.focus === "engine" || assignment.shape === "intervals") {
    if (caps.has("jump_rope")) return "jump_rope";
    if (caps.has("running")) return "run";
    if (caps.has("weight_vest") || caps.has("dumbbell")) return "carry";
  }
  return "none";
}

function menuWarmups(assignment: DayAssignment, items: InventoryItem[], caps: Set<string>, random: () => number) {
  const menu = movementMenu({
    items,
    pattern: legacyPattern(assignment.pieces[0]?.pattern ?? "squat"),
    mono: monoFor(assignment, caps),
    recentIds: assignment.avoidMovements,
    random,
  });
  return menu;
}

const PREFERRED_WARMUP =
  /\b(easy jog|jog in place|jumping jack|single-under|leg swing|arm circle|hip circle|world'?s greatest|down dog|cat[- ]cow|thoracic|glute bridge|bird dog|dead bug|band pull|scapular|shoulder tap|plank|air squat|inchworm|lunge|high knee)\b/i;

export function buildWarmup(assignment: DayAssignment, items: InventoryItem[], caps: Set<string>, random: () => number): string {
  const menu = menuWarmups(assignment, items, caps, random);
  const general = menu.warmups.filter((item) => item.type === "general_raise");
  const activation = menu.warmups
    .filter((item) => item.type === "activation")
    .filter((item) => !/\b(pike|handstand|donkey|wall line|squat jump to stick|burpee breakdown|muscle-up|pistol)\b/i.test(item.name));
  const mobility = menu.warmups.filter((item) => item.type === "dynamic_mobility");
  const ordered = (list: typeof menu.warmups) => [
    ...list.filter((item) => PREFERRED_WARMUP.test(item.name)),
    ...list.filter((item) => !PREFERRED_WARMUP.test(item.name)),
  ];
  const chosen = [
    ordered(general)[0],
    ordered(activation)[0],
    ordered(activation)[1],
    ordered(mobility)[0],
    ordered(mobility)[1],
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!chosen.length) {
    return ["- 3 min easy jog or jump rope", "- 10 air squats", "- 10 arm circles", "- 10 hip openers"].join("\n");
  }
  return chosen.map((item) => `- ${item.typical_dose} ${item.name}`).join("\n");
}

export function buildPrep(
  assignment: DayAssignment,
  items: InventoryItem[],
  caps: Set<string>,
  random: () => number,
  pieces: PlannedPiece[] = [],
): string {
  const menu = menuWarmups(assignment, items, caps, random);
  const relevant = pieces
    .flatMap((piece) => piece.movements)
    .map((item) => movementById(item.id))
    .filter((movement): movement is NonNullable<typeof movement> => Boolean(movement))
    .filter((movement, index, list) => list.findIndex((item) => item.id === movement.id) === index)
    .slice(0, 3);
  const lines = relevant.map((movement) => {
    const unit = movement.doses[0]?.unit;
    if (unit === "cal") return `- 5 cal ${movement.name}`;
    if (unit === "meters") return `- 50 m ${movement.name}`;
    if (unit === "seconds") return `- 20 sec ${movement.name}`;
    return `- 5 ${movement.name}`;
  });
  for (const item of menu.prep) {
    if (lines.length >= 4) break;
    if (/\b(pike|handstand|donkey|wall line|squat jump to stick|burpee breakdown|muscle-up|pistol|practice|drill|turkish|snap-down)\b/i.test(item.name)) continue;
    const line = `- ${item.typical_dose} ${item.name}`;
    if (!lines.includes(line)) lines.push(line);
  }
  if (!lines.length) {
    const primary = assignment.pieces[0];
    const names = primary ? shortlistNamesForPrep(primary.pattern) : [];
    return names.map((name) => `- 5 ${name}`).join("\n");
  }
  return lines.slice(0, 4).join("\n");
}

export function buildCooldown(assignment: DayAssignment, items: InventoryItem[], caps: Set<string>, random: () => number): string {
  const menu = menuWarmups(assignment, items, caps, random);
  const stretches = menu.cooldowns
    .filter((item) => item.type === "static_stretch" || item.type === "mobility")
    .filter((item) => !/\b(wrist|finger|forearm|neck|scapula)\b/i.test(item.name));
  const soft = menu.cooldowns.filter((item) => item.type === "foam_roll_or_soft_tissue");
  const breath = menu.cooldowns.filter((item) => item.type === "breathing/downregulation");
  const chosen = [
    breath[0],
    stretches[0],
    stretches[1],
    stretches[2],
    soft[0],
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!chosen.length) {
    return ["- 5 slow breaths", "- 30 sec/side standing quad stretch", "- 30 sec/side hamstring stretch", "- Child's pose"].join("\n");
  }
  return chosen.map((item) => `- ${item.typical_hold} ${item.name}`).join("\n");
}

function shortlistNamesForPrep(pattern: string): string[] {
  if (pattern === "hinge") return ["good mornings", "deadlifts"];
  if (pattern === "squat" || pattern === "lunge") return ["air squats", "lunges"];
  if (pattern === "press") return ["push-ups", "presses"];
  if (pattern === "pull") return ["rows", "scap pulls"];
  if (pattern === "olympic") return ["clean pulls", "snatch pulls"];
  if (pattern === "carry") return ["suitcase carries", "front-rack carries"];
  if (pattern === "locomotion") return ["easy row", "easy run"];
  return ["air squats", "burpees"];
}

const EQUIPMENT_LABEL: Record<string, string> = {
  dumbbell: "dumbbells",
  barbell: "barbell",
  kettlebell: "kettlebells",
  box: "plyo box",
  bench: "bench",
  jump_rope: "jump rope",
  weight_vest: "weight vest",
  rower: "rower",
  running: "outdoor run",
  air_bike: "air bike",
  bike_erg: "BikeErg",
  ski_erg: "SkiErg",
  abmat: "AbMat",
  pvc: "PVC",
  band: "band",
  plates: "plates",
  parallettes: "parallettes",
};

export function equipmentSummary(pieces: PlannedPiece[]): string {
  const labels = new Set<string>();
  for (const piece of pieces) {
    for (const item of piece.movements) {
      const movement = movementById(item.id);
      for (const cap of movement?.equipment ?? []) {
        const label = EQUIPMENT_LABEL[cap];
        if (label) labels.add(label);
      }
    }
  }
  return labels.size ? `Equipment: ${[...labels].join(", ")}` : "Equipment: bodyweight";
}

export function renderMovementLine(item: MovementDose): string {
  const movement = movementById(item.id);
  if (!movement) return `- ${movementDisplayName(item.id)}`;
  return `- ${doseText(movement, item.dose)} ${movement.name}`;
}

export function renderPieceBody(piece: PlannedPiece): string {
  const scheme = piece.scheme;
  if (!piece.movements.length) return "";
  if (scheme.type === "emom") {
    const minutes = Math.max(1, Math.min(30, scheme.minutes));
    const lines: string[] = [];
    for (let minute = 1; minute <= minutes; minute += 1) {
      const item = piece.movements[(minute - 1) % piece.movements.length];
      const movement = movementById(item.id);
      if (!movement) continue;
      lines.push(`Minute ${minute}: ${doseText(movement, item.dose)} ${movement.name}`);
    }
    return lines.join("\n");
  }
  if (scheme.type === "strength" || scheme.type === "max_load" || scheme.type === "skill") {
    return piece.movements.map((item) => `- ${movementDisplayName(item.id)}`).join("\n");
  }
  if (scheme.type === "max_reps") {
    return piece.movements.map((item) => `- Max reps ${movementDisplayName(item.id)}`).join("\n");
  }
  if (scheme.type === "ladder" || (scheme.type === "for_time" && scheme.repScheme?.length)) {
    return piece.movements.map((item) => `- ${movementDisplayName(item.id)}`).join("\n");
  }
  return piece.movements.map(renderMovementLine).join("\n");
}

export function renderScheme(scheme: Scheme): string {
  return formatText(scheme);
}

export function partScoreType(piece: PlannedPiece): ScoreType {
  return scoreTypeForScheme(piece.scheme);
}

export function partCapSec(piece: PlannedPiece): number | null {
  return capSecForScheme(piece.scheme);
}

export function buildClassFromAi(input: {
  assignment: DayAssignment;
  ai: AiWorkout;
  items: InventoryItem[];
  caps: Set<string>;
  random: () => number;
}): ClassPlan {
  const pieces: PlannedPiece[] = input.assignment.pieces.map((brief, index) => {
    const aiPiece = input.ai.pieces[index];
    return {
      kind: brief.kind,
      name: brief.name,
      scheme: brief.scheme,
      movements: aiPiece?.movements ?? [],
      estimatedDurationMin: brief.estimatedDurationMin,
    };
  });
  const summary = equipmentSummary(pieces);
  return {
    date: input.assignment.date,
    title: input.ai.title,
    stimulus: input.ai.stimulus,
    focus: input.assignment.focus,
    format: input.assignment.pieces[0]?.scheme.type ?? "for_time",
    summary,
    warmup: buildWarmup(input.assignment, input.items, input.caps, input.random),
    warmupDurationMin: 10,
    prep: buildPrep(input.assignment, input.items, input.caps, input.random, pieces),
    prepDurationMin: 7,
    cooldown: buildCooldown(input.assignment, input.items, input.caps, input.random),
    cooldownDurationMin: 5,
    pieces,
  };
}

export function buildFallbackPiece(
  brief: PieceBrief,
  shortlist: Shortlist,
  random: () => number,
): MovementDose[] {
  const target = randomPickCount(brief.movementCount, random);
  const pool = shortlist.movements;
  if (!pool.length) return [];
  const selected: MovementDef[] = [];
  const usedPatterns = new Set<string>();
  const allowed = new Set(brief.modalities);
  const usedModalities = () => new Set(selected.map((movement) => movement.modality));

  const add = (movement: MovementDef | undefined) => {
    if (!movement || selected.length >= target) return;
    if (selected.some((item) => item.id === movement.id)) return;
    selected.push(movement);
    usedPatterns.add(movement.pattern);
  };

  if (brief.kind === "strength") {
    const loaded = pool.filter((movement) => movement.load && !isAccessory(movement));
    if (!loaded.length) {
      const candidates = pool.filter((movement) => !isAccessory(movement));
      add(randomFrom(candidates.filter((movement) => movement.pattern === brief.pattern), random));
      add(randomFrom(candidates.filter((movement) => movement.pattern !== selected[0]?.pattern), random));
    } else {
      add(randomFrom(loaded.filter((movement) => movement.pattern === brief.pattern), random) ?? loaded[0]);
      add(randomFrom(loaded.filter((movement) => movement.pattern !== selected[0]?.pattern), random));
    }
  } else if (brief.kind === "skill") {
    const skill = pool.filter((movement) => !movement.load && isSkillMovement(movement));
    add(randomFrom(skill.filter((movement) => movement.pattern === brief.pattern), random) ?? skill[0] ?? pool.find((movement) => !movement.load));
    add(randomFrom(skill.filter((movement) => movement.pattern !== selected[0]?.pattern), random));
  } else {
    if (brief.modalities.includes("M")) {
      const friendly = pool.filter((movement) => intervalFriendly(movement));
      const engine = pool.filter((movement) => movement.modality === "M" && !isAccessory(movement));
      if (brief.scheme.type === "intervals" && friendly.length) {
        add(randomFrom(friendly, random));
      } else {
        add(randomFrom(engine.length ? engine : pool.filter((movement) => movement.modality === "M"), random));
      }
    }
    add(
      randomFrom(
        pool.filter(
          (movement) =>
            allowed.has(movement.modality) &&
            movement.pattern === brief.pattern &&
            movement.modality !== "M" &&
            !isAccessory(movement),
        ),
        random,
      ),
    );
    // Mixed conditioning should carry real load when the gym has it. This is a
    // big part of making the session feel hard rather than like a bodyweight circuit.
    if (brief.load !== "light" && brief.modalities.includes("W") && !selected.some((movement) => movement.load)) {
      add(
        randomFrom(
          pool.filter(
            (movement) =>
              movement.load &&
              allowed.has(movement.modality) &&
              !usedPatterns.has(movement.pattern) &&
              !isAccessory(movement),
          ),
          random,
        ),
      );
    }

    add(
      randomFrom(
        pool.filter(
          (movement) =>
            allowed.has(movement.modality) &&
            !usedModalities().has(movement.modality) &&
            !usedPatterns.has(movement.pattern) &&
            !isAccessory(movement),
        ),
        random,
      ),
    );

    const diverse = shuffle(
      pool.filter((movement) => allowed.has(movement.modality) && !isAccessory(movement)),
      random,
    );
    for (const movement of diverse) {
      if (selected.length >= target) break;
      if (usedPatterns.has(movement.pattern)) continue;
      add(movement);
    }
    for (const movement of diverse) {
      if (selected.length >= target) break;
      add(movement);
    }
    for (const movement of shuffle(pool, random)) {
      if (selected.length >= target) break;
      add(movement);
    }
  }

  const style = schemeStyle(brief.scheme);
  return selected.slice(0, target).map((movement) => ({
    id: movement.id,
    dose: defaultDose(movement, brief.scheme, style),
  }));
}

export function buildFallbackClass(input: {
  assignment: DayAssignment;
  shortlists: Shortlist[];
  items: InventoryItem[];
  caps: Set<string>;
  random: () => number;
}): ClassPlan {
  const pieces: PlannedPiece[] = input.assignment.pieces.map((brief, index) => ({
    kind: brief.kind,
    name: brief.name,
    scheme: brief.scheme,
    movements: buildFallbackPiece(brief, input.shortlists[index], input.random),
    estimatedDurationMin: brief.estimatedDurationMin,
  }));
  const summary = equipmentSummary(pieces);
  const title = fallbackTitle(input.assignment, pieces);
  return {
    date: input.assignment.date,
    title,
    stimulus: fallbackStimulus(input.assignment),
    focus: input.assignment.focus,
    format: input.assignment.pieces[0]?.scheme.type ?? "for_time",
    summary,
    warmup: buildWarmup(input.assignment, input.items, input.caps, input.random),
    warmupDurationMin: 10,
    prep: buildPrep(input.assignment, input.items, input.caps, input.random, pieces),
    prepDurationMin: 7,
    cooldown: buildCooldown(input.assignment, input.items, input.caps, input.random),
    cooldownDurationMin: 5,
    pieces,
  };
}

function randomPickCount(range: { min: number; max: number }, random: () => number): number {
  return range.min + Math.floor(random() * (range.max - range.min + 1));
}

function randomItem<T>(items: T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function randomFrom<T>(items: T[], random: () => number, limit = 4): T | undefined {
  if (!items.length) return undefined;
  return randomItem(items.slice(0, Math.min(limit, items.length)), random);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function fallbackTitle(assignment: DayAssignment, pieces: PlannedPiece[]): string {
  const names = pieces
    .flatMap((piece) => piece.movements.slice(0, 2))
    .map((item) => movementDisplayName(item.id));
  const unique = [...new Set(names)];
  if (assignment.shape === "chipper") return "The Long Way";
  if (assignment.focus === "gymnastics") return "Body Control";
  if (assignment.focus === "olympic") return "Fast and Loose";
  if (unique.length >= 2) return `${unique[0]} & ${unique[1]}`;
  return unique[0] ?? "Garage Session";
}

function fallbackStimulus(assignment: DayAssignment): string {
  if (assignment.focus === "heavy") return "Heavy, deliberate sets. Stop before form breaks.";
  if (assignment.focus === "engine") return "Hard breathing, repeatable pace.";
  if (assignment.focus === "gymnastics") return "Quality positions before speed.";
  if (assignment.shape === "chipper") return "Steady grind. Small rests, keep moving.";
  if (assignment.shape === "intervals") return "Even splits. Full effort inside each window.";
  return "Hard, repeatable effort. Sets break before form does.";
}

const TIME_ESTIMATE =
  /\b\d+\s*(?:[-–—]\s*\d+\s*)?(?:min|mins|minute|minutes|sec|secs|second|seconds)\b|\b\d{1,2}:\d{2}\b/i;

function truncateWords(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).trim();
}

function cleanTitle(raw: string, ai: AiWorkout): string {
  let title = raw
    .replace(/\s+/g, " ")
    .replace(/\b(?:locomotion|monostructural|modality)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, "")
    .trim();
  if (!title) {
    const names = ai.pieces
      .flatMap((piece) => piece.movements.slice(0, 2).map((item) => movementDisplayName(item.id)))
      .filter((name, index, list) => list.indexOf(name) === index);
    title = names.slice(0, 2).join(" & ") || "Garage Session";
  }
  return truncateWords(title, 60);
}

function cleanStimulus(raw: string, assignment: DayAssignment): string {
  const clauses = raw
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+|,\s+/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .filter((clause) => !TIME_ESTIMATE.test(clause));
  let stimulus = clauses
    .join(", ")
    .replace(/\s+/g, " ")
    .replace(/;/g, ",")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/^(?:and|but|then|so|also)\b[\s,;:.-]*/i, "")
    .replace(/^[\s,;.:-]+|[\s,.;:-]+$/g, "")
    .trim();
  if (!stimulus) stimulus = fallbackStimulus(assignment);
  return truncateWords(stimulus, 140);
}

/**
 * Copy is not programming. Keep a long or time-flavoured stimulus from sinking
 * an otherwise valid workout: repair it before validation and retries.
 */
export function repairAiCopy(ai: AiWorkout, assignment: DayAssignment): AiWorkout {
  return {
    ...ai,
    title: cleanTitle(ai.title, ai),
    stimulus: cleanStimulus(ai.stimulus, assignment),
  };
}

export function aiWorkoutSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "stimulus", "pieces"],
    properties: {
      title: { type: "string", maxLength: 60 },
      stimulus: { type: "string", maxLength: 140 },
      pieces: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["movements"],
          properties: {
            movements: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "reps", "cal", "meters", "seconds", "eachSide"],
                properties: {
                  id: { type: "string" },
                  reps: { anyOf: [{ type: "integer" }, { type: "null" }] },
                  cal: { anyOf: [{ type: "integer" }, { type: "null" }] },
                  meters: { anyOf: [{ type: "integer" }, { type: "null" }] },
                  seconds: { anyOf: [{ type: "integer" }, { type: "null" }] },
                  eachSide: { anyOf: [{ type: "boolean" }, { type: "null" }] },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function parseAiWorkout(value: unknown): AiWorkout | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { title?: unknown; stimulus?: unknown; pieces?: unknown };
  if (typeof raw.title !== "string" || typeof raw.stimulus !== "string" || !Array.isArray(raw.pieces)) return null;
  const pieces: AiPiece[] = [];
  for (const rawPiece of raw.pieces) {
    if (!rawPiece || typeof rawPiece !== "object") return null;
    const movements = (rawPiece as { movements?: unknown }).movements;
    if (!Array.isArray(movements)) return null;
    const parsed: MovementDose[] = [];
    for (const item of movements) {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string") return null;
      const dose: Dose = {};
      if (typeof row.reps === "number" && Number.isFinite(row.reps)) dose.reps = row.reps;
      if (typeof row.cal === "number" && Number.isFinite(row.cal)) dose.cal = row.cal;
      if (typeof row.meters === "number" && Number.isFinite(row.meters)) dose.meters = row.meters;
      if (typeof row.seconds === "number" && Number.isFinite(row.seconds)) dose.seconds = row.seconds;
      if (typeof row.eachSide === "boolean") dose.eachSide = row.eachSide;
      parsed.push({ id: row.id, dose });
    }
    pieces.push({ movements: parsed });
  }
  return { title: raw.title.trim(), stimulus: raw.stimulus.trim(), pieces };
}
