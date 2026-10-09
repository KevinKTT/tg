import assert from "node:assert/strict";
import test from "node:test";
import { guardWorkout, schemeViolations, sessionDurationViolations, type GuardItem, type ProgramCheck } from "../lib/guard";

const dumbbells: GuardItem[] = [
  { slug: "db_20lb", name: "20 lb", category: "dumbbell", owned: true, loadValue: 20, unit: "lb" },
  { slug: "db_25lb", name: "25 lb", category: "dumbbell", owned: true, loadValue: 25, unit: "lb" },
];

function day(details: string, warmup = "jog and stretch", cooldown = "stretch", summary = "") {
  return {
    day: {
      summary,
      warmup,
      cooldown,
      parts: [{ name: "Metcon", details, equipment: [] }],
    },
  };
}

test("allows dumbbell versions of barbell movements", () => {
  const violations = guardWorkout(
    day("3 rounds: 10 dumbbell deadlifts, 10 dumbbell thrusters, 10 dumbbell front squats"),
    dumbbells,
  );
  assert.deepEqual(violations, []);
});

test("allows dumbbell snatches and cleans", () => {
  const violations = guardWorkout(
    day("5 rounds: 12 dumbbell snatches, 5 dumbbell hang power cleans"),
    dumbbells,
  );
  assert.deepEqual(violations, []);
});

test("rejects an explicit barbell that is not owned", () => {
  const violations = guardWorkout(day("5x5 barbell back squat"), dumbbells);
  assert.ok(violations.some((item) => /barbell/i.test(item)));
});

test("rejects an unqualified barbell movement that is not owned", () => {
  const violations = guardWorkout(day("5 rounds: 10 deadlifts, 5 cleans"), dumbbells);
  assert.ok(violations.some((item) => /barbell/i.test(item)));
});

const open: ProgramCheck = { load: "moderate", allowRun: true, allowHeavy: true };

test("rejects running when the assignment bans it", () => {
  const check: ProgramCheck = { ...open, allowRun: false };
  const violations = guardWorkout(day("4 rounds: 400m run, 15 air squats"), dumbbells, check);
  assert.ok(violations.some((item) => /running/i.test(item)));
});

test("rejects the lightest dumbbell on a heavy Rx line", () => {
  const check: ProgramCheck = { ...open, load: "heavy", allowHeavy: true };
  const violations = guardWorkout(
    day("Build to a heavy 3", "jog and stretch", "stretch", "Equipment: dumbbells\nLoads:\nRx — 20 lb\nPerformance — 15 lb"),
    dumbbells,
    check,
  );
  assert.ok(violations.some((item) => /lightest/i.test(item)));
});

function piece(format: string, overrides: Partial<{ name: string; kind: string; scoreType: string; timeCapMin: number | null }> = {}) {
  return {
    name: "Metcon",
    kind: "metcon",
    format,
    scoreType: "time",
    timeCapMin: null,
    ...overrides,
  };
}

test("rejects a metcon scheme with no count", () => {
  const problems = schemeViolations({
    warmup: "10 air squats",
    prep: "5 empty-bar squats",
    cooldown: "hamstring stretch",
    parts: [piece("Rounds for Time")],
  });
  assert.ok(problems.some((item) => /missing its count/i.test(item)));
});

test("rejects a metcon scheme written on the warm-up", () => {
  const problems = schemeViolations({
    warmup: "AMRAP 12\n- 10 burpees",
    cooldown: "stretch",
    parts: [piece("AMRAP 12", { scoreType: "rounds_reps", timeCapMin: 12 })],
  });
  assert.ok(problems.some((item) => /warm-up/i.test(item)));
});

test("rejects a clock on a piece that is not the metcon", () => {
  const problems = schemeViolations({
    warmup: "arm circles",
    cooldown: "stretch",
    parts: [piece("5x3", { name: "Squat", kind: "strength", scoreType: "load", timeCapMin: 8 }), piece("AMRAP 12", { scoreType: "rounds_reps", timeCapMin: 12 })],
  });
  assert.ok(problems.some((item) => /timeCapMin belongs on the metcon/i.test(item)));
});

test("allows a heavier dumbbell on a heavy Rx line", () => {
  const check: ProgramCheck = { ...open, load: "heavy", allowHeavy: true };
  const violations = guardWorkout(
    day("Build to a heavy 3", "jog and stretch", "stretch", "Equipment: dumbbells\nLoads:\nRx — 25 lb\nPerformance — 20 lb"),
    dumbbells,
    check,
  );
  assert.ok(!violations.some((item) => /lightest/i.test(item)));
});

test("accepts a complete 45 minute session", () => {
  const problems = sessionDurationViolations({
    warmupDurationMin: 9,
    prepDurationMin: 7,
    parts: [{ name: "Strength", estimatedDurationMin: 14 }, { name: "Metcon", estimatedDurationMin: 10 }],
    cooldownDurationMin: 5,
  });
  assert.deepEqual(problems, []);
});

test("rejects short sessions and missing section estimates", () => {
  assert.ok(
    sessionDurationViolations({
      warmupDurationMin: 6,
      prepDurationMin: 4,
      parts: [{ name: "Metcon", estimatedDurationMin: 10 }],
      cooldownDurationMin: 4,
    }).some((problem) => /24 minutes/.test(problem)),
  );
  assert.match(
    sessionDurationViolations({
      warmupDurationMin: 9,
      prepDurationMin: null,
      parts: [{ name: "Metcon", estimatedDurationMin: 25 }],
      cooldownDurationMin: 5,
    })[0],
    /workout prep/,
  );
});
