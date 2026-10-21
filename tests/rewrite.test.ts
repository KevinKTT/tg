import assert from "node:assert/strict";
import test from "node:test";
import { parseCoachRequest, rewriteIntent, rewriteTask } from "../lib/ai";
import type { EquipmentRow } from "../lib/db";
import { computeLoadPlan } from "../lib/load-plan";

test("a named workout replaces the day", () => {
  const chipper = parseCoachRequest("make it a chipper");
  assert.equal(chipper.kind, "rebuild");
  if (chipper.kind === "rebuild") assert.equal(chipper.shape, "chipper");

  const emom = parseCoachRequest("EMOM 12");
  assert.equal(emom.kind, "rebuild");
  if (emom.kind === "rebuild") {
    assert.equal(emom.shape, "emom");
    assert.deepEqual(emom.scheme, { type: "emom", minutes: 12 });
  }

  const strength = parseCoachRequest("strength then a metcon");
  assert.equal(strength.kind, "rebuild");
  if (strength.kind === "rebuild") assert.equal(strength.shape, "strength_metcon");

  const ladder = parseCoachRequest("21-15-9");
  assert.equal(ladder.kind, "rebuild");
  if (ladder.kind === "rebuild") {
    assert.equal(ladder.shape, "ladder");
    assert.deepEqual(ladder.scheme, { type: "ladder", reps: [21, 15, 9], capMin: 15 });
  }
});

test("a part fix does not rebuild the day", () => {
  assert.equal(parseCoachRequest("swap push-ups for burpees").kind, "edit");
  assert.equal(parseCoachRequest("make the lift heavier").kind, "edit");
  assert.equal(parseCoachRequest("make the AMRAP 12 minutes").kind, "edit");
  assert.match(rewriteTask("clarify", "swap push-ups for burpees"), /Change only what the note asks for/);
  assert.match(rewriteTask("clarify", "make it a chipper"), /Build the workout/);
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
