import assert from "node:assert/strict";
import test from "node:test";
import { buildFallbackClass, type ClassPlan, type PlannedPiece } from "../lib/engine/class";
import type { InventoryItem } from "../lib/engine/movements";
import { movementById } from "../lib/engine/movements";
import { equipmentProfile } from "../lib/engine/movements";
import { auditPlan, betterPlan, describePlan, movementStress } from "../lib/engine/quality";
import { planDay, shortlistForPiece, type RecentSignal } from "../lib/engine/planner";
import type { Scheme } from "../lib/engine/scheme";

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
];

const profile = equipmentProfile(garage);

function piece(input: {
  scheme: Scheme;
  movements: PlannedPiece["movements"];
  name?: string;
}): PlannedPiece {
  return {
    kind: "metcon",
    name: input.name ?? "Workout",
    scheme: input.scheme,
    movements: input.movements,
    estimatedDurationMin: 20,
  };
}

function plan(input: { pieces: PlannedPiece[]; prep?: string }): ClassPlan {
  return {
    date: "2026-10-31",
    title: "Test",
    stimulus: "Hard, but repeatable.",
    focus: "mixed",
    format: input.pieces[0]?.scheme.type ?? "amrap",
    summary: "",
    warmup: "- 3 min easy jog",
    warmupDurationMin: 10,
    prep: input.prep ?? "",
    prepDurationMin: 7,
    cooldown: "- Child's pose",
    cooldownDurationMin: 5,
    pieces: input.pieces,
  };
}

const dumbbellChipper = plan({
  pieces: [
    piece({
      scheme: { type: "chipper", capMin: 20 },
      movements: [
        { id: "db-deadlift", dose: { reps: 20 } },
        { id: "db-hang-power-clean", dose: { reps: 20 } },
        { id: "db-push-press", dose: { reps: 20 } },
        { id: "db-front-squat", dose: { reps: 20 } },
        { id: "db-walking-lunge", dose: { reps: 20 } },
      ],
    }),
  ],
});

test("a stack of dumbbell movements fails the audit even though validation passes", () => {
  const audit = auditPlan(dumbbellChipper);
  const codes = audit.issues.map((issue) => issue.code);
  assert.ok(audit.hard > 0, `expected hard issues, got ${JSON.stringify(audit)}`);
  assert.ok(codes.includes("implement_stack") || codes.includes("implement_run"), codes.join(", "));
  assert.ok(codes.includes("grip_overload"), codes.join(", "));
});

test("volume that cannot fit the cap is a hard issue", () => {
  const tooMuch = plan({
    pieces: [
      piece({
        scheme: { type: "chipper", capMin: 2 },
        movements: [
          { id: "db-deadlift", dose: { reps: 20 } },
          { id: "db-hang-power-clean", dose: { reps: 20 } },
          { id: "db-front-squat", dose: { reps: 20 } },
        ],
      }),
    ],
  });
  assert.ok(auditPlan(tooMuch).issues.some((issue) => issue.code === "volume_over_cap"));
  assert.ok(!auditPlan(dumbbellChipper).issues.some((issue) => issue.code === "volume_over_cap"));
});

test("a contrasting triplet passes the audit", () => {
  const good = plan({
    pieces: [
      piece({
        scheme: { type: "amrap", minutes: 14 },
        movements: [
          { id: "row", dose: { cal: 12 } },
          { id: "db-push-press", dose: { reps: 10 } },
          { id: "box-jump", dose: { reps: 12 } },
        ],
      }),
    ],
  });
  assert.equal(auditPlan(good).hard, 0, JSON.stringify(auditPlan(good).issues));
});

test("betterPlan keeps the class with fewer hard issues", () => {
  const good = plan({
    pieces: [
      piece({
        scheme: { type: "amrap", minutes: 14 },
        movements: [
          { id: "row", dose: { cal: 12 } },
          { id: "db-push-press", dose: { reps: 10 } },
          { id: "box-jump", dose: { reps: 12 } },
        ],
      }),
    ],
  });
  assert.equal(betterPlan(dumbbellChipper, good), good);
  assert.equal(betterPlan(good, dumbbellChipper), good);
});

test("prep primes the session instead of repeating it", () => {
  const assignment = planDay({ date: "2026-11-02", profile, shape: "chipper" });
  const shortlists = assignment.pieces.map((brief) => shortlistForPiece(brief, profile, [], () => 0.4));
  const built = buildFallbackClass({
    assignment,
    shortlists,
    items: garage,
    caps: profile.caps,
    random: () => 0.4,
  });
  const workNames = [
    ...new Set(
      built.pieces
        .flatMap((entry) => entry.movements)
        .map((entry) => movementById(entry.id)?.name.toLowerCase())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const repeated = workNames.filter((name) => built.prep.toLowerCase().includes(name));
  assert.ok(repeated.length <= 2, `prep repeats ${repeated.join(", ")}`);
});

test("the week pushes back against a run of the same class", () => {
  const recent: RecentSignal[] = Array.from({ length: 6 }, (_, index) => ({
    date: `2026-10-${25 - index}`,
    pattern: "hinge" as const,
    shape: "chipper" as const,
    format: "chipper",
    movements: ["db-deadlift"],
    load: "moderate" as const,
  }));
  const next = planDay({ date: "2026-10-31", profile, recent });
  assert.notEqual(next.shape, "chipper");
  assert.deepEqual(planDay({ date: "2026-10-31", profile, recent }), next);
});

test("stress reads the implement and the limiter", () => {
  const deadlift = movementById("db-deadlift");
  const row = movementById("row");
  assert.ok(deadlift && row);
  assert.equal(movementStress(deadlift).implement, "dumbbell");
  assert.equal(movementStress(deadlift).grip, true);
  assert.equal(movementStress(row).mono, true);
  assert.equal(movementStress(row).grip, false);
});

test("describePlan gives a decision model something readable", () => {
  const text = describePlan(dumbbellChipper);
  assert.match(text, /TITLE: Test/);
  assert.match(text, /20 reps Dumbbell deadlift/i);
});
