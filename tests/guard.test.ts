import assert from "node:assert/strict";
import test from "node:test";
import { guardWorkout, type GuardItem, type ProgramCheck } from "../lib/guard";

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

const open: ProgramCheck = { load: "moderate", allowRun: true, allowHeavy: true, bannedMovements: [] };

test("rejects running when the assignment bans it", () => {
  const check: ProgramCheck = { ...open, allowRun: false };
  const violations = guardWorkout(day("4 rounds: 400m run, 15 air squats"), dumbbells, check);
  assert.ok(violations.some((item) => /running/i.test(item)));
});

test("rejects a banned movement from yesterday", () => {
  const check: ProgramCheck = { ...open, bannedMovements: ["thruster"] };
  const violations = guardWorkout(day("21-15-9 dumbbell thrusters and burpees"), dumbbells, check);
  assert.ok(violations.some((item) => /thruster/i.test(item)));
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

test("allows a heavier dumbbell on a heavy Rx line", () => {
  const check: ProgramCheck = { ...open, load: "heavy", allowHeavy: true };
  const violations = guardWorkout(
    day("Build to a heavy 3", "jog and stretch", "stretch", "Equipment: dumbbells\nLoads:\nRx — 25 lb\nPerformance — 20 lb"),
    dumbbells,
    check,
  );
  assert.ok(!violations.some((item) => /lightest/i.test(item)));
});
