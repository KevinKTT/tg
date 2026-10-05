import assert from "node:assert/strict";
import test from "node:test";
import { addDays, isISODate, monthMatrix, startOfWeek, todayISO } from "../lib/dates";
import { EQUIPMENT } from "../lib/catalog";
import { guardWorkout } from "../lib/guard";
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
  assert.equal(formatTime(65), "1:05");
  assert.equal(roundsValue(8, 15), 80015);
  const load = normalizeScore({ scoreType: "load", load: 60, unit: "kg" });
  assert.ok(load);
  assert.equal(load?.display, "60 kg");
  assert.ok(Math.abs((load?.value ?? 0) - 132.277) < 0.01);
});

test("rejects a rower that is not owned", () => {
  const violations = guardWorkout(
    {
      rx_men: {
        warmup: "2 min row",
        cooldown: "stretch",
        parts: [{ name: "Metcon", details: "500m row", equipment: ["rower"] }],
      },
    },
    [{ slug: "jump_rope", name: "Jump rope", category: "cardio", owned: true, loadValue: null, unit: null }],
  );
  assert.ok(violations.some((item) => /rower/i.test(item)));
});

test("allows air squats without a barbell", () => {
  const violations = guardWorkout(
    {
      rx_men: {
        warmup: "air squats",
        cooldown: "couch stretch",
        parts: [{ name: "Metcon", details: "50 air squats", equipment: [] }],
      },
    },
    [{ slug: "jump_rope", name: "Jump rope", category: "cardio", owned: true, loadValue: null, unit: null }],
  );
  assert.equal(violations.length, 0);
});

test("catalog offers dumbbells to mark owned", () => {
  assert.ok(EQUIPMENT.some((item) => item.slug === "db_5lb" && item.loadValue === 5));
  assert.ok(EQUIPMENT.some((item) => item.slug === "db_25lb" && item.loadValue === 25));
});

test("rejects a weight vest that is not owned", () => {
  const violations = guardWorkout(
    {
      day: {
        warmup: "easy walk",
        cooldown: "stretch",
        parts: [{ name: "Metcon", details: "20 burpees in a weighted vest", equipment: ["weight_vest"] }],
      },
    },
    [{ slug: "jump_rope", name: "Jump rope", category: "cardio", owned: true, loadValue: null, unit: null }],
  );
  assert.ok(violations.some((item) => /vest/i.test(item)));
});

test("rejects a kettlebell load that is not owned", () => {
  const violations = guardWorkout(
    {
      rx_men: {
        warmup: "arm circles",
        cooldown: "stretch",
        parts: [{ name: "Metcon", details: "20 24 kg kettlebell swings", equipment: [] }],
      },
    },
    [{ slug: "kb_16kg", name: "16 kg", category: "kettlebell", owned: true, loadValue: 16, unit: "kg" }],
  );
  assert.ok(violations.some((item) => /24 kg/.test(item)));
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
