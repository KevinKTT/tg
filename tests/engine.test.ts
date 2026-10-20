import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildFallbackClass,
  parseAiWorkout,
  renderPieceBody,
  type AiWorkout,
} from "../lib/engine/class";
import {
  doseInRange,
  equipmentProfile,
  movementById,
  movementEligible,
} from "../lib/engine/movements";
import { planDay, shortlistForPiece, type RecentSignal } from "../lib/engine/planner";
import {
  capSecForScheme,
  formatText,
  scoreTypeForScheme,
  type Scheme,
} from "../lib/engine/scheme";
import { validateAiWorkout } from "../lib/engine/validate";
import type { InventoryItem } from "../lib/engine/movements";

function db(weight: number): InventoryItem {
  return { slug: `db_${weight}lb`, category: "dumbbell", kind: "implement", loadValue: weight, unit: "lb", quantity: 2, owned: true };
}

function item(slug: string, category: string): InventoryItem {
  return { slug, category, quantity: 1, owned: true };
}

const garage: InventoryItem[] = [
  ...[5, 10, 15, 20, 25].map(db),
  item("jump_rope", "cardio"),
  item("box_20", "rig"),
  item("rower", "cardio"),
  item("running", "cardio"),
  item("weight_vest", "odd"),
];

const profiles = {
  garage: equipmentProfile(garage),
  bodyweight: equipmentProfile([]),
  dumbbells: equipmentProfile([5, 10, 15, 20, 25].map(db)),
  full: equipmentProfile([
    ...[5, 10, 15, 20, 25, 35, 45].map(db),
    item("jump_rope", "cardio"),
    item("box_24", "rig"),
    item("rower", "cardio"),
    item("running", "cardio"),
    item("weight_vest", "odd"),
    item("mens_bar", "barbell"),
    item("plate_45lb", "plates"),
  ]),
};

test("scheme is the only source of score and cap", () => {
  const cases: [Scheme, string][] = [
    [{ type: "for_time", rounds: 5 }, "time"],
    [{ type: "amrap", minutes: 12 }, "rounds_reps"],
    [{ type: "emom", minutes: 10 }, "done"],
    [{ type: "intervals", rounds: 6, workSec: 60, restSec: 30, task: "fixed" }, "done"],
    [{ type: "intervals", rounds: 6, workSec: 60, restSec: 30, task: "amrap" }, "reps"],
    [{ type: "chipper", capMin: 25 }, "time"],
    [{ type: "ladder", reps: [21, 15, 9] }, "time"],
    [{ type: "strength", sets: 5, reps: "5", intent: "moderate" }, "done"],
    [{ type: "max_load", repMax: 3 }, "load"],
    [{ type: "max_reps", minutes: 5 }, "reps"],
    [{ type: "skill", minutes: 10 }, "none"],
  ];
  for (const [scheme, expected] of cases) {
    assert.equal(scoreTypeForScheme(scheme), expected);
  }
  assert.equal(capSecForScheme({ type: "chipper", capMin: 25 }), 1500);
  assert.equal(capSecForScheme({ type: "amrap", minutes: 12 }), null);
  assert.equal(formatText({ type: "amrap", minutes: 16 }), "AMRAP 16");
  assert.equal(formatText({ type: "for_time", rounds: 5 }), "5 rounds for time");
  assert.equal(formatText({ type: "ladder", reps: [21, 15, 9] }), "21-15-9 ladder for time");
});

test("planner produces a complete week without unowned gear", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    for (let offset = 0; offset < 14; offset += 1) {
      const date = `2026-11-${String(2 + offset).padStart(2, "0")}`;
      const assignment = planDay({ date, profile });
      assert.ok(assignment.pieces.length >= 1, `${name} ${date} has no pieces`);
      for (const [index, piece] of assignment.pieces.entries()) {
        const shortlist = shortlistForPiece(piece, profile, [], () => 0.5);
        assert.ok(shortlist.movements.length > 0, `${name} ${date} piece ${index} has no movements`);
        for (const movement of shortlist.movements) {
          assert.ok(movementEligible(movement, profile), `${name} ${date}: ${movement.name} needs unowned gear`);
        }
      }
    }
  }
});

test("fallback workouts use only owned gear and valid doses", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    for (let offset = 0; offset < 21; offset += 1) {
      const date = `2026-12-${String(1 + offset).padStart(2, "0")}`;
      const assignment = planDay({ date, profile });
      const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profile, [], () => 0.4));
      const plan = buildFallbackClass({ assignment, shortlists, items: garage, caps: profile.caps, random: () => 0.4 });
      assert.equal(plan.pieces.length, assignment.pieces.length);
      for (const piece of plan.pieces) {
        assert.ok(piece.movements.length > 0, `${name} ${date} fallback piece is empty`);
        for (const row of piece.movements) {
          const movement = movementById(row.id);
          assert.ok(movement, `${name} ${date}: unknown ${row.id}`);
          assert.ok(movementEligible(movement, profile), `${name} ${date}: ${movement?.name} needs unowned gear`);
          assert.ok(doseInRange(movement, row.dose, piece.scheme), `${name} ${date}: ${movement?.name} has an invalid dose`);
        }
      }
    }
  }
});

