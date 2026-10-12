import assert from "node:assert/strict";
import test from "node:test";
import { parseBoard, parseSummary } from "../lib/board";

test("collapses identical slash scales into one movement", () => {
  const [line] = parseBoard("- 10 dumbbell deadlifts (Rx) / 10 dumbbell deadlifts (Performance) / 10 dumbbell deadlifts (Lifestyle)");
  assert.equal(line.type, "move");
  if (line.type !== "move") return;
  assert.equal(line.reps, "10");
  assert.equal(line.name, "dumbbell deadlifts");
  assert.deepEqual(line.scales, []);
});

test("keeps only the scales that differ from Rx", () => {
  const [line] = parseBoard(
    "- 40 single-unders (Rx) / 40 single-unders (Performance) / 30 single-unders (Lifestyle)",
  );
  assert.equal(line.type, "move");
  if (line.type !== "move") return;
  assert.equal(line.reps, "40");
  assert.equal(line.name, "single-unders");
  assert.deepEqual(line.scales, [{ label: "Lifestyle", text: "30 single-unders" }]);
});

test("attaches scale lines to the previous movement and drops duplicates", () => {
  const lines = parseBoard(`- 20 Double-unders
- Performance: 40 Single-unders
- Lifestyle: 20 Double-unders
- 10 Dumbbell deadlifts`);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].type, "move");
  if (lines[0].type !== "move") return;
  assert.equal(lines[0].reps, "20");
  assert.equal(lines[0].name, "Double-unders");
  assert.deepEqual(lines[0].scales, [{ label: "Performance", text: "40 Single-unders" }]);
});

test("strips coaching cues and lays out an EMOM minute", () => {
  const [line] = parseBoard("- Minute 1: 30 single-unders, focus on wrist speed and soft knees");
  assert.equal(line.type, "move");
  if (line.type !== "move") return;
  assert.equal(line.reps, "1");
  assert.equal(line.name, "30 single-unders");
});

test("keeps distance and per-side units with the dose", () => {
  const walk = parseBoard("- 80 m Weighted Vest Walk")[0];
  assert.equal(walk.type, "move");
  if (walk.type !== "move") return;
  assert.equal(walk.reps, "80 m");
  assert.equal(walk.name, "Weighted Vest Walk");

  const stretch = parseBoard("- 30 sec/side Levator Scapulae Stretch")[0];
  assert.equal(stretch.type, "move");
  if (stretch.type !== "move") return;
  assert.equal(stretch.reps, "30 sec/side");
  assert.equal(stretch.name, "Levator Scapulae Stretch");

  const pose = parseBoard("- 60 sec Sphinx Pose")[0];
  assert.equal(pose.type, "move");
  if (pose.type !== "move") return;
  assert.equal(pose.reps, "60 sec");
  assert.equal(pose.name, "Sphinx Pose");
});

test("treats Station and Round prefixes as labels", () => {
  const [station] = parseBoard("- Station 1: 20 Jump Rope Bell");
  assert.equal(station.type, "move");
  if (station.type !== "move") return;
  assert.equal(station.reps, "1");
  assert.equal(station.name, "20 Jump Rope Bell");

  const [round] = parseBoard("- Round 2: 15 burpees");
  assert.equal(round.type, "move");
  if (round.type !== "move") return;
  assert.equal(round.reps, "2");
  assert.equal(round.name, "15 burpees");
});

test("treats rest instructions as notes", () => {
  const [line] = parseBoard("- Rest 1 min between rounds. Score total time including rest.");
  assert.deepEqual(line, { type: "note", text: "Rest 1 min between rounds. Score total time including rest." });
});

test("parses equipment and loads from a smashed summary", () => {
  const summary = parseSummary(
    "Equipment: jump rope, dumbbells, weight vest (optional for Lifestyle only — not used).\nLoads: Rx — KT 25 lb / HT 25 lb · Performance — KT 20 lb / HT 20 lb · Lifestyle — KT 15 lb / HT 15 lb",
  );
  assert.deepEqual(summary.equipment, ["jump rope", "dumbbells", "weight vest"]);
  assert.deepEqual(summary.loads, [
    { label: "Rx", value: "KT 25 lb / HT 25 lb" },
    { label: "Performance", value: "KT 20 lb / HT 20 lb" },
    { label: "Lifestyle", value: "KT 15 lb / HT 15 lb" },
  ]);
});

test("parses loads written on their own lines", () => {
  const summary = parseSummary("Equipment: dumbbells\nLoads:\nRx — 25 lb\nPerformance — 20 lb\nLifestyle — 15 lb");
  assert.equal(summary.loads.length, 3);
  assert.equal(summary.loads[2].value, "15 lb");
});

test("parses loads smashed onto one line without polluting equipment", () => {
  const summary = parseSummary(
    "Equipment: dumbbells, jump rope, plyo box. Loads: Rx — KT 25 lb / HT 20 lb. Performance — KT 20 lb / HT 15 lb. Lifestyle — KT 15 lb / HT 15 lb.",
  );
  assert.deepEqual(summary.equipment, ["dumbbells", "jump rope", "plyo box"]);
  assert.deepEqual(
    summary.loads.map((row) => row.label),
    ["Rx", "Performance", "Lifestyle"],
  );
  assert.equal(summary.loads[0].value, "KT 25 lb / HT 20 lb");
});
