import { movementById, type Dose, type MovementDef } from "./movements";
import { programmingPattern } from "./roles";
import { capSecForScheme, type Scheme } from "./scheme";
import type { ClassPlan, PlannedPiece } from "./class";

/**
 * Quality is a second opinion on a class the engine already built.
 *
 * Everything here is deterministic and explainable. It exists because schema
 * validation only proves a workout is legal: a chipper of five dumbbell lifts
 * passes validation and is still a bad workout. These checks encode the
 * constraints a coach would actually apply.
 */

export type Severity = "hard" | "soft";

export type QualityIssue = {
  code: string;
  severity: Severity;
  piece?: number;
  message: string;
};

export type QualityAudit = {
  score: number;
  issues: QualityIssue[];
  hard: number;
  soft: number;
};

export type Stress = {
  /** The implement that fatigues locally: dumbbell, barbell, kettlebell. */
  implement: string | null;
  grip: boolean;
  overhead: boolean;
  axial: boolean;
  mono: boolean;
};

const GRIP = /(deadlift|clean|snatch|swing|carry|pull-up|chin-up|farmer|hang|shrug)/i;
const OVERHEAD = /(press|jerk|snatch|thruster|wall.?ball|overhead)/i;

export function movementStress(movement: MovementDef): Stress {
  const pattern = programmingPattern(movement);
  const loaded = movement.load != null;
  const mono = pattern === "locomotion";
  const implement =
    movement.load === "dumbbell" || movement.load === "barbell" || movement.load === "kettlebell"
      ? movement.load
      : null;
  const grip =
    !mono &&
    ((loaded &&
      (pattern === "hinge" ||
        pattern === "olympic" ||
        pattern === "carry" ||
        pattern === "pull" ||
        pattern === "lunge")) ||
      GRIP.test(movement.id) ||
      GRIP.test(movement.name));
  const overhead = !mono && (OVERHEAD.test(movement.id) || OVERHEAD.test(movement.name));
  const axial = loaded && (pattern === "squat" || pattern === "hinge" || pattern === "lunge" || pattern === "olympic");
  return { implement, grip, overhead, axial, mono };
}

/** Rough seconds of work for one dose. Heuristic on purpose: it only needs to catch outliers. */
export function movementSeconds(movement: MovementDef, dose: Dose): number {
  if (dose.seconds != null) return dose.seconds;
  if (dose.cal != null) return dose.cal * 4;
  if (dose.meters != null) return dose.meters * 0.27;
  if (dose.reps != null) {
    const perRep = movement.load ? (programmingPattern(movement) === "olympic" ? 4 : 3) : 2;
    const sides = dose.eachSide === true || (dose.eachSide !== false && movement.unilateral) ? 2 : 1;
    return dose.reps * perRep * sides;
  }
  return 10;
}

function repSchemeTotal(scheme: Scheme): number | null {
  if (scheme.type === "for_time" && scheme.repScheme?.length) {
    return scheme.repScheme.reduce((sum, value) => sum + value, 0);
  }
  if (scheme.type === "ladder") return scheme.reps.reduce((sum, value) => sum + value, 0);
  return null;
}

function roundSeconds(piece: PlannedPiece): number {
  const scheme = piece.scheme;
  const fixed = repSchemeTotal(scheme);
  return piece.movements.reduce((sum, item) => {
    const movement = movementById(item.id);
    if (!movement) return sum + 10;
    const base = fixed != null ? fixed * (movement.load ? 3 : 2) : movementSeconds(movement, item.dose);
    return sum + base;
  }, 0);
}

/** Total work in seconds for the whole scored piece. */
export function pieceWorkSeconds(piece: PlannedPiece): number {
  const scheme = piece.scheme;
  const round = roundSeconds(piece);
  if (scheme.type === "chipper") return round;
  if (scheme.type === "for_time") return scheme.rounds ? round * scheme.rounds : round;
  if (scheme.type === "ladder") return round;
  if (scheme.type === "amrap") return (round / 60) * scheme.minutes;
  if (scheme.type === "emom" || scheme.type === "intervals") {
    const minutes = scheme.type === "emom" ? scheme.minutes : (scheme.rounds * (scheme.workSec + scheme.restSec)) / 60;
    return (round / Math.max(1, piece.movements.length)) * minutes;
  }
  return round;
}

