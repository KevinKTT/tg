import assert from "node:assert/strict";
import test from "node:test";
import { assignmentPrompt, inferProgram, planDay, tagFromDraft, type ProgramTag } from "../lib/program";

const gear = new Set(["dumbbell", "kettlebell", "running", "jump_rope", "barbell", "plates"]);

function tag(partial: Partial<ProgramTag> & Pick<ProgramTag, "load" | "pattern" | "mono" | "shape">): ProgramTag {
  return {
    elements: partial.elements ?? ["W"],
    load: partial.load,
    domain: partial.domain ?? "short",
    pattern: partial.pattern,
    mono: partial.mono,
    movements: partial.movements ?? [],
    shape: partial.shape,
    format: partial.format ?? "for_time",
  };
}

test("planDay may stack a heavy day", () => {
  const recent = [tag({ load: "heavy", pattern: "squat", mono: "none", shape: "heavy_only", format: "heavy", movements: ["back_squat"] })];
  for (let index = 0; index < 40; index += 1) {
    const plan = planDay({ caps: gear, recent, week: recent, bias: "heavy", random: () => index / 40 });
    assert.equal(plan.tag.load, "heavy");
    assert.equal(plan.focus, "heavy");
  }
});

test("planDay may stack a running day", () => {
  const recent = [tag({ load: "light", pattern: "none", mono: "run", shape: "intervals", format: "interval", elements: ["M"], movements: ["run"] })];
  const plans = Array.from({ length: 40 }, (_, index) => planDay({ caps: gear, recent, week: recent, random: () => index / 40 }));
  assert.ok(plans.some((plan) => plan.tag.mono === "run"));
});

test("planDay may repeat yesterday's pattern", () => {
  const recent = [tag({ load: "moderate", pattern: "squat", mono: "none", shape: "couplet", movements: ["thruster"] })];
  for (let index = 0; index < 40; index += 1) {
    const plan = planDay({ caps: gear, recent, week: recent, random: () => index / 40 });
    assert.ok(plan.tag.pattern.length > 0);
  }
});

test("a heavy bias after a heavy day still programs heavy", () => {
  const recent = [tag({ load: "heavy", pattern: "hinge", mono: "none", shape: "heavy_only", format: "heavy" })];
  const plan = planDay({ caps: gear, recent, week: recent, bias: "heavy", random: () => 0 });
  assert.equal(plan.focus, "heavy");
  assert.equal(plan.tag.load, "heavy");
});

test("no load gear never programs a heavy day", () => {
  const caps = new Set(["bodyweight", "jump_rope"]);
  for (let index = 0; index < 30; index += 1) {
    const plan = planDay({ caps, recent: [], week: [], random: () => index / 30 });
    assert.notEqual(plan.tag.load, "heavy");
    assert.notEqual(plan.tag.format, "heavy");
    assert.notEqual(plan.tag.mono, "run");
  }
});

test("inferProgram reads a run and a squat without needing the whiteboard later", () => {
  const inferred = inferProgram({
    focus: "mixed",
    format: "for_time",
    text: "21-15-9 back squats and a 400m run",
    stimulus: "about 8-12 min",
  });
  assert.equal(inferred.mono, "run");
  assert.equal(inferred.pattern, "squat");
  assert.ok(inferred.movements.includes("back_squat"));
  assert.ok(inferred.movements.includes("run"));
});

test("tagFromDraft keeps the movements that were actually written", () => {
  const base = tag({ load: "moderate", pattern: "press", mono: "none", shape: "couplet" });
  const next = tagFromDraft(base, "5 rounds of deadlifts and burpees");
  assert.equal(next.pattern, "hinge");
  assert.ok(next.movements.includes("deadlift"));
});

test("tagFromDraft keeps exact movement-library ids", () => {
  const base = tag({ load: "moderate", pattern: "hinge", mono: "none", shape: "couplet" });
  const next = tagFromDraft(base, "- 12 Dumbbell Suitcase Deadlift\n- 40 Jump Rope Boxer Step");
  assert.ok(next.movements.includes("db-suitcase-deadlift"));
  assert.ok(next.movements.includes("boxer-step"));
  assert.equal(next.mono, "jump_rope");
});

test("assignment prompt is tags, not a workout", () => {
  const recent = [tag({ load: "heavy", pattern: "squat", mono: "none", shape: "heavy_only", movements: ["back_squat"] })];
  const plan = planDay({ caps: gear, recent, week: recent, random: () => 0 });
  const prompt = assignmentPrompt(plan);
  assert.match(prompt, /back squat/);
  assert.match(prompt, /tags only/);
  assert.doesNotMatch(prompt, /21-15-9|Warm-up|5x5/);
});
