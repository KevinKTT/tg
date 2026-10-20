import assert from "node:assert/strict";
import test from "node:test";
import { addDays, isISODate, monthMatrix, startOfWeek, todayISO } from "../lib/dates";
import { EQUIPMENT } from "../lib/catalog";
import { equipmentProfile, movementById, movementEligible } from "../lib/engine/movements";
import { findPercents } from "../lib/resolve";
import { closestLoad, loadBar } from "../lib/scaling";
import { formatTime, normalizeScore, roundsValue } from "../lib/scoring";

const plates = [
  { lb: 45, quantity: 4, label: "45 lb" },
  { lb: 25, quantity: 2, label: "25 lb" },
  { lb: 10, quantity: 2, label: "10 lb" },
  { lb: 5, quantity: 2, label: "5 lb" },
  { lb: 2.5, quantity: 2, label: "2.5 lb" },
];

test("loads a bar with pairs only", () => {
  const loaded = loadBar(185, 45, plates);
  assert.equal(loaded.achievable, true);
  assert.equal(loaded.loaded, 185);
  assert.match(loaded.label, /45/);
});

test("snaps to the closest loadable weight", () => {
  const loaded = closestLoad(132, 45, plates);
  assert.ok(loaded);
  assert.equal(loaded?.achievable, true);
  assert.equal(loaded?.loaded, 130);
});

test("normalizes scores", () => {
  assert.deepEqual(normalizeScore({ scoreType: "time", minutes: 3, seconds: 7 }), { value: 187, display: "3:07" });
  assert.deepEqual(normalizeScore({ scoreType: "done" }), { value: 1, display: "Done" });
  assert.equal(formatTime(65), "1:05");
  assert.equal(roundsValue(8, 15), 80015);
  const load = normalizeScore({ scoreType: "load", load: 60, unit: "kg" });
  assert.ok(load);
  assert.equal(load?.display, "60 kg");
  assert.ok(Math.abs((load?.value ?? 0) - 132.277) < 0.01);
});

test("movement eligibility follows owned gear", () => {
  const ropeOnly = equipmentProfile([
    { slug: "jump_rope", category: "cardio", quantity: 1, owned: true },
  ]);
  assert.equal(movementEligible(movementById("row")!, ropeOnly), false);
  assert.equal(movementEligible(movementById("box-jump")!, ropeOnly), false);
  assert.equal(movementEligible(movementById("weighted-vest-walk")!, ropeOnly), false);
  assert.equal(movementEligible(movementById("air-squat")!, ropeOnly), true);
  assert.equal(movementEligible(movementById("back_squat")!, ropeOnly), false);

  const full = equipmentProfile([
    { slug: "jump_rope", category: "cardio", quantity: 1, owned: true },
    { slug: "rower", category: "cardio", quantity: 1, owned: true },
    { slug: "box_20", category: "rig", quantity: 1, owned: true },
    { slug: "weight_vest", category: "odd", quantity: 1, owned: true },
    { slug: "mens_bar", category: "barbell", kind: "bar", loadValue: 45, unit: "lb", quantity: 1, owned: true },
    { slug: "plate_45lb", category: "plates", quantity: 2, owned: true },
  ]);
  assert.equal(movementEligible(movementById("row")!, full), true);
  assert.equal(movementEligible(movementById("box-jump")!, full), true);
  assert.equal(movementEligible(movementById("weighted-vest-walk")!, full), true);
  assert.equal(movementEligible(movementById("back_squat")!, full), true);
});

test("catalog offers dumbbells to mark owned", () => {
  assert.ok(EQUIPMENT.some((item) => item.slug === "db_5lb" && item.loadValue === 5));
  assert.ok(EQUIPMENT.some((item) => item.slug === "db_25lb" && item.loadValue === 25));
});

test("two dumbbell movements require a pair", () => {
  const single = equipmentProfile([
    { slug: "db_35lb", category: "dumbbell", kind: "implement", loadValue: 35, unit: "lb", quantity: 1, owned: true },
  ]);
  const pair = equipmentProfile([
    { slug: "db_35lb", category: "dumbbell", kind: "implement", loadValue: 35, unit: "lb", quantity: 2, owned: true },
  ]);
  assert.equal(movementEligible(movementById("db-deadlift")!, single), false);
  assert.equal(movementEligible(movementById("db-deadlift")!, pair), true);
  assert.equal(movementEligible(movementById("db-suitcase-deadlift")!, single), true);
});

test("reads percentage prescriptions", () => {
  const hits = findPercents("5x5 @ 70% back squat, then 75% of max bench");
  assert.deepEqual(
    hits.map((hit) => hit.slug),
    ["back_squat", "bench_press"],
  );
});

test("dates stay on the calendar", () => {
  assert.equal(isISODate("2026-10-01"), true);
  assert.equal(isISODate("2026-13-01"), false);
  assert.equal(addDays("2026-10-01", 1), "2026-10-02");
  assert.equal(startOfWeek("2026-10-01"), "2026-09-28");
  const october = monthMatrix(2026, 10);
  assert.equal(october[0].iso, "2026-09-27");
  assert.equal(october[0].inMonth, false);
  assert.equal(october[4].iso, "2026-10-01");
  assert.equal(october[4].inMonth, true);
  assert.match(todayISO("UTC"), /^\d{4}-\d{2}-\d{2}$/);
});