function runLengths(piece: PlannedPiece): { implement: string; length: number }[] {
  const runs: { implement: string; length: number }[] = [];
  let previous: string | null = null;
  let length = 0;
  for (const item of piece.movements) {
    const movement = movementById(item.id);
    const implement = movement ? movementStress(movement).implement : null;
    if (implement && implement === previous) {
      length += 1;
    } else {
      if (previous && length > 1) runs.push({ implement: previous, length });
      previous = implement;
      length = implement ? 1 : 0;
    }
  }
  if (previous && length > 1) runs.push({ implement: previous, length });
  return runs;
}

function pieceIssues(piece: PlannedPiece, index: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const stresses = piece.movements.flatMap((item) => {
    const movement = movementById(item.id);
    return movement ? [movementStress(movement)] : [];
  });
  const counts = new Map<string, number>();
  for (const stress of stresses) {
    if (!stress.implement) continue;
    counts.set(stress.implement, (counts.get(stress.implement) ?? 0) + 1);
  }
  for (const [implement, count] of counts) {
    if (count >= 4) {
      issues.push({
        code: "implement_stack",
        severity: "hard",
        piece: index,
        message: `${count} ${implement} movements in one piece. Vary the implement; local fatigue will decide this, not conditioning.`,
      });
    }
  }
  for (const run of runLengths(piece)) {
    if (run.length >= 3) {
      issues.push({
        code: "implement_run",
        severity: "hard",
        piece: index,
        message: `${run.length} ${run.implement} movements back to back. Break the run with a contrasting movement.`,
      });
    }
  }
  const grip = stresses.filter((stress) => stress.grip).length;
  if (grip >= 3) {
    issues.push({
      code: "grip_overload",
      severity: "hard",
      piece: index,
      message: `${grip} grip-taxing movements. Forearms will fail before the intended stimulus.`,
    });
  }
  const overhead = stresses.filter((stress) => stress.overhead).length;
  if (overhead >= 3) {
    issues.push({
      code: "overhead_stack",
      severity: "soft",
      piece: index,
      message: `${overhead} overhead movements. Shoulders carry the whole session.`,
    });
  }

  const scheme = piece.scheme;

  if ((scheme.type === "emom" || scheme.type === "intervals") && piece.movements.length) {
    const window = scheme.type === "emom" ? scheme.everySec ?? 60 : scheme.workSec;
    const slowest = Math.max(
      ...piece.movements.map((item) => {
        const movement = movementById(item.id);
        return movement ? movementSeconds(movement, item.dose) : 10;
      }),
    );
    if (slowest > window * 0.95) {
      issues.push({
        code: "station_too_long",
        severity: "hard",
        piece: index,
        message: `A station needs about ${Math.round(slowest)}s of a ${window}s window. There is no rest in the interval.`,
      });
    }
  }

  const scored =
    scheme.type === "chipper" ||
    scheme.type === "for_time" ||
    scheme.type === "ladder" ||
    scheme.type === "amrap";
  if (!scored) return issues;

  if (scheme.type === "amrap") {
    const round = roundSeconds(piece);
    if (round > 240) {
      issues.push({
        code: "round_too_long",
        severity: "hard",
        piece: index,
        message: `One round takes about ${Math.round(round / 60)} min. An AMRAP round should be repeatable.`,
      });
    } else if (round < 45) {
      issues.push({
        code: "round_too_short",
        severity: "soft",
        piece: index,
        message: `One round takes about ${Math.round(round)}s. The piece will be a sprint, not a test.`,
      });
    }
  }

  const cap = capSecForScheme(scheme);
  const work = pieceWorkSeconds(piece);
  if (cap) {
    if (work > cap * 1.05) {
      issues.push({
        code: "volume_over_cap",
        severity: "hard",
        piece: index,
        message: `About ${Math.round(work / 60)} min of work in a ${Math.round(cap / 60)} min cap. Cut volume or extend the cap.`,
      });
    } else if (work < cap * 0.3) {
      issues.push({
        code: "volume_under_cap",
        severity: "soft",
        piece: index,
        message: `About ${Math.round(work / 60)} min of work in a ${Math.round(cap / 60)} min cap. Most of the class is standing around.`,
      });
    }
  }
  return issues;
}

