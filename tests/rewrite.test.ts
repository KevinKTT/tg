import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCoachRequest, rewriteDay, rewriteIntent, rewriteTask } from "../lib/ai";
import { addAthlete, getDay, saveGeneratedDay, setOwned } from "../lib/db";
import type { EquipmentRow } from "../lib/db";
import { renderPieceBody } from "../lib/engine/class";
import { doseText, movementById } from "../lib/engine/movements";
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

test("a listed workout is written as named", () => {
  const request = parseCoachRequest(
    "Please make the workout for today be a AMRAP 10 cal row, 10 chin to bar, 10 box step ups, and 10 barbell push press",
  );
  assert.equal(request.kind, "prescribe");
  if (request.kind !== "prescribe") return;
  assert.deepEqual(request.scheme, { type: "amrap", minutes: 12 });
  assert.deepEqual(request.movements, [
    { id: "row", dose: { cal: 10 } },
    { id: "pull-up", dose: { reps: 10 } },
    { id: "step-up", dose: { reps: 10, eachSide: false } },
    { id: "push_press", dose: { reps: 10 } },
  ]);
  assert.equal(parseCoachRequest("make the workout be a chipper").kind, "rebuild");
});

test("a vest amrap is the workout that was named", () => {
  const request = parseCoachRequest(
    "please make workout weighted vest 18 min amrap with 1 minute bar hang, 10 box get overs, and 200m weighted vest run",
  );
  assert.equal(request.kind, "prescribe");
  if (request.kind !== "prescribe") return;
  assert.equal(request.vest, true);
  assert.deepEqual(request.scheme, { type: "amrap", minutes: 18 });
  assert.deepEqual(request.movements, [
    { id: "bar-hang", dose: { seconds: 60 } },
    { id: "box-jump-over", dose: { reps: 10 } },
    { id: "weighted-vest-run", dose: { meters: 200 } },
  ]);

  const hang = movementById("bar-hang");
  assert.ok(hang);
  assert.equal(doseText(hang, { seconds: 60 }), "1 min");
  assert.equal(
    renderPieceBody({
      kind: "metcon",
      name: "Workout",
      scheme: request.scheme,
      movements: request.movements,
      estimatedDurationMin: 18,
      cue: "Weight vest",
    }),
    "Weight vest\n- 1 min Bar Hang\n- 10 Box Jump-Over\n- 200 m Weighted Vest Run",
  );
});

test("a spoken amrap is the workout that was named", () => {
  const request = parseCoachRequest(
    "make an 18 minute AMRAP with a 400m run, row 10 cals, and then do push press",
  );
  assert.equal(request.kind, "prescribe");
  if (request.kind !== "prescribe") return;
  assert.deepEqual(request.scheme, { type: "amrap", minutes: 18 });
  assert.deepEqual(request.movements, [
    { id: "run", dose: { meters: 400 } },
    { id: "row", dose: { cal: 10 } },
    { id: "push_press", dose: { reps: 8 } },
  ]);
  assert.equal(
    renderPieceBody({
      kind: "metcon",
      name: "Workout",
      scheme: request.scheme,
      movements: request.movements,
      estimatedDurationMin: 18,
    }),
    "- 400 m Run\n- 10 cal Row\n- 8 Push press",
  );
});

test("an unknown movement is kept in the workout that was named", () => {
  const request = parseCoachRequest("18 min amrap with 1 minute flarble, 10 box get overs, and 200m weighted vest run");
  assert.equal(request.kind, "prescribe");
  if (request.kind !== "prescribe") return;
  assert.deepEqual(request.scheme, { type: "amrap", minutes: 18 });
  assert.deepEqual(request.movements, [
    { id: "note-flarble", dose: { seconds: 60 } },
    { id: "box-jump-over", dose: { reps: 10 } },
    { id: "weighted-vest-run", dose: { meters: 200 } },
  ]);
  assert.equal(
    renderPieceBody({
      kind: "metcon",
      name: "Workout",
      scheme: request.scheme,
      movements: request.movements,
      estimatedDurationMin: 18,
    }),
    "- 1 min Flarble\n- 10 Box Jump-Over\n- 200 m Weighted Vest Run",
  );
});

test("a listed amrap keeps the clock and every movement", () => {
  const request = parseCoachRequest(
    "AMRAP 18. 20 sec wall handstand hold, 10 cals rowing , 400 meter run, 10 dumbell snatch",
  );
  assert.equal(request.kind, "prescribe");
  if (request.kind !== "prescribe") return;
  assert.deepEqual(request.scheme, { type: "amrap", minutes: 18 });
  assert.deepEqual(request.movements, [
    { id: "handstand-hold", dose: { seconds: 20 } },
    { id: "row", dose: { cal: 10 } },
    { id: "run", dose: { meters: 400 } },
    { id: "db-power-snatch", dose: { reps: 10, eachSide: false } },
  ]);
  assert.equal(
    renderPieceBody({
      kind: "metcon",
      name: "Workout",
      scheme: request.scheme,
      movements: request.movements,
      estimatedDurationMin: 18,
    }),
    "- 20 sec Wall-Facing Handstand Hold\n- 10 cal Row\n- 400 m Run\n- 10 Dumbbell Power Snatch",
  );

  const rowing = parseCoachRequest("AMRAP 18 with 10 rowing cals and 10 snatch");
  assert.equal(rowing.kind, "prescribe");
  if (rowing.kind !== "prescribe") return;
  assert.deepEqual(rowing.scheme, { type: "amrap", minutes: 18 });
  assert.deepEqual(rowing.movements, [
    { id: "row", dose: { cal: 10 } },
    { id: "squat_snatch", dose: { reps: 10 } },
  ]);
});

test("clarify writes the named workout instead of stopping", async () => {
  process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "tg-")), "tg.sqlite");
  addAthlete({ name: "Kai", initials: "KT", sex: "m" });
  for (const slug of ["db_20lb", "rower", "running"]) setOwned(slug, true);
  const date = "2026-10-22";
  saveGeneratedDay({
    date,
    title: "Placeholder",
    stimulus: "Old",
    source: "programmed",
    sourceText: "",
    focus: "mixed",
    format: "amrap",
    snapshot: "[]",
    track: {
      summary: "",
      warmup: "Easy bike",
      warmupDurationMin: 5,
      prep: "",
      prepDurationMin: null,
      cooldown: "Walk",
      cooldownDurationMin: 3,
      parts: [
        {
          name: "Workout",
          kind: "metcon",
          format: "AMRAP 12",
          details: "- 10 Air Squat",
          timeCapMin: 12,
          estimatedDurationMin: 12,
          scoreType: "rounds_reps",
          repsPerRound: null,
          scheme: { type: "amrap", minutes: 12 },
          movements: [{ id: "air-squat", dose: { reps: 10 } }],
        },
      ],
    },
  });
  const result = await rewriteDay({
    date,
    intent: "clarify",
    note: "AMRAP 18. 20 sec wall handstand hold, 10 cals rowing , 400 meter run, 10 dumbell snatch",
  });
  assert.equal(result.title, "Wall-Facing Handstand Hold & Row");
  const metcon = getDay(date)?.tracks[0]?.parts.find((part) => part.kind === "metcon");
  assert.equal(metcon?.format, "AMRAP 18");
  assert.equal(
    metcon?.body,
    "- 20 sec Wall-Facing Handstand Hold\n- 10 cal Row\n- 400 m Run\n- 10 Dumbbell Power Snatch",
  );
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
