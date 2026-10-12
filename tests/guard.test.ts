import assert from "node:assert/strict";
import test from "node:test";
import { coherenceFindings, guardWorkout, reviewWorkout, schemeViolations, scalingFindings, sessionDurationViolations, type GuardItem, type ProgramCheck } from "../lib/guard";

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

test("allows a kipping handstand push-up without a pull-up bar", () => {
  const violations = guardWorkout(day("5 kipping handstand push-ups"), dumbbells);
  assert.ok(!violations.some((item) => /pull-up bar/i.test(item)));
});

test("still requires a pull-up bar for kipping pull-ups", () => {
  const violations = guardWorkout(day("5 kipping pull-ups"), dumbbells);
  assert.ok(violations.some((item) => /pull-up bar/i.test(item)));
});

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

test("flags a loads block that is missing a tier", () => {
  assert.ok(scalingFindings("Equipment: dumbbells\nLoads:\nRx — 25 lb").some((item) => /performance/i.test(item)));
  assert.deepEqual(scalingFindings("Equipment: dumbbells\nLoads:\nRx — 25 lb\nPerformance — 20 lb\nLifestyle — 15 lb"), []);
  assert.ok(scalingFindings("no loads here").length > 0);
});

test("coherence flags an incoherent interval and a mismatched score", () => {
  const problems = coherenceFindings([
    { name: "Intervals", kind: "metcon", format: "4 rounds: 2:00 on / 1:00 off", details: "20 jump rope\n40 ft carry", scoreType: "done", timeCapMin: null },
  ]);
  assert.ok(problems.some((item) => /fixed reps inside a timed interval/i.test(item)));
  const mismatch = coherenceFindings([
    { name: "Metcon", kind: "metcon", format: "AMRAP 12", details: "10 burpees", scoreType: "time", timeCapMin: null },
  ]);
  assert.ok(mismatch.some((item) => /AMRAP/i.test(item)));
});

test("coherence flags two metcons and load-scored strength without heavy gear", () => {
  const problems = coherenceFindings(
    [
      { name: "A", kind: "metcon", format: "AMRAP 10", details: "x", scoreType: "rounds_reps", timeCapMin: null },
      { name: "B", kind: "metcon", format: "AMRAP 10", details: "x", scoreType: "rounds_reps", timeCapMin: null },
      { name: "Lift", kind: "strength", format: "5x5", details: "press", scoreType: "load", timeCapMin: null },
    ],
    new Set(["bodyweight"]),
  );
  assert.ok(problems.some((item) => /more than one scored metcon/i.test(item)));
  assert.ok(problems.some((item) => /no heavy implement/i.test(item)));
});

test("reviewWorkout returns advisories without throwing", () => {
  const findings = reviewWorkout({
    parsed: {
      summary: "Equipment: dumbbells",
      warmup: "5 jumping jacks",
      prep: "5 empty squats",
      cooldown: "hamstring stretch",
      warmupDurationMin: 6,
      prepDurationMin: 4,
      cooldownDurationMin: 4,
      parts: [
        {
          name: "Metcon",
          kind: "metcon",
          format: "AMRAP 12",
          details: "10 dumbbell deadlifts",
          equipment: ["dumbbell"],
          scoreType: "rounds_reps",
          timeCapMin: null,
          estimatedDurationMin: 10,
        },
      ],
    },
    items: dumbbells,
  });
  assert.ok(findings.some((item) => /Loads/i.test(item)));
  assert.ok(findings.some((item) => /minutes/.test(item)));
});
