import assert from "node:assert/strict";
import test from "node:test";
import type { EquipmentRow, PrRow } from "../lib/db";
import { computeLoadPlan, ensureLoadLines, implementCategory, loadPlanPrompt } from "../lib/load-plan";

function db(weight: number, unit: "lb" | "kg" = "lb"): EquipmentRow {
  return {
    slug: `db_${weight}${unit}`,
    name: `${weight} ${unit}`,
    category: "dumbbell",
    kind: "implement",
    loadValue: weight,
    unit,
    quantity: 2,
    owned: true,
    custom: false,
    sort: 0,
  };
}

const dumbbells = [15, 20, 25, 30, 35].map((weight) => db(weight));

function pr(value: number): PrRow {
  return { id: 1, athleteSlug: "kt", movementSlug: "db-deadlift", value, unit: "lb", display: `${value} lb`, date: "2026-01-01", notes: "" };
}

test("every plan carries Rx, Performance, and Lifestyle", () => {
  const plan = computeLoadPlan({
    items: dumbbells,
    members: [{ slug: "kt", initials: "KT", sex: "m" }],
    prs: [],
    load: "moderate",
    movements: [{ slug: "db-deadlift", name: "Dumbbell Deadlift" }],
  });
  assert.deepEqual(
    plan.lines.map((line) => line.label),
    ["Rx", "Performance", "Lifestyle"],
  );
  assert.ok(plan.lines.every((line) => /\d/.test(line.value)));
});

test("names every member when a roster exists", () => {
  const plan = computeLoadPlan({
    items: dumbbells,
    members: [
      { slug: "kt", initials: "KT", sex: "m" },
      { slug: "ht", initials: "HT", sex: "f" },
    ],
    prs: [],
    load: "moderate",
    movements: [{ slug: "db-deadlift", name: "Dumbbell Deadlift" }],
  });
  assert.equal(plan.lines[0].value, "KT 30 lb / HT 25 lb");
});

test("heavy uses a heavier implement than light", () => {
  const base = { items: dumbbells, members: [{ slug: "kt", initials: "KT", sex: "m" as const }], prs: [], movements: [{ slug: "db-deadlift", name: "Dumbbell Deadlift" }] };
  const heavy = computeLoadPlan({ ...base, load: "heavy" }).lines[0].value;
  const light = computeLoadPlan({ ...base, load: "light" }).lines[0].value;
  assert.notEqual(heavy, light);
});

test("uses a logged PR as the Rx anchor", () => {
  const plan = computeLoadPlan({
    items: dumbbells,
    members: [{ slug: "kt", initials: "KT", sex: "m" }],
    prs: [pr(40)],
    load: "heavy",
    movements: [{ slug: "db-deadlift", name: "Dumbbell Deadlift" }],
  });
  assert.equal(plan.lines[0].value, "KT 35 lb");
});

test("reports no loads when no external load is owned", () => {
  const plan = computeLoadPlan({
    items: [],
    members: [],
    prs: [],
    load: "moderate",
    movements: [{ slug: "db-deadlift", name: "Dumbbell Deadlift" }],
  });
  assert.equal(plan.hasLoads, false);
  assert.match(loadPlanPrompt(plan), /bodyweight/i);
});

test("frames computed loads as an anchor, not an exact prescription", () => {
  const plan = computeLoadPlan({
    items: dumbbells,
    members: [{ slug: "kt", initials: "KT", sex: "m" }],
    prs: [],
    load: "moderate",
    movements: [{ slug: "db-deadlift", name: "Dumbbell Deadlift" }],
  });
  const prompt = loadPlanPrompt(plan);
  assert.match(prompt, /anchor/i);
  assert.match(prompt, /not a movement-blind prescription/i);
  assert.doesNotMatch(prompt, /use these exact numbers/i);
  assert.match(prompt, /Rx: KT 30 lb/);
});

test("maps movement slugs to an implement category", () => {
  assert.equal(implementCategory("db-deadlift"), "dumbbell");
  assert.equal(implementCategory("deadlift"), "barbell");
  assert.equal(implementCategory("swing"), "kettlebell");
  assert.equal(implementCategory("burpee"), null);
});

test("emits per-movement scale lines", () => {
  const plan = computeLoadPlan({
    items: dumbbells,
    members: [{ slug: "kt", initials: "KT", sex: "m" }],
    prs: [],
    load: "moderate",
    movements: [{ slug: "db-deadlift", name: "Dumbbell Deadlift" }],
  });
  assert.equal(plan.byMovement.length, 1);
  assert.deepEqual(
    plan.byMovement[0].scales.map((scale) => scale.label),
    ["Rx", "Performance", "Lifestyle"],
  );
});

test("bodyweight movements get easier Performance and Lifestyle versions", () => {
  const plan = computeLoadPlan({
    items: dumbbells,
    members: [],
    prs: [],
    load: "moderate",
    movements: [{ slug: "air-squat", name: "Air Squat" }],
  });
  assert.deepEqual(
    plan.byMovement[0].scales.map((scale) => scale.label),
    ["Performance", "Lifestyle"],
  );
  assert.match(plan.byMovement[0].scales[0].text, /Squat to Target/i);
});

test("ensureLoadLines backfills missing tiers", () => {
  const fallback = [
    { label: "Rx", value: "25 lb" },
    { label: "Performance", value: "20 lb" },
    { label: "Lifestyle", value: "15 lb" },
  ];
  const merged = ensureLoadLines([{ label: "Rx", value: "model value" }], fallback);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].value, "model value");
  assert.equal(merged[1].label, "Performance");
});