const PREP_REPEAT_LIMIT = 3;

function prepIssues(plan: ClassPlan): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const work = plan.pieces
    .filter((piece) => piece.kind !== "skill")
    .flatMap((piece) => piece.movements)
    .flatMap((item) => {
      const movement = movementById(item.id);
      return movement ? [movement.name.toLowerCase()] : [];
    });
  // Only count primer sets ("- 5 Dumbbell deadlift"), not drills that happen to
  // share a word ("- 2 x 10 High Single-Unders").
  const primer = plan.prep
    .toLowerCase()
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").replace(/^\d+\s*(?:cal|reps?|m|sec|seconds?|min|minutes?)?\s*/, "").trim());
  const repeated = [...new Set(work)].filter((name) => primer.some((line) => line === name || line.startsWith(`${name} `)));
  if (repeated.length >= PREP_REPEAT_LIMIT) {
    issues.push({
      code: "prep_repeats_work",
      severity: "hard",
      message: `The prep repeats ${repeated.length} of the workout movements. Prep should prime, not pre-fatigue.`,
    });
  }
  return issues;
}

function durationIssues(plan: ClassPlan): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const total =
    plan.warmupDurationMin +
    plan.prepDurationMin +
    plan.cooldownDurationMin +
    plan.pieces.reduce((sum, piece) => sum + piece.estimatedDurationMin, 0);
  if (total > 75) {
    issues.push({
      code: "class_too_long",
      severity: "soft",
      message: `The class runs about ${Math.round(total)} min, well past the 45 min target.`,
    });
  }
  return issues;
}

export function auditPlan(plan: ClassPlan): QualityAudit {
  const issues = [
    ...plan.pieces.flatMap((piece, index) => pieceIssues(piece, index)),
    ...prepIssues(plan),
    ...durationIssues(plan),
  ];
  const hard = issues.filter((issue) => issue.severity === "hard").length;
  const soft = issues.filter((issue) => issue.severity === "soft").length;
  const score = Math.max(0, 100 - hard * 40 - soft * 10);
  return { score, issues, hard, soft };
}

/** Best candidate wins: fewest hard issues, then fewest soft, then highest score. */
export function betterPlan(left: ClassPlan, right: ClassPlan): ClassPlan {
  const a = auditPlan(left);
  const b = auditPlan(right);
  if (a.hard !== b.hard) return a.hard < b.hard ? left : right;
  if (a.soft !== b.soft) return a.soft < b.soft ? left : right;
  return a.score >= b.score ? left : right;
}

/** A compact, human-readable state for a decision model to judge. */
export function describePlan(plan: ClassPlan): string {
  const lines = [
    `TITLE: ${plan.title}`,
    `STIMULUS: ${plan.stimulus}`,
    `FOCUS: ${plan.focus}`,
    "",
    "PREP:",
    plan.prep,
    "",
    "WORK:",
  ];
  for (const piece of plan.pieces) {
    lines.push(`${piece.name} — ${piece.scheme.type}`);
    for (const item of piece.movements) {
      const movement = movementById(item.id);
      const dose =
        item.dose.reps != null
          ? `${item.dose.reps} reps`
          : item.dose.cal != null
            ? `${item.dose.cal} cal`
            : item.dose.meters != null
              ? `${item.dose.meters} m`
              : item.dose.seconds != null
                ? `${item.dose.seconds} s`
                : "practice";
      lines.push(`- ${dose} ${movement?.name ?? item.id}`);
    }
  }
  return lines.join("\n");
}
