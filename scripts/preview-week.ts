/**
 * Preview a week of engine-only sessions and their quality audits.
 *
 * `npx tsx scripts/preview-week.ts`
 *
 * This never calls a model: it exercises the programmer, the shortlists, and
 * the audit. Use it to see how shapes, patterns, and loads distribute across a
 * week, and to check that no session carries a hard quality issue.
 */

import { planDay, shortlistForPiece, type RecentSignal } from "../lib/engine/planner";
import { buildFallbackClass } from "../lib/engine/class";
import { auditPlan } from "../lib/engine/quality";
import { equipmentProfile, movementById, type InventoryItem } from "../lib/engine/movements";

const db = (weight: number): InventoryItem => ({
  slug: `db_${weight}lb`,
  category: "dumbbell",
  kind: "implement",
  loadValue: weight,
  unit: "lb",
  quantity: 2,
  owned: true,
});

const item = (slug: string, category: string): InventoryItem => ({ slug, category, quantity: 1, owned: true });

const items = [
  ...[5, 10, 15, 20, 25, 35].map(db),
  item("jump_rope", "cardio"),
  item("box_24", "rig"),
  item("rower", "cardio"),
  item("running", "cardio"),
  item("weight_vest", "odd"),
  item("mens_bar", "barbell"),
  item("plate_45lb", "plates"),
];

const profile = equipmentProfile(items);

const dates = process.argv.slice(2);
const week = dates.length
  ? dates
  : ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

let recent: RecentSignal[] = [];
for (const date of week) {
  const assignment = planDay({ date, profile, recent });
  const shortlists = assignment.pieces.map((piece) =>
    shortlistForPiece(piece, profile, assignment.avoidMovements, () => 0.4),
  );
  const plan = buildFallbackClass({ assignment, shortlists, items, caps: profile.caps, random: () => 0.4 });
  const audit = auditPlan(plan);
  const names = plan.pieces.flatMap((piece) => piece.movements.map((movement) => movementById(movement.id)?.name ?? movement.id));
  const codes = audit.issues.map((issue) => issue.code).join(",") || "-";
  console.log(
    `${date} ${plan.title.padEnd(26)} ${assignment.shape.padEnd(16)} score=${String(audit.score).padStart(3)} hard=${audit.hard} soft=${audit.soft} ${codes}`,
  );
  console.log(`  ${names.join(" · ")}`);
  recent = [
    {
      date,
      pattern: assignment.pieces[0]?.pattern ?? "none",
      shape: assignment.shape,
      format: plan.format,
      movements: plan.pieces.flatMap((piece) => piece.movements.map((movement) => movement.id)),
      load: assignment.load,
    },
    ...recent,
  ];
}
