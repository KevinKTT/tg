import assert from "node:assert/strict";
import test from "node:test";
import { FORMATS, formatById, formatFitsGear, formatFromScheme, formatPool, pickFormat } from "../lib/formats";

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
