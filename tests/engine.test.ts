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
import { hashString, planDay, shortlistForPiece, withMetconScheme, type DayAssignment, type RecentSignal } from "../lib/engine/planner";
import { isFiller, programmingPattern } from "../lib/engine/roles";
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

test("garage classes mix the equipment they own", () => {
  let withEngine = 0;
  const shapes = new Set<string>();
  for (let offset = 0; offset < 28; offset += 1) {
    const date = `2027-01-${String(1 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.garage });
    shapes.add(assignment.shape);
    for (const piece of assignment.pieces) {
      if (piece.kind !== "metcon") continue;
      assert.ok(piece.movementCount.min >= 3 && piece.movementCount.min <= 5, `${date} metcon has ${piece.movementCount.min} movements`);
      assert.equal(piece.movementCount.min, piece.movementCount.max);
    }
    const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profiles.garage, [], () => 0.4));
    const plan = buildFallbackClass({ assignment, shortlists, items: garage, caps: profiles.garage.caps, random: () => 0.4 });
    const movements = plan.pieces.flatMap((piece) => piece.movements.map((item) => movementById(item.id)));
    assert.ok(movements.some((movement) => movement && movement.load !== "dumbbell"), `${date} is only dumbbells`);
    if (movements.some((movement) => movement?.modality === "M")) withEngine += 1;
  }
  assert.ok(shapes.size >= 4, `only drew ${[...shapes].join(", ")}`);
  assert.ok(withEngine >= 10, `only ${withEngine} of 28 days used a monostructural movement`);
});

test("a class is drawn at random, and a named shape wins", () => {
  const wednesdays = ["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28", "2026-11-04", "2026-11-11"];
  const wednesdayShapes = new Set(wednesdays.map((date) => planDay({ date, profile: profiles.garage }).shape));
  assert.ok(wednesdayShapes.size > 1, `every Wednesday was ${[...wednesdayShapes].join(", ")}`);

  const date = "2026-10-21";
  assert.equal(planDay({ date, profile: profiles.garage }).shape, planDay({ date, profile: profiles.garage }).shape);
  const salted = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map((salt) => planDay({ date, profile: profiles.garage, salt }).shape));
  assert.ok(salted.size > 1, "a new salt never changed the class");

  const chipper = planDay({ date, profile: profiles.garage, shape: "chipper" });
  assert.equal(chipper.shape, "chipper");
  assert.equal(chipper.pieces.find((piece) => piece.kind === "metcon")?.movementCount.min, 5);

  const couplet = planDay({ date, profile: profiles.garage, shape: "couplet" });
  assert.equal(couplet.pieces.find((piece) => piece.kind === "metcon")?.movementCount.min, 2);
});

test("recent dumbbells do not collapse a strength day", () => {
  const recent: RecentSignal[] = [
    { date: "2026-10-20", pattern: "hinge", movements: ["db-thruster", "db-deadlift", "db-front-squat"], load: "moderate" },
  ];
  const assignment = planDay({ date: "2026-10-21", profile: profiles.garage, recent, shape: "strength_metcon" });
  assert.equal(assignment.shape, "strength_metcon");
  assert.equal(assignment.avoidDumbbell, false);
  const metcon = assignment.pieces.find((piece) => piece.kind === "metcon");
  assert.ok(metcon);
  assert.ok(metcon.movementCount.min >= 3);
  assert.ok(metcon.slots?.some((slot) => slot.role === "loaded"));
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
  const assignment = withMetconScheme(planDay({ date: "2026-11-02", profile: profiles.garage, shape: "strength_metcon" }), {
    type: "amrap",
    minutes: 12,
  });
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

test("fallback sessions are coach-readable CrossFit, not variation soup", () => {
  const banned = /plank|boxer|penguin|curtsy|gorilla|knee push|bear|inchworm|side swing|power skip/i;
  const anchors = new Set([
    "db-thruster",
    "db-deadlift",
    "db-front-squat",
    "goblet-squat",
    "db-push-press",
    "db-bent-over-row",
    "kb-swing",
    "burpee",
    "box-jump",
    "push-up",
    "air-squat",
    "row",
    "run",
    "double-under",
  ]);
  let anchored = 0;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = `2026-11-${String(2 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.garage });
    const shortlists = assignment.pieces.map((piece) => shortlistForPiece(piece, profiles.garage, [], () => 0.4));
    const plan = buildFallbackClass({
      assignment,
      shortlists,
      items: garage,
      caps: profiles.garage.caps,
      random: () => 0.4,
    });
    const ids = plan.pieces.flatMap((piece) => piece.movements.map((item) => item.id));
    if (ids.some((id) => anchors.has(id))) anchored += 1;
    for (const [index, piece] of plan.pieces.entries()) {
      const brief = assignment.pieces[index];
      assert.equal(piece.movements.length, brief.movementCount.min, `${date} ${piece.name} dropped a slot`);
      const patterns = new Set<string>();
      for (const row of piece.movements) {
        const movement = movementById(row.id);
        assert.ok(movement, row.id);
        assert.equal(isFiller(movement), false, `${date}: ${movement.name} is filler`);
        assert.doesNotMatch(movement.name, banned, `${date}: ${movement.name}`);
        const pattern = programmingPattern(movement);
        if (pattern !== "none" && pattern !== "locomotion" && pattern !== "core") {
          assert.equal(patterns.has(pattern), false, `${date}: repeated ${pattern}`);
          patterns.add(pattern);
        }
      }
      if (piece.kind === "strength") {
        assert.ok(piece.movements.every((row) => movementById(row.id)?.load), `${date} strength is unloaded`);
      }
    }
  }
  assert.equal(anchored, 14);
});

