import { MOVEMENTS } from "../catalog";
import {
  MOVEMENT_LIBRARY,
  type LibraryMovement,
  type LibraryPattern,
} from "../movement-library";
import type { Scheme } from "./scheme";

export type Modality = "M" | "G" | "W";

export type MovementPattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "press"
  | "pull"
  | "olympic"
  | "carry"
  | "core"
  | "jump"
  | "locomotion"
  | "rotation"
  | "none";

export type DoseUnit = "reps" | "cal" | "meters" | "seconds";

export type DoseRange = { unit: DoseUnit; min: number; max: number };

export type MovementDef = {
  id: string;
  name: string;
  aliases: string[];
  modality: Modality;
  pattern: MovementPattern;
  equipment: string[];
  equipmentAny?: string[][];
  dumbbellCount: 0 | 1 | 2;
  load: "dumbbell" | "barbell" | "kettlebell" | "vest" | "odd" | null;
  doses: DoseRange[];
  unilateral: boolean;
  skill: "beginner" | "intermediate" | "advanced";
  intensity: "low" | "moderate" | "high";
  easier: string[];
  harder: string[];
  description: string;
  source: "library" | "catalog" | "engine";
};

export type Dose = {
  reps?: number;
  cal?: number;
  meters?: number;
  seconds?: number;
  eachSide?: boolean;
};

export type MovementDose = {
  id: string;
  dose: Dose;
};

export type InventoryItem = {
  slug: string;
  category: string;
  kind?: string;
  loadValue?: number | null;
  unit?: string | null;
  quantity: number;
  owned: boolean;
};

export type EquipmentProfile = {
  caps: Set<string>;
  dumbbells: number[];
  kettlebells: number[];
  hasDumbbellPair: boolean;
  maxDumbbellLb: number;
  maxKettlebellLb: number;
  hasHeavyLoad: boolean;
  labels: string[];
};

const PATTERN_MAP: Record<LibraryPattern, MovementPattern> = {
  squat: "squat",
  hinge: "hinge",
  lunge: "lunge",
  "horizontal push": "press",
  "vertical push": "press",
  "horizontal pull": "pull",
  "vertical pull": "pull",
  carry: "carry",
  "core/midline": "core",
  jump: "jump",
  locomotion: "locomotion",
  "full-body/olympic-style": "olympic",
  rotation: "rotation",
};

const EQUIPMENT_TO_CAP: Record<string, string[]> = {
  dumbbell: ["dumbbell"],
  jump_rope: ["jump_rope"],
  weighted_vest: ["weight_vest"],
  box: ["box"],
  bench: ["bench"],
  adjustable_bench: ["bench"],
  abmat: ["abmat"],
  plates_or_parallettes: ["plates", "parallettes"],
  band: ["band"],
  band_or_pvc: ["band", "pvc"],
  foam_roller: ["foam_roller"],
  massage_ball: ["lacrosse_ball"],
  wall: [],
  hurdle: ["hurdle"],
  hill_or_treadmill: ["running"],
  outdoor_trail: ["running"],
  stairs: ["running"],
};

function toPounds(value: number, unit: string | null | undefined): number {
  return unit === "kg" ? value * 2.2046226218 : value;
}

