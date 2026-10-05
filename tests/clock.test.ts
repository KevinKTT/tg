import assert from "node:assert/strict";
import test from "node:test";
import { clockFace, clockPlan, clockWorkout, splitElapsed, type ClockPart } from "../lib/clock";

function part(overrides: Partial<ClockPart> = {}): ClockPart {
  return {
    id: 1,
    name: "Metcon",
    kind: "metcon",
    scoreType: "time",
    timeCapSec: null,
    format: "For Time",
    ...overrides,
  };
}

test("for time counts up and saves", () => {
  const plan = clockPlan("for_time", part());
  assert.equal(plan.kind, "up");
  assert.equal(plan.savesTime, true);
  assert.equal(clockFace(plan, 187).display, "3:07");
});

test("a capped for-time counts down, then into overtime", () => {
  const plan = clockPlan("for_time", part({ timeCapSec: 720 }));
  assert.equal(plan.kind, "capped");
  assert.equal(plan.savesTime, true);
  assert.equal(clockFace(plan, 0).display, "12:00");
  assert.equal(clockFace(plan, 690).display, "0:30");
  assert.equal(clockFace(plan, 732).display, "+0:12");
  assert.equal(clockFace(plan, 732).caption, "Over");
});

test("AMRAP counts down and does not save a time", () => {
  const plan = clockPlan("amrap", part({ scoreType: "rounds_reps", timeCapSec: 720, format: "AMRAP" }));
  assert.equal(plan.kind, "down");
  assert.equal(plan.savesTime, false);
  assert.equal(clockFace(plan, 700).display, "0:20");
  assert.equal(clockFace(plan, 800).display, "0:00");
});

test("AMRAP 12 in the format is twelve minutes", () => {
  const plan = clockPlan("mixed", part({ scoreType: "rounds_reps", format: "AMRAP 12" }));
  assert.equal(plan.kind, "down");
  assert.equal(plan.seconds, 720);
});

test("EMOM resets every minute and does not save", () => {
  const plan = clockPlan("emom", part({ scoreType: "reps", format: "EMOM" }));
  assert.equal(plan.kind, "minute");
  assert.equal(plan.seconds, 60);
  assert.equal(plan.savesTime, false);
  assert.equal(clockFace(plan, 0).caption, "Min 1");
  assert.equal(clockFace(plan, 61).display, "0:01");
  assert.equal(clockFace(plan, 61).caption, "Min 2");
  assert.equal(clockFace(plan, 61).mark, 1);
});

test("E2MOM uses a two minute window", () => {
  const plan = clockPlan("emom", part({ scoreType: "reps", format: "E2MOM" }));
  assert.equal(plan.kind, "minute");
  assert.equal(plan.seconds, 120);
  assert.equal(clockFace(plan, 121).caption, "Rd 2");
});

test("a heavy lift counts down five minutes and resets", () => {
  const plan = clockPlan("heavy", part({ kind: "strength", scoreType: "load", format: "Heavy Day" }));
  assert.equal(plan.kind, "interval");
  assert.equal(plan.seconds, 300);
  assert.equal(plan.savesTime, false);
  assert.equal(clockFace(plan, 0).display, "5:00");
  assert.equal(clockFace(plan, 299).display, "0:01");
  assert.equal(clockFace(plan, 300).display, "5:00");
  assert.equal(clockFace(plan, 300).caption, "Set 2");
});

test("every 2:00 overrides the heavy window", () => {
  const plan = clockPlan("heavy", part({ scoreType: "load", format: "Every 2:00 x 5" }));
  assert.equal(plan.seconds, 120);
});

test("work and rest intervals alternate", () => {
  const plan = clockPlan("interval", part({ scoreType: "reps", format: "4x2:00 on / 1:00 off" }));
  assert.equal(plan.kind, "interval");
  assert.equal(plan.seconds, 120);
  assert.equal(plan.restSec, 60);
  assert.equal(clockFace(plan, 0).caption, "Work");
  assert.equal(clockFace(plan, 120).caption, "Rest");
  assert.equal(clockFace(plan, 120).display, "1:00");
  assert.equal(clockFace(plan, 180).caption, "Work");
});

test("the metcon is the default clock", () => {
  const workout = clockWorkout("skill_metcon", "2026-10-04", "kt", [
    part({ id: 2, name: "Squat", kind: "strength", scoreType: "load", format: "Heavy Day" }),
    part({ id: 3, name: "Fran", kind: "metcon", scoreType: "time", format: "For Time" }),
  ]);
  assert.equal(workout?.defaultId, 3);
  assert.equal(workout?.parts.length, 2);
});

test("elapsed time splits into the score fields", () => {
  assert.deepEqual(splitElapsed(187), { minutes: 3, seconds: 7 });
  assert.equal(splitElapsed(0), null);
});
