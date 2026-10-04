import assert from "node:assert/strict";
import test from "node:test";
import { guardWorkout, type GuardItem } from "../lib/guard";

const dumbbells: GuardItem[] = [
  { slug: "db_20lb", name: "20 lb", category: "dumbbell", owned: true, loadValue: 20, unit: "lb" },
  { slug: "db_25lb", name: "25 lb", category: "dumbbell", owned: true, loadValue: 25, unit: "lb" },
];

function day(details: string, warmup = "jog and stretch", cooldown = "stretch") {
  return {
    day: {
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