export function equipmentProfile(items: InventoryItem[]): EquipmentProfile {
  const caps = new Set<string>(["bodyweight", "wall"]);
  const dumbbells: number[] = [];
  const kettlebells: number[] = [];
  let hasDumbbellPair = false;
  const labels: string[] = [];

  for (const item of items) {
    if (!item.owned) continue;
    caps.add(item.slug);
    caps.add(item.category);
    if (item.slug === "mens_bar" || item.slug === "womens_bar" || item.slug === "technique_bar" || item.slug === "trap_bar") {
      caps.add("barbell");
    }
    if (item.slug.startsWith("box_")) caps.add("box");
    if (item.slug.startsWith("band_")) caps.add("band");
    if (item.slug.startsWith("wall_ball")) caps.add("wall_ball");
    if (item.slug.startsWith("med_ball")) caps.add("med_ball");
    if (item.slug.startsWith("slam_ball")) caps.add("slam_ball");
    if (item.slug === "sandbag") caps.add("sandbag");
    if (item.slug === "sled") caps.add("sled");
    if (item.slug === "farmer_handles") caps.add("farmer_handles");
    if (item.slug === "pvc") caps.add("pvc");
    if (item.category === "plates" || item.slug.startsWith("plate_")) caps.add("plates");
    if (item.category === "dumbbell") {
      const lb = item.loadValue != null ? toPounds(item.loadValue, item.unit) : null;
      if (lb != null) dumbbells.push(lb);
      if ((item.quantity ?? 1) >= 2) hasDumbbellPair = true;
    }
    if (item.category === "kettlebell" && item.loadValue != null) {
      kettlebells.push(toPounds(item.loadValue, item.unit));
    }
    labels.push(item.slug);
  }

  if (caps.has("plates") || caps.has("parallettes")) caps.add("plates_or_parallettes");
  if (caps.has("barbell")) caps.add("heavier_load");
  const maxDumbbellLb = dumbbells.length ? Math.max(...dumbbells) : 0;
  const maxKettlebellLb = kettlebells.length ? Math.max(...kettlebells) : 0;
  if (maxDumbbellLb >= 35 || maxKettlebellLb >= 35) caps.add("heavier_load");

  return {
    caps,
    dumbbells: [...new Set(dumbbells)].sort((a, b) => a - b),
    kettlebells: [...new Set(kettlebells)].sort((a, b) => a - b),
    hasDumbbellPair,
    maxDumbbellLb,
    maxKettlebellLb,
    hasHeavyLoad: caps.has("heavier_load"),
    labels,
  };
}

function meetsAny(caps: Set<string>, options: string[]): boolean {
  return options.some((option) => caps.has(option));
}

export function movementEligible(movement: MovementDef, profile: EquipmentProfile): boolean {
  if (!movement.equipment.every((cap) => capsOk(profile.caps, cap))) return false;
  if (movement.equipmentAny?.length) {
    if (!movement.equipmentAny.every((options) => meetsAny(profile.caps, options))) return false;
  }
  if (movement.dumbbellCount === 2 && !profile.hasDumbbellPair) return false;
  if (movement.id === "run" || movement.id === "sprint" || movement.id === "shuttle-run") {
    return profile.caps.has("running");
  }
  if (movement.id.includes("weighted-vest") && !profile.caps.has("weight_vest")) return false;
  return true;
}

function capsOk(caps: Set<string>, cap: string): boolean {
  return caps.has(cap);
}

function libraryDoses(movement: LibraryMovement): DoseRange[] {
  const category = movement.category;
  const pattern = PATTERN_MAP[movement.movement_pattern];
  if (movement.typical_unit === "distance") {
    const max = /walk|carry|march/i.test(movement.name) ? 400 : 800;
    return [{ unit: "meters", min: 100, max }];
  }
  if (movement.typical_unit === "time") {
    return [{ unit: "seconds", min: 20, max: 60 }];
  }
  if (category === "jump_rope") return [{ unit: "reps", min: 20, max: 60 }];
  if (category === "plyometric" || pattern === "jump") return [{ unit: "reps", min: 10, max: 20 }];
  if (category === "weighted_vest") return [{ unit: "reps", min: 8, max: 15 }];
  if (pattern === "core") return [{ unit: "reps", min: 10, max: 25 }];
  if (category === "dumbbell") return [{ unit: "reps", min: 6, max: 15 }];
  if (pattern === "carry") return [{ unit: "meters", min: 40, max: 100 }];
  if (pattern === "locomotion") return [{ unit: "meters", min: 100, max: 400 }];
  return [{ unit: "reps", min: 8, max: 20 }];
}

