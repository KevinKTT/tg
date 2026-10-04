export const CATEGORIES = [
  { id: "barbell", label: "Barbell" },
  { id: "plates", label: "Plates" },
  { id: "dumbbell", label: "Dumbbells" },
  { id: "kettlebell", label: "Kettlebells" },
  { id: "rig", label: "Rig & gymnastics" },
  { id: "cardio", label: "Cardio" },
  { id: "odd", label: "Odd objects" },
  { id: "accessory", label: "Accessories" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export type EquipmentKind = "item" | "implement" | "plate" | "bar";

export type CatalogItem = {
  slug: string;
  name: string;
  category: CategoryId;
  kind: EquipmentKind;
  loadValue: number | null;
  unit: "lb" | "kg" | null;
  quantity: number;
  sort: number;
};

export type MovementSeed = {
  slug: string;
  name: string;
  category: "lift" | "gymnastics" | "benchmark" | "engine";
  scoreKind: "load" | "reps" | "time" | "rounds_reps";
  sort: number;
};

function item(
  slug: string,
  name: string,
  category: CategoryId,
  sort: number,
  kind: EquipmentKind = "item",
): CatalogItem {
  return { slug, name, category, kind, loadValue: null, unit: null, quantity: 1, sort };
}

function loads(
  category: CategoryId,
  prefix: string,
  unit: "lb" | "kg",
  values: number[],
  start: number,
  kind: EquipmentKind,
  quantity: number,
): CatalogItem[] {
  return values.map((load, index) => ({
    slug: `${prefix}_${String(load).replace(".", "_")}${unit}`,
    name: `${load} ${unit}`,
    category,
    kind,
    loadValue: load,
    unit,
    quantity,
    sort: start + index,
  }));
}

export const EQUIPMENT: CatalogItem[] = [
  item("mens_bar", "Men's bar (45 lb)", "barbell", 10, "bar"),
  item("womens_bar", "Women's bar (35 lb)", "barbell", 11, "bar"),
  item("technique_bar", "Technique bar (15 kg)", "barbell", 12, "bar"),
  item("squat_rack", "Squat rack / rig", "barbell", 20),
  item("bench", "Bench", "barbell", 21),
  item("jerk_blocks", "Jerk blocks", "barbell", 22),
  item("collars", "Collars", "barbell", 23),
  item("landmine", "Landmine", "barbell", 24),
  item("trap_bar", "Trap bar", "barbell", 25),
  ...loads("plates", "plate", "lb", [45, 35, 25, 15, 10, 5, 2.5, 1.25], 100, "plate", 2),
  ...loads("plates", "plate", "kg", [25, 20, 15, 10, 5, 2.5, 1.25], 200, "plate", 2),
  ...loads("dumbbell", "db", "lb", [5], 299, "implement", 2),
  ...loads("dumbbell", "db", "lb", [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70], 300, "implement", 2),
  ...loads("dumbbell", "db", "kg", [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30], 400, "implement", 2),
  ...loads("kettlebell", "kb", "lb", [18, 26, 35, 44, 53, 62, 70], 500, "implement", 1),
  ...loads("kettlebell", "kb", "kg", [8, 12, 16, 20, 24, 28, 32, 40], 600, "implement", 1),
  item("pullup_bar", "Pull-up bar", "rig", 700),
  item("rings", "Gymnastics rings", "rig", 701),
  item("dip_station", "Dip station", "rig", 702),
  item("parallettes", "Parallettes", "rig", 703),
  item("pegboard", "Pegboard", "rig", 704),
  item("climb_rope", "Climbing rope", "rig", 705),
  item("ghd", "GHD", "rig", 706),
  item("abmat", "AbMat", "rig", 707),
  item("box_20", 'Plyo box 20"', "rig", 710),
  item("box_24", 'Plyo box 24"', "rig", 711),
  item("box_30", 'Plyo box 30"', "rig", 712),
  item("wall_target", "Wall-ball target", "rig", 720),
  item("jump_rope", "Jump rope", "cardio", 800),
  item("rower", "Rower", "cardio", 801),
  item("air_bike", "Air bike (Echo / Assault)", "cardio", 802),
  item("bike_erg", "BikeErg", "cardio", 803),
  item("ski_erg", "SkiErg", "cardio", 804),
  item("running", "Outdoor run", "cardio", 805),
  ...loads("odd", "wall_ball", "lb", [6, 10, 14, 20, 30], 900, "implement", 1),
  ...loads("odd", "med_ball", "lb", [10, 14, 20, 30], 920, "implement", 1),
  ...loads("odd", "slam_ball", "lb", [10, 15, 20, 30], 940, "implement", 1),
  item("sandbag", "Sandbag", "odd", 960),
  item("dball", "D-ball", "odd", 961),
  item("sled", "Sled", "odd", 962),
  item("farmer_handles", "Farmer handles", "odd", 963),
  item("weight_vest", "Weight vest", "odd", 964),
  item("band_light", "Band, light", "accessory", 1000),
  item("band_medium", "Band, medium", "accessory", 1001),
  item("band_heavy", "Band, heavy", "accessory", 1002),
  item("jump_band", "Pull-up assist band", "accessory", 1003),
  item("pvc", "PVC pipe", "accessory", 1010),
  item("foam_roller", "Foam roller", "accessory", 1011),
  item("lacrosse_ball", "Lacrosse ball", "accessory", 1012),
];

EQUIPMENT[0].loadValue = 45;
EQUIPMENT[0].unit = "lb";
EQUIPMENT[1].loadValue = 35;
EQUIPMENT[1].unit = "lb";
EQUIPMENT[2].loadValue = 33;
EQUIPMENT[2].unit = "lb";

const lift = (slug: string, name: string, sort: number): MovementSeed => ({
  slug,
  name,
  category: "lift",
  scoreKind: "load",
  sort,
});

const gym = (slug: string, name: string, sort: number): MovementSeed => ({
  slug,
  name,
  category: "gymnastics",
  scoreKind: "reps",
  sort,
});

const timed = (
  slug: string,
  name: string,
  sort: number,
  category: "benchmark" | "engine" = "benchmark",
): MovementSeed => ({
  slug,
  name,
  category,
  scoreKind: "time",
  sort,
});

export const MOVEMENTS: MovementSeed[] = [
  lift("back_squat", "Back squat", 10),
  lift("front_squat", "Front squat", 11),
  lift("overhead_squat", "Overhead squat", 12),
  lift("deadlift", "Deadlift", 20),
  lift("bench_press", "Bench press", 30),
  lift("strict_press", "Strict press", 31),
  lift("push_press", "Push press", 32),
  lift("push_jerk", "Push jerk", 33),
  lift("split_jerk", "Split jerk", 34),
  lift("squat_clean", "Squat clean", 40),
  lift("power_clean", "Power clean", 41),
  lift("hang_power_clean", "Hang power clean", 42),
  lift("squat_snatch", "Squat snatch", 50),
  lift("power_snatch", "Power snatch", 51),
  lift("hang_power_snatch", "Hang power snatch", 52),
  lift("clean_and_jerk", "Clean & jerk", 60),
  lift("thruster", "Thruster", 70),
  lift("sdhp", "Sumo deadlift high pull", 71),
  gym("strict_pullup", "Strict pull-ups", 100),
  gym("kipping_pullup", "Kipping pull-ups", 101),
  gym("chest_to_bar", "Chest-to-bar", 102),
  gym("toes_to_bar", "Toes-to-bar", 103),
  gym("bar_muscle_up", "Bar muscle-ups", 104),
  gym("ring_muscle_up", "Ring muscle-ups", 105),
  gym("hspu", "Handstand push-ups", 106),
  gym("double_under", "Double-unders, unbroken", 107),
  gym("pistol", "Pistols, each leg", 108),
  timed("fran", "Fran", 200),
  timed("grace", "Grace", 201),
  timed("isabel", "Isabel", 202),
  timed("diane", "Diane", 203),
  timed("elizabeth", "Elizabeth", 204),
  timed("helen", "Helen", 205),
  timed("annie", "Annie", 206),
  timed("karen", "Karen", 207),
  timed("jackie", "Jackie", 208),
  timed("nancy", "Nancy", 209),
  timed("amanda", "Amanda", 210),
  timed("kelly", "Kelly", 211),
  timed("dt", "DT", 212),
  timed("murph", "Murph", 213),
  timed("barbara", "Barbara", 214),
  timed("filthy_fifty", "Filthy Fifty", 215),
  { slug: "cindy", name: "Cindy", category: "benchmark", scoreKind: "rounds_reps", sort: 230 },
  { slug: "mary", name: "Mary", category: "benchmark", scoreKind: "rounds_reps", sort: 231 },
  { slug: "fight_gone_bad", name: "Fight Gone Bad", category: "benchmark", scoreKind: "reps", sort: 232 },
  timed("row_500", "500m row", 300, "engine"),
  timed("row_1k", "1,000m row", 301, "engine"),
  timed("row_2k", "2,000m row", 302, "engine"),
  timed("row_5k", "5,000m row", 303, "engine"),
  timed("run_400", "400m run", 310, "engine"),
  timed("run_mile", "Mile run", 311, "engine"),
  timed("run_5k", "5k run", 312, "engine"),
];

export const MOVEMENT_ALIASES: [string, string][] = [
  ["overhead squat", "overhead_squat"],
  ["oh squat", "overhead_squat"],
  ["front squat", "front_squat"],
  ["back squat", "back_squat"],
  ["squat", "back_squat"],
  ["deadlift", "deadlift"],
  ["bench press", "bench_press"],
  ["bench", "bench_press"],
  ["strict press", "strict_press"],
  ["shoulder press", "strict_press"],
  ["push press", "push_press"],
  ["push jerk", "push_jerk"],
  ["split jerk", "split_jerk"],
  ["jerk", "split_jerk"],
  ["hang power clean", "hang_power_clean"],
  ["power clean", "power_clean"],
  ["squat clean", "squat_clean"],
  ["clean and jerk", "clean_and_jerk"],
  ["clean & jerk", "clean_and_jerk"],
  ["clean", "squat_clean"],
  ["hang power snatch", "hang_power_snatch"],
  ["power snatch", "power_snatch"],
  ["squat snatch", "squat_snatch"],
  ["snatch", "squat_snatch"],
  ["thruster", "thruster"],
  ["sumo deadlift high pull", "sdhp"],
  ["strict pull-ups", "strict_pullup"],
  ["strict pullups", "strict_pullup"],
  ["strict pull-up", "strict_pullup"],
  ["pull-ups", "kipping_pullup"],
  ["pullups", "kipping_pullup"],
  ["pull-up", "kipping_pullup"],
  ["chest-to-bar", "chest_to_bar"],
  ["chest to bar", "chest_to_bar"],
  ["toes-to-bar", "toes_to_bar"],
  ["toes to bar", "toes_to_bar"],
  ["handstand push-ups", "hspu"],
  ["handstand pushups", "hspu"],
  ["hspu", "hspu"],
  ["double-unders", "double_under"],
  ["double unders", "double_under"],
  ["press", "strict_press"],
];

MOVEMENT_ALIASES.sort((a, b) => b[0].length - a[0].length);

export const PERCENT_STEPS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

export const MOVEMENT_GROUPS = [
  { id: "lift", label: "Lifts" },
  { id: "gymnastics", label: "Gymnastics" },
  { id: "benchmark", label: "Benchmarks" },
  { id: "engine", label: "Engine" },
] as const;
