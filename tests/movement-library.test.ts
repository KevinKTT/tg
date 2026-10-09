import assert from "node:assert/strict";
import test from "node:test";
import {
  eligibleMovements,
  libraryEquipment,
  movementMenu,
  movementMenuPrompt,
  type LibraryInventoryItem,
} from "../lib/movement-library";

function item(partial: Partial<LibraryInventoryItem> & Pick<LibraryInventoryItem, "slug" | "category">): LibraryInventoryItem {
  return { quantity: 1, owned: true, ...partial };
}

test("movement library maps app equipment vocabulary", () => {
  const equipment = libraryEquipment([
    item({ slug: "weight_vest", category: "odd" }),
    item({ slug: "band_light", category: "accessory" }),
    item({ slug: "pvc", category: "accessory" }),
    item({ slug: "lacrosse_ball", category: "accessory" }),
    item({ slug: "box_20", category: "rig" }),
  ]);
  assert.ok(equipment.has("weighted_vest"));
  assert.ok(equipment.has("band"));
  assert.ok(equipment.has("band_or_pvc"));
  assert.ok(equipment.has("massage_ball"));
  assert.ok(equipment.has("box"));
});

test("two-dumbbell movements require an owned pair", () => {
  const single = [item({ slug: "db_35lb", category: "dumbbell", quantity: 1 })];
  const pair = [item({ slug: "db_35lb", category: "dumbbell", quantity: 2 })];
  assert.ok(!eligibleMovements(single).some((movement) => movement.id === "db-deadlift"));
  assert.ok(eligibleMovements(pair).some((movement) => movement.id === "db-deadlift"));
  assert.ok(eligibleMovements(single).some((movement) => movement.id === "db-suitcase-deadlift"));
});

test("run variants require Outdoor Run to be owned", () => {
  assert.ok(!eligibleMovements([]).some((movement) => movement.id === "run"));
  const running = [item({ slug: "running", category: "cardio" })];
  assert.ok(eligibleMovements(running).some((movement) => movement.id === "run"));
});

test("movement menu follows the assigned pattern and recent bans", () => {
  const equipment = [item({ slug: "db_35lb", category: "dumbbell", quantity: 2 })];
  const menu = movementMenu({
    items: equipment,
    pattern: "hinge",
    recentIds: ["db-deadlift"],
    random: () => 0.25,
  });
  assert.ok(menu.movements.some((movement) => movement.movement_pattern === "hinge"));
  assert.ok(!menu.movements.some((movement) => movement.id === "db-deadlift"));
  assert.ok(menu.prep.some((movement) => movement.pairs_with_patterns.includes("hinge")));
  assert.ok(menu.cooldowns.some((movement) => movement.pairs_with_patterns.includes("hinge")));
  assert.match(movementMenuPrompt(menu), /CURATED MOVEMENT LIBRARY/);
});