const DOSE_OVERRIDES: Record<string, DoseRange[]> = {
  "db-deadlift": [{ unit: "reps", min: 8, max: 15 }],
  "db-thruster": [{ unit: "reps", min: 8, max: 15 }],
  "db-hang-power-clean": [{ unit: "reps", min: 8, max: 12 }],
  "db-power-clean": [{ unit: "reps", min: 8, max: 12 }],
  "db-power-snatch": [{ unit: "reps", min: 8, max: 12 }],
  "alternating-dumbbell-snatch": [{ unit: "reps", min: 10, max: 20 }],
  "db-front-squat": [{ unit: "reps", min: 8, max: 15 }],
  "db-strict-press": [{ unit: "reps", min: 6, max: 12 }],
  "db-push-press": [{ unit: "reps", min: 8, max: 12 }],
  "box-jump": [{ unit: "reps", min: 10, max: 20 }],
  "burpee": [{ unit: "reps", min: 8, max: 15 }],
  "air-squat": [{ unit: "reps", min: 15, max: 25 }],
  "push-up": [{ unit: "reps", min: 8, max: 20 }],
  "sit-up": [{ unit: "reps", min: 10, max: 20 }],
  "double-under": [{ unit: "reps", min: 30, max: 60 }],
  "single-under": [{ unit: "reps", min: 30, max: 80 }],
  "run": [{ unit: "meters", min: 200, max: 800 }],
  "sprint": [{ unit: "meters", min: 50, max: 200 }],
  "shuttle-run": [{ unit: "meters", min: 50, max: 200 }],
};

function libraryMovement(movement: LibraryMovement): MovementDef {
  const pattern = PATTERN_MAP[movement.movement_pattern];
  const equipment: string[] = [];
  const equipmentAny: string[][] = [];
  for (const token of movement.equipment) {
    const mapped = EQUIPMENT_TO_CAP[token];
    if (!mapped) {
      equipment.push(token);
      continue;
    }
    if (mapped.length === 0) continue;
    if (mapped.length === 1) equipment.push(mapped[0]);
    else equipmentAny.push(mapped);
  }
  const load =
    movement.category === "dumbbell"
      ? "dumbbell"
      : movement.category === "weighted_vest"
        ? "vest"
        : null;
  return {
    id: movement.id,
    name: movement.name,
    aliases: movement.aliases,
    modality:
      movement.modality === "monostructural" ? "M" : movement.modality === "gymnastics" ? "G" : "W",
    pattern,
    equipment,
    equipmentAny,
    dumbbellCount: movement.dumbbell_count,
    load,
    doses: DOSE_OVERRIDES[movement.id] ?? libraryDoses(movement),
    unilateral: movement.unilateral,
    skill: movement.skill_level,
    intensity: movement.intensity,
    easier: movement.scaling_options.easier,
    harder: movement.scaling_options.harder,
    description: movement.short_description,
    source: "library",
  };
}

const CATALOG_PATTERN: Record<string, MovementPattern> = {
  back_squat: "squat",
  front_squat: "squat",
  overhead_squat: "squat",
  deadlift: "hinge",
  bench_press: "press",
  strict_press: "press",
  push_press: "press",
  push_jerk: "press",
  split_jerk: "press",
  squat_clean: "olympic",
  power_clean: "olympic",
  hang_power_clean: "olympic",
  squat_snatch: "olympic",
  power_snatch: "olympic",
  hang_power_snatch: "olympic",
  clean_and_jerk: "olympic",
  thruster: "squat",
  sdhp: "olympic",
};

function catalogMovement(movement: (typeof MOVEMENTS)[number]): MovementDef | null {
  const pattern = CATALOG_PATTERN[movement.slug];
  if (!pattern) return null;
  return {
    id: movement.slug,
    name: movement.name,
    aliases: [],
    modality: movement.category === "gymnastics" ? "G" : "W",
    pattern,
    equipment: ["barbell"],
    dumbbellCount: 0,
    load: "barbell",
    doses: [{ unit: "reps", min: 3, max: 10 }],
    unilateral: false,
    skill: "intermediate",
    intensity: "high",
    easier: [],
    harder: [],
    description: "",
    source: "catalog",
  };
}

