import assert from "node:assert/strict";
import test from "node:test";
import { FORMATS, formatById, formatFitsGear, formatFromScheme, formatPool, pickFormat, pieceScheme, visibleCap } from "../lib/formats";

test("format ids and labels are unique", () => {
  assert.equal(new Set(FORMATS.map((format) => format.id)).size, FORMATS.length);
  assert.equal(new Set(FORMATS.map((format) => format.label)).size, FORMATS.length);
});

test("every weekly focus has a format that needs no gear", () => {
  for (const focus of ["strength", "cardio", "mixed", "heavy"]) {
    const pool = formatPool(focus, new Set());
    assert.ok(pool.length > 0, `${focus} has no gear-free format`);
  }
});

test("heavy needs a load implement", () => {
  const heavy = formatById("heavy");
  assert.ok(heavy);
  assert.equal(formatFitsGear(heavy, new Set()), false);
  assert.equal(formatFitsGear(heavy, new Set(["jump_rope"])), false);
  assert.equal(formatFitsGear(heavy, new Set(["dumbbell"])), true);
});

test("benchmark needs a barbell", () => {
  const benchmark = formatById("benchmark");
  assert.ok(benchmark);
  assert.equal(formatFitsGear(benchmark, new Set(["dumbbell"])), false);
  assert.equal(formatFitsGear(benchmark, new Set(["barbell"])), true);
});

test("pickFormat avoids the recent formats", () => {
  const caps = new Set<string>();
  const pool = formatPool("cardio", caps).map((format) => format.id);
  assert.ok(pool.length > 1);
  const keep = pool[0];
  const recent = pool.slice(1);
  assert.equal(pickFormat("cardio", caps, recent).id, keep);
});

test("each scheme logs the matching score and never invents a cap", () => {
  assert.equal(pieceScheme("EMOM 12", "emom", "metcon")?.scoreType, "done");
  assert.equal(pieceScheme("EMOM 12", "emom", "metcon")?.allowCap, false);
  assert.equal(pieceScheme("AMRAP 12", "amrap", "metcon")?.scoreType, "rounds_reps");
  assert.equal(pieceScheme("5 rounds for time", "rounds", "metcon")?.scoreType, "time");
  assert.equal(pieceScheme("5 rounds for time, cap 12", "rounds", "metcon")?.allowCap, true);
  assert.equal(pieceScheme("4x2:00 on / 1:00 off", "interval", "metcon")?.scoreType, "done");
  assert.equal(pieceScheme("Build to a heavy 3", "heavy", "strength")?.scoreType, "load");
  assert.equal(pieceScheme("Skill practice", "skill_metcon", "skill")?.scoreType, "none");
  assert.equal(visibleCap("EMOM 12", "emom", "metcon", 720), null);
  assert.equal(visibleCap("5 rounds for time, cap 12", "rounds", "metcon", 720), 720);
});

test("a scheme with a count picks the day format", () => {
  assert.equal(formatFromScheme("AMRAP 12"), "amrap");
  assert.equal(formatFromScheme("5 rounds for time"), "rounds");
  assert.equal(formatFromScheme("EMOM 10"), "emom");
  assert.equal(formatFromScheme("For Time"), "for_time");
  assert.equal(formatFromScheme("Build to a heavy 3"), null);
});

test("pickFormat never returns heavy without load gear", () => {
  const caps = new Set(["jump_rope", "weight_vest"]);
  for (let index = 0; index < 50; index += 1) {
    assert.notEqual(pickFormat("heavy", caps, []).id, "heavy");
  }
});
