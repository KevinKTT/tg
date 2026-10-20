import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildFallbackClass,
  parseAiWorkout,
  renderPieceBody,
  repairAiCopy,
  type AiWorkout,
} from "../lib/engine/class";
import {
  doseInRange,
  equipmentProfile,
  movementById,
  movementEligible,
} from "../lib/engine/movements";
import { hashString, planDay, shortlistForPiece, type RecentSignal } from "../lib/engine/planner";
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

function seeded(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function fallbackPlan(assignment: ReturnType<typeof planDay>, profile = profiles.garage) {
  const shortlists = assignment.pieces.map((piece, index) =>
    shortlistForPiece(
      piece,
      profile,
      assignment.avoidMovements,
      seeded(hashString(`${assignment.seed}:${index}:${piece.name}`)),
    ),
  );
  return buildFallbackClass({
    assignment,
    shortlists,
    items: garage,
    caps: profile.caps,
    random: seeded(assignment.seed + 17),
  });
}

function movementIds(assignment: ReturnType<typeof planDay>, profile = profiles.garage) {
  return fallbackPlan(assignment, profile).pieces.flatMap((piece) => piece.movements.map((item) => item.id));
}

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

test("a full week caps dumbbell-led conditioning without stripping strength days", () => {
  const onlyDumbbells = [5, 10, 15, 20, 25].map(db);
  let recent: RecentSignal[] = [];
  let dumbbellDays = 0;
  let conditioningWithoutDumbbell = 0;
  for (let offset = 0; offset < 6; offset += 1) {
    const date = `2027-01-${String(4 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.dumbbells, recent });
    const shortlists = assignment.pieces.map((piece) =>
      shortlistForPiece(piece, profiles.dumbbells, assignment.avoidMovements, () => 0.4),
    );
    const plan = buildFallbackClass({
      assignment,
      shortlists,
      items: onlyDumbbells,
      caps: profiles.dumbbells.caps,
      random: () => 0.4,
    });
    const ids = plan.pieces.flatMap((piece) => piece.movements.map((item) => item.id));
    const hasDumbbell = ids.some((id) => movementById(id)?.load === "dumbbell");
    if (hasDumbbell) dumbbellDays += 1;
    if (!hasDumbbell && assignment.pieces.some((piece) => piece.kind === "metcon")) conditioningWithoutDumbbell += 1;
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
  assert.ok(conditioningWithoutDumbbell >= 2, "conditioning did not rotate away from dumbbells");
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

test("copy repair rescues a long, time-flavoured stimulus", () => {
  const assignment = planDay({ date: "2026-11-02", profile: profiles.garage });
  const ai: AiWorkout = {
    title: "Monostructural Modality Grinder",
    stimulus:
      "Settle in for about 12-18 min, then hold a hard, repeatable pace for the whole piece and never stop moving until the very end of the workout, no matter what.",
    pieces: [],
  };
  const repaired = repairAiCopy(ai, assignment);
  assert.ok(repaired.stimulus.length <= 140, repaired.stimulus);
  assert.doesNotMatch(repaired.stimulus, /\b\d+\s*(?:min|mins|minute|minutes|sec|secs|second|seconds)\b/i);
  assert.doesNotMatch(repaired.stimulus, /^then\b/i);
  assert.doesNotMatch(repaired.title, /\b(?:locomotion|monostructural|modality)\b/i);
  assert.ok(repaired.title.length <= 60);

  const punctuated = repairAiCopy(
    { ...ai, stimulus: "Heavy hinge sets, then steady EMOM work; keep transitions quick." },
    assignment,
  );
  assert.doesNotMatch(punctuated.stimulus, /;/);
  assert.match(punctuated.stimulus, /keep transitions quick/i);
});

test("regeneration varies the session instead of repeating the same workout", () => {
  let differences = 0;
  for (let offset = 0; offset < 8; offset += 1) {
    const date = `2027-04-${String(5 + offset).padStart(2, "0")}`;
    const first = planDay({ date, profile: profiles.garage, variant: "first" });
    const second = planDay({ date, profile: profiles.garage, variant: "second" });
    assert.notEqual(first.seed, second.seed);
    if (movementIds(first).join(",") !== movementIds(second).join(",")) differences += 1;
  }
  assert.ok(differences >= 6, `only ${differences} of 8 regenerations changed the movements`);
});

test("a replacement avoids the version already on the calendar", () => {
  const date = "2027-05-03";
  const first = planDay({ date, profile: profiles.garage, variant: "first" });
  const firstIds = movementIds(first);
  const second = planDay({
    date,
    profile: profiles.garage,
    variant: "second",
    previous: { pattern: first.pieces[0]?.pattern, movements: firstIds },
  });
  assert.ok(firstIds.every((id) => second.avoidMovements.includes(id)));
  assert.ok(second.avoidPatterns.includes(first.pieces[0]!.pattern));
});

test("auto weeks rotate through EMOM, ladder, and max-effort sessions", () => {
  const shapes = new Set<string>();
  for (let offset = 0; offset < 28; offset += 1) {
    const date = `2027-06-${String(1 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.garage });
    shapes.add(assignment.shape);
  }
  assert.ok(shapes.has("emom"), `shapes: ${[...shapes].join(", ")}`);
  assert.ok(shapes.has("ladder"), `shapes: ${[...shapes].join(", ")}`);
  assert.ok(shapes.has("max_effort"), `shapes: ${[...shapes].join(", ")}`);
});

test("auto programming does not drift into an all-EMOM week", () => {
  let metcons = 0;
  let emoms = 0;
  for (let offset = 0; offset < 28; offset += 1) {
    const date = `2027-09-${String(1 + offset).padStart(2, "0")}`;
    const assignment = planDay({ date, profile: profiles.garage, variant: "variety-check" });
    for (const piece of assignment.pieces) {
      if (piece.kind !== "metcon") continue;
      metcons += 1;
      if (piece.scheme.type === "emom") emoms += 1;
    }
  }
  assert.ok(emoms <= 4, `${emoms} of ${metcons} metcons were EMOMs`);
  assert.ok(emoms / metcons < 0.25, `${emoms} of ${metcons} metcons were EMOMs`);
});

test("dumbbell fatigue does not turn a heavy day into gymnastics", () => {
  for (const date of ["2027-07-08", "2027-07-15", "2027-07-22", "2027-07-29"]) {
    const recent: RecentSignal[] = [
      { date, pattern: "squat", movements: ["db-deadlift"], load: "moderate" },
      { date, pattern: "press", movements: ["db-strict-press"], load: "moderate" },
    ];
    const assignment = planDay({ date, profile: profiles.dumbbells, recent });
    assert.notEqual(assignment.shape, "gymnastics", `${date} was downgraded to gymnastics`);
    if (assignment.shape === "heavy" || assignment.shape === "strength_metcon") {
      assert.equal(assignment.avoidDumbbell, false, `${date} banned dumbbells from a strength day`);
    }
  }
});

test("mixed conditioning gets more movements and density", () => {
  const strengthDay = planDay({ date: "2027-08-02", profile: profiles.garage });
  const metcon = strengthDay.pieces.find((piece) => piece.kind === "metcon");
  assert.ok(metcon);
  assert.ok(metcon.movementCount.min >= 3, `metcon allows only ${metcon.movementCount.min} movements`);

  const chipperDay = planDay({ date: "2027-08-06", profile: profiles.garage });
  if (chipperDay.shape === "chipper") {
    const piece = chipperDay.pieces[0];
    assert.ok(piece.movementCount.min >= 6);
  }
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