const ENGINE_MOVEMENTS: MovementDef[] = [
  {
    id: "row",
    name: "Row",
    aliases: ["rowing", "rower", "row erg", "cal row"],
    modality: "M",
    pattern: "locomotion",
    equipment: ["rower"],
    dumbbellCount: 0,
    load: null,
    doses: [
      { unit: "cal", min: 8, max: 20 },
      { unit: "meters", min: 250, max: 800 },
    ],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "Rower, calories or meters.",
    source: "engine",
  },
  {
    id: "air-bike",
    name: "Air Bike",
    aliases: ["assault bike", "echo bike", "bike"],
    modality: "M",
    pattern: "locomotion",
    equipment: ["air_bike"],
    dumbbellCount: 0,
    load: null,
    doses: [{ unit: "cal", min: 8, max: 25 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "Air bike calories.",
    source: "engine",
  },
  {
    id: "bike-erg",
    name: "BikeErg",
    aliases: ["bike erg"],
    modality: "M",
    pattern: "locomotion",
    equipment: ["bike_erg"],
    dumbbellCount: 0,
    load: null,
    doses: [{ unit: "cal", min: 8, max: 25 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "BikeErg calories.",
    source: "engine",
  },
  {
    id: "ski-erg",
    name: "SkiErg",
    aliases: ["ski erg"],
    modality: "M",
    pattern: "locomotion",
    equipment: ["ski_erg"],
    dumbbellCount: 0,
    load: null,
    doses: [{ unit: "cal", min: 8, max: 20 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "SkiErg calories.",
    source: "engine",
  },
  {
    id: "kb-swing",
    name: "Kettlebell Swing",
    aliases: ["kb swing", "kettlebell swings"],
    modality: "W",
    pattern: "hinge",
    equipment: ["kettlebell"],
    dumbbellCount: 0,
    load: "kettlebell",
    doses: [{ unit: "reps", min: 10, max: 20 }],
    unilateral: false,
    skill: "beginner",
    intensity: "high",
    easier: [],
    harder: [],
    description: "Russian or American swing.",
    source: "engine",
  },
  {
    id: "kb-goblet-squat",
    name: "Kettlebell Goblet Squat",
    aliases: ["kb goblet squat"],
    modality: "W",
    pattern: "squat",
    equipment: ["kettlebell"],
    dumbbellCount: 0,
    load: "kettlebell",
    doses: [{ unit: "reps", min: 8, max: 15 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "kb-clean",
    name: "Kettlebell Clean",
    aliases: ["kb clean"],
    modality: "W",
    pattern: "olympic",
    equipment: ["kettlebell"],
    dumbbellCount: 0,
    load: "kettlebell",
    doses: [{ unit: "reps", min: 6, max: 12 }],
    unilateral: true,
    skill: "intermediate",
    intensity: "high",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "kb-snatch",
    name: "Kettlebell Snatch",
    aliases: ["kb snatch"],
    modality: "W",
    pattern: "olympic",
    equipment: ["kettlebell"],
    dumbbellCount: 0,
    load: "kettlebell",
    doses: [{ unit: "reps", min: 6, max: 12 }],
    unilateral: true,
    skill: "advanced",
    intensity: "high",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "kb-front-rack-carry",
    name: "Kettlebell Front-Rack Carry",
    aliases: ["kb front rack carry"],
    modality: "W",
    pattern: "carry",
    equipment: ["kettlebell"],
    dumbbellCount: 0,
    load: "kettlebell",
    doses: [{ unit: "meters", min: 40, max: 100 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "wall-ball",
    name: "Wall Ball",
    aliases: ["wall balls", "wallball"],
    modality: "W",
    pattern: "squat",
    equipment: ["wall_ball"],
    dumbbellCount: 0,
    load: "odd",
    doses: [{ unit: "reps", min: 10, max: 20 }],
    unilateral: false,
    skill: "beginner",
    intensity: "high",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "med-ball-clean",
    name: "Med-Ball Clean",
    aliases: ["medicine ball clean"],
    modality: "W",
    pattern: "olympic",
    equipment: ["med_ball"],
    dumbbellCount: 0,
    load: "odd",
    doses: [{ unit: "reps", min: 8, max: 15 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "sandbag-carry",
    name: "Sandbag Carry",
    aliases: ["sandbag walk"],
    modality: "W",
    pattern: "carry",
    equipment: ["sandbag"],
    dumbbellCount: 0,
    load: "odd",
    doses: [{ unit: "meters", min: 40, max: 100 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "sled-push",
    name: "Sled Push",
    aliases: ["sled drag"],
    modality: "W",
    pattern: "locomotion",
    equipment: ["sled"],
    dumbbellCount: 0,
    load: "odd",
    doses: [{ unit: "meters", min: 20, max: 50 }],
    unilateral: false,
    skill: "beginner",
    intensity: "high",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
  {
    id: "farmer-carry",
    name: "Farmer Carry",
    aliases: ["farmers carry", "farmer's carry"],
    modality: "W",
    pattern: "carry",
    equipmentAny: [["farmer_handles", "kettlebell", "dumbbell"]],
    equipment: [],
    dumbbellCount: 0,
    load: "odd",
    doses: [{ unit: "meters", min: 40, max: 100 }],
    unilateral: false,
    skill: "beginner",
    intensity: "moderate",
    easier: [],
    harder: [],
    description: "",
    source: "engine",
  },
];

const LIBRARY_MOVEMENTS: MovementDef[] = MOVEMENT_LIBRARY.map(libraryMovement);
const CATALOG_MOVEMENTS: MovementDef[] = MOVEMENTS.flatMap((movement) => {
  const mapped = catalogMovement(movement);
  return mapped ? [mapped] : [];
});

export const MOVEMENT_CATALOG: MovementDef[] = [
  ...LIBRARY_MOVEMENTS,
  ...CATALOG_MOVEMENTS,
  ...ENGINE_MOVEMENTS,
];

const BY_ID = new Map(MOVEMENT_CATALOG.map((movement) => [movement.id, movement]));
const ALIAS_INDEX = new Map<string, MovementDef>();
for (const movement of MOVEMENT_CATALOG) {
  ALIAS_INDEX.set(movement.name.toLowerCase(), movement);
  ALIAS_INDEX.set(movement.id.toLowerCase(), movement);
  for (const alias of movement.aliases) ALIAS_INDEX.set(alias.toLowerCase(), movement);
}

export function movementById(id: string): MovementDef | undefined {
  return BY_ID.get(id);
}

export function movementByName(name: string): MovementDef | undefined {
  return ALIAS_INDEX.get(name.trim().toLowerCase());
}

export function eligibleCatalog(profile: EquipmentProfile): MovementDef[] {
  return MOVEMENT_CATALOG.filter((movement) => movementEligible(movement, profile));
}

export function movementDisplayName(id: string): string {
  return BY_ID.get(id)?.name ?? id.replace(/[-_]/g, " ");
}

export function patternFromCatalog(pattern: string): MovementPattern {
  if (pattern === "press" || pattern === "pull") return pattern;
  if (pattern === "squat" || pattern === "hinge" || pattern === "lunge" || pattern === "olympic" || pattern === "carry" || pattern === "core" || pattern === "jump" || pattern === "locomotion" || pattern === "rotation") {
    return pattern;
  }
  return "none";
}

export function modalityForPattern(pattern: MovementPattern): Modality[] {
  if (pattern === "locomotion") return ["M", "G"];
  if (pattern === "jump" || pattern === "core" || pattern === "rotation") return ["G", "M"];
  return ["W", "G"];
}

export function doseText(movement: MovementDef, dose: Dose): string {
  for (const unit of ["reps", "cal", "meters", "seconds"] as DoseUnit[]) {
    const value = dose[unit];
    if (value != null) {
      const suffix = unit === "cal" ? " cal" : unit === "meters" ? " m" : unit === "seconds" ? " sec" : "";
      const each = dose.eachSide || (movement.unilateral && unit === "reps") ? "/side" : "";
      return `${value}${suffix}${each}`;
    }
  }
  return movement.doses[0] ? `${movement.doses[0].min}${unitSuffix(movement.doses[0].unit)}` : "";
}

export function unitSuffix(unit: DoseUnit): string {
  if (unit === "cal") return " cal";
  if (unit === "meters") return " m";
  if (unit === "seconds") return " sec";
  return "";
}

export function defaultDose(movement: MovementDef, scheme: Scheme, style: "short" | "medium" | "long"): Dose {
  const range = doseRangeFor(movement, scheme)[0] ?? movement.doses[0];
  if (!range) return { reps: 10 };
  let value: number;
  if (scheme.type === "intervals") {
    value = Math.round((range.min + range.max) / 2);
    return { [range.unit]: value } as Dose;
  }
  if (movement.pattern === "carry" && range.unit === "meters") {
    value = style === "short" ? 40 : style === "long" ? 80 : 60;
  } else if (range.unit === "meters") {
    value = style === "short" ? 100 : style === "long" ? 400 : 200;
    if (movement.id === "sprint" || movement.id === "shuttle-run") value = style === "long" ? 200 : 100;
  } else if (range.unit === "cal") {
    value = style === "short" ? 10 : style === "long" ? 18 : 14;
  } else if (range.unit === "seconds") {
    value = style === "short" ? 30 : style === "long" ? 45 : 40;
  } else if (scheme.type === "for_time" && scheme.rounds && scheme.rounds >= 5) {
    value = range.min;
  } else {
    value = Math.round((range.min + range.max) / 2);
  }
  value = Math.max(range.min, Math.min(range.max, value));
  return { [range.unit]: value } as Dose;
}

export function doseValue(dose: Dose): { unit: DoseUnit; value: number } | null {
  if (dose.reps != null) return { unit: "reps", value: dose.reps };
  if (dose.cal != null) return { unit: "cal", value: dose.cal };
  if (dose.meters != null) return { unit: "meters", value: dose.meters };
  if (dose.seconds != null) return { unit: "seconds", value: dose.seconds };
  return null;
}

export function doseInRange(movement: MovementDef, dose: Dose, scheme?: Scheme): boolean {
  const value = doseValue(dose);
  if (!value) return false;
  const ranges = scheme ? doseRangeFor(movement, scheme) : movement.doses;
  return ranges.some(
    (range) => range.unit === value.unit && value.value >= range.min && value.value <= range.max,
  );
}

/**
 * Doses are contextual. A 2:00 interval window should not prescribe the same
 * jump-rope reps as a round of an AMRAP, and an EMOM carry cannot be 300 m.
 */
export function doseRangeFor(movement: MovementDef, scheme: Scheme): DoseRange[] {
  const base = movement.doses[0];
  if (!base) return [];
  if (scheme.type === "intervals") {
    const work = Math.max(15, scheme.workSec);
    if (base.unit === "cal") {
      const min = Math.max(base.min, Math.round(work / 15));
      const max = Math.max(min + 4, Math.round(work / 5));
      return [{ unit: "cal", min, max }];
    }
    if (base.unit === "meters") {
      const min = Math.max(base.min, Math.round(work * 2));
      const max = Math.max(min + 50, Math.min(base.max, Math.round(work * 4)));
      return [{ unit: "meters", min, max }];
    }
    if (base.unit === "reps") {
      const perMinute = /double-under/i.test(movement.name) ? 40 : /jump|skip/i.test(movement.name) ? 60 : 20;
      const min = Math.max(base.min, Math.round((work / 60) * perMinute * 0.7));
      const max = Math.max(min + 5, Math.round((work / 60) * perMinute * 1.5));
      return [{ unit: "reps", min, max }];
    }
    return [{ unit: "seconds", min: Math.min(base.min, work), max: Math.min(base.max, work) }];
  }
  if (scheme.type === "emom" && base.unit === "meters") {
    return [{ unit: "meters", min: Math.min(base.min, 40), max: Math.max(40, Math.min(base.max, 100)) }];
  }
  return movement.doses;
}

export function schemeStyle(scheme: Scheme): "short" | "medium" | "long" {
  const minutes =
    scheme.type === "amrap" || scheme.type === "emom" || scheme.type === "max_reps" || scheme.type === "skill"
      ? scheme.minutes
      : scheme.type === "intervals"
        ? Math.round((scheme.rounds * (scheme.workSec + scheme.restSec)) / 60)
        : scheme.type === "for_time" || scheme.type === "chipper" || scheme.type === "ladder"
          ? (scheme.capMin ?? 15)
          : 15;
  if (minutes < 12) return "short";
  if (minutes > 20) return "long";
  return "medium";
}

const ACCESSORY =
  /\b(?:biceps?|hammer|curl|lateral raise|front raise|reverse fly|shrug|triceps|skull crusher|floor fly|pullover|calf raise|hip thrust|glute bridge|bird dog|dead bug|heel tap|flutter kick|clamshell|face pull|upright row|scaption|external rotation)\b/i;

/** Accessory or bodybuilding work is fine in warm-ups, but should not lead a CrossFit piece. */
export function isAccessory(movement: MovementDef): boolean {
  return ACCESSORY.test(movement.name);
}

const SKILL_NAME =
  /\b(handstand|wall walk|pistol|shrimp|l-sit|hollow|arch rock|pike|headstand|crow|frog stand|ring|muscle-up|kipping|butterfly|toes-to-bar|pull-up|pullup|walk)\b/i;

export function isSkillMovement(movement: MovementDef): boolean {
  if (movement.load) return false;
  if (SKILL_NAME.test(movement.name)) return true;
  return movement.skill === "advanced";
}

export function isAdvancedSkill(movement: MovementDef): boolean {
  if (movement.load) return false;
  if (movement.skill === "advanced") return true;
  return /\b(freestanding|handstand|pistol|shrimp|muscle-up|l-sit|headstand|crow|frog stand|wall walk|pike|deficit)\b/i.test(movement.name);
}

const COMPOUND: Record<MovementPattern, RegExp> = {
  squat: /(squat|thruster|clean|snatch)/i,
  hinge: /(deadlift|rdl|romanian|swing|clean|snatch|good morning)/i,
  lunge: /(lunge|split squat|step-up|step over)/i,
  press: /(press|thruster|push press|jerk|push-up|dip)/i,
  pull: /(row|pull-up|pullup|high pull|clean)/i,
  olympic: /(clean|snatch|jerk|high pull)/i,
  carry: /(carry|walk|march|hold)/i,
  core: /(plank|hollow|v-up|sit-up|leg raise|windshield|l-sit)/i,
  jump: /(jump|bound|hop|skip)/i,
  locomotion: /(run|sprint|shuttle|row|bike|ski)/i,
  rotation: /(twist|windmill|chop)/i,
  none: /./,
};

export function compoundScore(movement: MovementDef): number {
  let score = 0;
  if (COMPOUND[movement.pattern].test(movement.name)) score -= 3;
  if (isAccessory(movement)) score += 8;
  if (movement.intensity === "high") score -= 1;
  if (movement.skill === "beginner") score -= 1;
  return score;
}

export function intervalFriendly(movement: MovementDef): boolean {
  if (movement.modality !== "M") return false;
  if (/\b(walk|hike|march|ruck)\b/i.test(movement.name)) return false;
  return movement.doses.some((range) => range.unit === "cal" || range.unit === "reps" || (range.unit === "meters" && range.max <= 400));
}
