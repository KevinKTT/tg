import { movementMenu } from "../movement-library";
import {
  movementById,
  movementDisplayName,
  doseText,
  type Dose,
  type MovementDef,
  type MovementDose,
  type InventoryItem,
} from "./movements";
import type { DayAssignment, PieceBrief, Shortlist } from "./planner";
import { coachDose, programmingPattern } from "./roles";
import { formatText, type Scheme, type ScoreType, scoreTypeForScheme, capSecForScheme } from "./scheme";

export type PlannedPiece = {
  kind: PieceBrief["kind"];
  name: string;
  scheme: Scheme;
  movements: MovementDose[];
  estimatedDurationMin: number;
  cue?: string;
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
  const body = renderPieceLines(piece);
  if (!piece.cue) return body;
  return body ? `${piece.cue}\n${body}` : piece.cue;
}

function renderPieceLines(piece: PlannedPiece): string {
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
  _random: () => number,
  usedIds: string[] = [],
): MovementDose[] {
  const groups = shortlist.slots?.length
    ? shortlist.slots
    : [shortlist.movements];
  const selected: MovementDef[] = [];
  const used = new Set(usedIds);
  const usedPatterns = new Set<string>();

  for (const group of groups) {
    const fresh = group.filter((movement) => !used.has(movement.id));
    const contrasting = fresh.filter((movement) => {
      const pattern = programmingPattern(movement);
      return pattern === "none" || pattern === "locomotion" || pattern === "core" || !usedPatterns.has(pattern);
    });
    const movement = (contrasting.length ? contrasting : fresh.length ? fresh : group)[0];
    if (!movement || used.has(movement.id)) continue;
    selected.push(movement);
    used.add(movement.id);
    const pattern = programmingPattern(movement);
    if (pattern !== "none" && pattern !== "locomotion" && pattern !== "core") usedPatterns.add(pattern);
  }

  const chipperBias = [0.45, 0.4, 0.4, 0.45, 0.65];
  return selected.map((movement, index) => ({
    id: movement.id,
    dose: coachDose(movement, brief.scheme, chipperBias[index] ?? 0.6),
  }));
}

export function buildFallbackClass(input: {
  assignment: DayAssignment;
  shortlists: Shortlist[];
  items: InventoryItem[];
  caps: Set<string>;
  random: () => number;
}): ClassPlan {
  const usedIds: string[] = [];
  const pieces: PlannedPiece[] = input.assignment.pieces.map((brief, index) => {
    const movements = buildFallbackPiece(brief, input.shortlists[index], input.random, usedIds);
    usedIds.push(...movements.map((item) => item.id));
    return {
      kind: brief.kind,
      name: brief.name,
      scheme: brief.scheme,
      movements,
      estimatedDurationMin: brief.estimatedDurationMin,
    };
  });
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

function shortMovementName(id: string): string {
  return movementDisplayName(id)
    .replace(/^Dumbbell /, "")
    .replace(/^Kettlebell /, "")
    .replace(/ \(Wall\)$/, "");
}

function fallbackTitle(assignment: DayAssignment, pieces: PlannedPiece[]): string {
  const scored = pieces.filter((piece) => piece.kind !== "skill");
  const names = (scored.length ? scored : pieces)
    .flatMap((piece) => piece.movements.slice(0, 2))
    .map((item) => shortMovementName(item.id));
  const unique = [...new Set(names)];
  if (assignment.shape === "chipper" && unique.length >= 2) return `${unique[0]} Chipper`;
  if (unique.length >= 2) return `${unique[0]} & ${unique[1]}`;
  return unique[0] ?? "Garage Session";
}

function fallbackStimulus(assignment: DayAssignment): string {
  if (assignment.focus === "heavy" || assignment.shape === "heavy") return "Heavy, deliberate sets. Stop before form breaks.";
  if (assignment.focus === "engine" || assignment.shape === "intervals") return "Same pace every window. Do not sprint the first.";
  if (assignment.focus === "gymnastics") return "Quality positions. Then move, but do not get sloppy.";
  if (assignment.shape === "chipper") return "One pass. Small bites, no long stops.";
  if (assignment.shape === "ladder") return "Unbroken early. Break only when the reps get heavy.";
  return "Hard, but repeatable. Break the grind, not the pace.";
}

export function aiWorkoutSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "stimulus", "pieces"],
    properties: {
      title: { type: "string" },
      stimulus: { type: "string" },
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
