import assert from "node:assert/strict";
import test from "node:test";
import { rewriteIntent, rewriteTask } from "../lib/ai";

test("clarify keeps the workout and only cleans the board", () => {
  const task = rewriteTask("clarify");
  assert.match(task, /Keep the same movements/);
  assert.match(task, /Do not invent a new piece/);
  assert.doesNotMatch(task, /Do not write an unrelated workout/);
});

test("a focus rewrite restyles this session", () => {
  assert.match(rewriteTask("heavy"), /toward heavy/);
  assert.match(rewriteTask("heavy"), /Heavy bias/);
  assert.match(rewriteTask("cardio"), /toward cardio/);
  assert.match(rewriteTask("cardio"), /Cardio bias/);
  assert.equal(rewriteIntent("clarify"), "clarify");
  assert.equal(rewriteIntent("heavy"), "heavy");
  assert.equal(rewriteIntent("rest"), null);
  assert.equal(rewriteIntent("nope"), null);
});