test("garage profile is not dumbbell-only", () => {
  let withoutDumbbell = 0;
  let withEngine = 0;
  for (let offset = 0; offset < 28; offset += 1) {
    const date = `2027-01-${String(1 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.garage });
    const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profiles.garage, [], () => 0.4));
    const plan = buildFallbackClass({ assignment, shortlists, items: garage, caps: profiles.garage.caps, random: () => 0.4 });
    const ids = plan.pieces.flatMap((piece) => piece.movements.map((item) => item.id));
    if (!ids.some((id) => movementById(id)?.load === "dumbbell")) withoutDumbbell += 1;
    if (ids.some((id) => movementById(id)?.modality === "M")) withEngine += 1;
  }
  assert.ok(withoutDumbbell >= 8, `only ${withoutDumbbell} of 28 days avoided dumbbells`);
  assert.ok(withEngine >= 10, `only ${withEngine} of 28 days used a monostructural movement`);
});

test("a full week caps dumbbell-led sessions", () => {
  let recent: RecentSignal[] = [];
  let dumbbellDays = 0;
  for (let offset = 0; offset < 6; offset += 1) {
    const date = `2027-01-${String(4 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.garage, recent });
    const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profiles.garage, assignment.avoidMovements, () => 0.4));
    const plan = buildFallbackClass({ assignment, shortlists, items: garage, caps: profiles.garage.caps, random: () => 0.4 });
    const ids = plan.pieces.flatMap((piece) => piece.movements.map((item) => item.id));
    if (ids.some((id) => movementById(id)?.load === "dumbbell")) dumbbellDays += 1;
    recent = [
      {
        date,
        pattern: assignment.pieces[0]?.pattern ?? "none",
        movements: ids,
        load: assignment.load,
      },
      ...recent,
    ];
  }
  assert.ok(dumbbellDays <= 3, `dumbbells led ${dumbbellDays} of 6 sessions`);
});

test("engine intervals are mixed-modal circuits scored by reps", () => {
  const assignment = planDay({ date: "2027-02-02", focus: "engine", profile: profiles.garage });
  assert.equal(assignment.shape, "intervals");
  const brief = assignment.pieces[0];
  assert.equal(brief.scheme.type, "intervals");
  if (brief.scheme.type !== "intervals") return;
  assert.equal(brief.scheme.task, "amrap");
  assert.equal(scoreTypeForScheme(brief.scheme), "reps");
  assert.ok(brief.movementCount.min >= 2, "interval circuit should require at least two movements");
  assert.ok(brief.modalities.includes("M"), "interval circuit should allow a monostructural station");
  assert.ok(brief.modalities.some((modality) => modality !== "M"), "interval circuit should allow a contrasting station");

  const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profiles.garage, [], () => 0.4));
  const plan = buildFallbackClass({ assignment, shortlists, items: garage, caps: profiles.garage.caps, random: () => 0.4 });
  const ids = plan.pieces.flatMap((piece) => piece.movements.map((item) => item.id));
  const modalities = new Set(ids.map((id) => movementById(id)?.modality));
  assert.ok(modalities.has("M"), "interval circuit lost its engine station");
  assert.ok([...modalities].some((modality) => modality !== "M"), "interval circuit is still single-modality");
});

test("metcons keep at least two modalities when the gym supports them", () => {
  for (let offset = 0; offset < 21; offset += 1) {
    const date = `2027-03-${String(1 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.garage });
    const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profiles.garage, [], () => 0.4));
    const plan = buildFallbackClass({ assignment, shortlists, items: garage, caps: profiles.garage.caps, random: () => 0.4 });
    assignment.pieces.forEach((brief, index) => {
      if (brief.kind !== "metcon" || brief.modalities.length < 2) return;
      const modalities = new Set(
        plan.pieces[index].movements
          .map((item) => movementById(item.id)?.modality)
          .filter(Boolean),
      );
      assert.ok(modalities.size >= 2, `${date} metcon is single-modality: ${[...modalities].join(", ")}`);
    });
  }
});

test("a generated body always renders movement lines", () => {
  const assignment = planDay({ date: "2026-11-02", profile: profiles.garage });
  const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profiles.garage, [], () => 0.4));
  const plan = buildFallbackClass({ assignment, shortlists, items: garage, caps: profiles.garage.caps, random: () => 0.4 });
  for (const piece of plan.pieces) {
    assert.match(renderPieceBody(piece), /^- /m);
  }
});

test("validation rejects unowned gear, duplicate patterns, and out-of-range doses", () => {
  const assignment = planDay({ date: "2026-11-02", profile: profiles.garage });
  const ai: AiWorkout = {
    title: "Test",
    stimulus: "Hard, but repeatable.",
    pieces: assignment.pieces.map((piece, index) => ({
      movements: index === 0
        ? [
            { id: "db-deadlift", dose: { reps: 10 } },
            { id: "back_squat", dose: { reps: 5 } },
          ]
        : [
            { id: "air-squat", dose: { reps: 20 } },
            { id: "goblet-squat", dose: { reps: 10 } },
            { id: "row", dose: { cal: 200 } },
          ],
    })),
  };
  const issues = validateAiWorkout({ assignment, ai, profile: profiles.garage });
  assert.ok(issues.some((issue) => /equipment you do not own/i.test(issue.message)));
  assert.ok(issues.some((issue) => /repeats the squat pattern/i.test(issue.message)));
  assert.ok(issues.some((issue) => /within cal 8-20/i.test(issue.message)));
});

test("the abandoned WOD archive is gone", () => {
  assert.equal(fs.existsSync("data/private"), false);
  assert.equal(fs.existsSync("data/private/crossfit_wods.json"), false);
});

test("AI parser rejects malformed pieces", () => {
  assert.equal(parseAiWorkout({ title: "x", stimulus: "y", pieces: [{ movements: [{ id: 3 }] }] }), null);
  const parsed = parseAiWorkout({
    title: "x",
    stimulus: "y",
    pieces: [{ movements: [{ id: "row", cal: 12 }] }],
  });
  assert.ok(parsed);
});
