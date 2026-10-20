import assert from "node:assert/strict";
import test from "node:test";
import { rewriteIntent, rewriteTask } from "../lib/ai";
import type { EquipmentRow } from "../lib/db";
import { computeLoadPlan } from "../lib/load-plan";

test("clarify keeps the workout and only cleans the board", () => {
  const task = rewriteTask("clarify");
  assert.match(task, /Keep the same movements/);
  assert.match(task, /Do not invent a new piece/);
  assert.doesNotMatch(task, /Do not write an unrelated workout/);
});

test("a clarify note is passed through", () => {
  const task = rewriteTask("clarify", "Make this an AMRAP");
  assert.match(task, /Make this an AMRAP/);
  assert.match(task, /Keep the same movements/);
  assert.match(task, /Do not invent a new piece/);
});

test("load lines always name the male and female versions", () => {
  const dumbbells: EquipmentRow[] = [15, 20, 25, 30].map((weight) => ({
    slug: `db_${weight}lb`,
    name: `${weight} lb`,
    category: "dumbbell",
    kind: "implement",
    loadValue: weight,
    unit: "lb",
    quantity: 2,
    owned: true,
    custom: false,
    sort: 0,
  }));
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
  assert.equal(plan.lines.length, 3);
  const rx = plan.lines.find((line) => line.label === "Rx");
  assert.ok(rx);
  assert.match(rx.value, /KT 25 lb \/ HT 20 lb/);
});

test("a focus rewrite restyles this session", () => {
  assert.match(rewriteTask("heavy"), /toward heavy/);
  assert.match(rewriteTask("heavy"), /Keep the same scheme/);
  assert.match(rewriteTask("cardio"), /toward cardio/);
  assert.equal(rewriteIntent("clarify"), "clarify");
  assert.equal(rewriteIntent("heavy"), "heavy");
  assert.equal(rewriteIntent("rest"), null);
  assert.equal(rewriteIntent("nope"), null);
});