test("the abandoned WOD archive is gone", () => {
  assert.equal(fs.existsSync("data/private"), false);
  assert.equal(fs.existsSync("data/private/crossfit_wods.json"), false);
});

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sessionFingerprint(assignment: DayAssignment) {
  const shortlists = assignment.pieces.map((piece, index) =>
    shortlistForPiece(
      piece,
      profiles.garage,
      assignment.avoidMovements,
      seededRandom(hashString(`${assignment.seed}:${index}:${piece.name}`)),
    ),
  );
  const plan = buildFallbackClass({
    assignment,
    shortlists,
    items: garage,
    caps: profiles.garage.caps,
    random: seededRandom(assignment.seed + 7),
  });
  return {
    shape: assignment.shape,
    focus: assignment.focus,
    schemes: assignment.pieces.map((piece) => piece.scheme),
    ids: plan.pieces.flatMap((piece) => piece.movements.map((item) => item.id)),
    warmup: plan.warmup,
    cooldown: plan.cooldown,
  };
}

test("a salt replaces the session and an omitted salt stays on the date plan", () => {
  const date = "2026-11-02";
  const base = planDay({ date, profile: profiles.garage });
  const repeated = planDay({ date, profile: profiles.garage });
  const zero = planDay({ date, profile: profiles.garage, salt: 0 });
  assert.deepEqual(repeated, base);
  assert.deepEqual(zero, base);

  const first = sessionFingerprint(planDay({ date, profile: profiles.garage, salt: 1 }));
  const second = sessionFingerprint(planDay({ date, profile: profiles.garage, salt: 2 }));
  const original = sessionFingerprint(base);
  const fingerprint = (value: ReturnType<typeof sessionFingerprint>) =>
    JSON.stringify({ shape: value.shape, schemes: value.schemes, ids: value.ids, warmup: value.warmup, cooldown: value.cooldown });
  assert.notEqual(fingerprint(first), fingerprint(original));
  assert.notEqual(fingerprint(second), fingerprint(first));
  assert.notEqual(first.warmup, original.warmup);
  assert.notEqual(first.cooldown, original.cooldown);

  const avoided = planDay({ date, profile: profiles.garage, avoid: ["burpee"] });
  assert.ok(avoided.avoidMovements.includes("burpee"));
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
