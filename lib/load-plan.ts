import type { Sex, Unit } from "./athletes";
import { MOVEMENT_LIBRARY } from "./movement-library";
import { closestLoad, type Plate } from "./scaling";
import { formatLoad } from "./scoring";
import type { EquipmentRow, PrRow } from "./db";

export type LoadTier = "rx" | "performance" | "lifestyle";
export type LoadKind = "heavy" | "moderate" | "light";
export type ImplementCategory = "dumbbell" | "kettlebell" | "barbell" | "odd" | "vest";

export type LoadLine = { label: string; value: string };
export type MovementScales = { slug: string; name: string; scales: { label: string; text: string }[] };
export type LoadPlan = { lines: LoadLine[]; byMovement: MovementScales[]; hasLoads: boolean };

export type PlanMember = { slug: string; initials: string; sex: Sex };

export const TIER_ORDER: LoadTier[] = ["rx", "performance", "lifestyle"];

export const TIER_LABEL: Record<LoadTier, string> = {
  rx: "Rx",
  performance: "Performance",
  lifestyle: "Lifestyle",
};

const LIB_CATEGORY = new Map(MOVEMENT_LIBRARY.map((movement) => [movement.id, movement.category]));
const LIB_BY_ID = new Map(MOVEMENT_LIBRARY.map((movement) => [movement.id, movement]));

const CATALOG_CATEGORY: Record<string, ImplementCategory> = {
  back_squat: "barbell",
  front_squat: "barbell",
  overhead_squat: "barbell",
  deadlift: "barbell",
  bench_press: "barbell",
  press: "barbell",
  push_press: "barbell",
  push_jerk: "barbell",
  split_jerk: "barbell",
  jerk: "barbell",
  squat_clean: "barbell",
  power_clean: "barbell",
  hang_power_clean: "barbell",
  squat_snatch: "barbell",
  power_snatch: "barbell",
  hang_power_snatch: "barbell",
  clean_and_jerk: "barbell",
  clean: "barbell",
  snatch: "barbell",
  thruster: "barbell",
  sdhp: "barbell",
  swing: "kettlebell",
  goblet_squat: "dumbbell",
  wall_ball: "odd",
};

export function implementCategory(slug: string): ImplementCategory | null {
  const library = LIB_CATEGORY.get(slug);
  if (library === "dumbbell") return "dumbbell";
  if (library === "weighted_vest") return "vest";
  if (library) return null;
  return CATALOG_CATEGORY[slug] ?? null;
}

export function dayLoadKind(focus: string | undefined, format: string | undefined): LoadKind {
  if (format === "heavy" || focus === "heavy") return "heavy";
  if (focus === "cardio" || focus === "engine" || focus === "gymnastics") return "light";
  return "moderate";
}

function belongs(item: EquipmentRow, category: ImplementCategory): boolean {
  if (category === "vest") return item.slug === "weight_vest";
  if (category === "barbell") return item.kind === "bar" || item.category === "barbell";
  return item.category === category;
}

type Implement = { lb: number; unit: Unit };

function ownedImplements(items: EquipmentRow[], category: ImplementCategory): Implement[] {
  const seen = new Map<number, Implement>();
  for (const item of items) {
    if (!item.owned || item.loadValue == null || !item.unit || !belongs(item, category)) continue;
    const lb = item.unit === "kg" ? item.loadValue * 2.2046226218 : item.loadValue;
    const key = Math.round(lb * 10);
    if (!seen.has(key)) seen.set(key, { lb, unit: item.unit as Unit });
  }
  return [...seen.values()].sort((a, b) => a.lb - b.lb);
}

function nearest(implementsList: Implement[], target: number): Implement {
  return implementsList.reduce((best, item) =>
    Math.abs(item.lb - target) < Math.abs(best.lb - target) ? item : best,
  );
}

function pctFor(load: LoadKind): number {
  if (load === "heavy") return 0.9;
  if (load === "light") return 0.55;
  return 0.75;
}

function bestPr(prs: PrRow[], athlete: string, movement: string): number | null {
  const rows = prs.filter((row) => row.athleteSlug === athlete && row.movementSlug === movement);
  if (!rows.length) return null;
  return rows.reduce((best, row) => (row.value > best ? row.value : best), rows[0].value);
}

function plateList(items: EquipmentRow[]): Plate[] {
  return items
    .filter((item) => item.owned && item.kind === "plate" && item.loadValue && item.quantity >= 2)
    .map((item) => ({
      lb: item.unit === "kg" ? item.loadValue! * 2.2046226218 : item.loadValue!,
      quantity: item.quantity,
      label: `${item.loadValue} ${item.unit}`,
    }));
}

function barWeight(sex: Sex, items: EquipmentRow[]): number | null {
  const bars = items.filter((item) => item.owned && item.kind === "bar" && item.loadValue);
  const womens = bars.find((item) => item.slug === "womens_bar");
  const mens = bars.find((item) => item.slug === "mens_bar");
  const chosen = sex === "f" ? (womens ?? mens ?? bars[0]) : (mens ?? womens ?? bars[0]);
  return chosen?.loadValue ?? null;
}

type TierLbs = { rx: number; perf: number; life: number; unit: Unit };

function tiersFor(
  member: PlanMember,
  category: ImplementCategory,
  movementSlug: string,
  load: LoadKind,
  items: EquipmentRow[],
  prs: PrRow[],
): TierLbs | null {
  const pr = movementSlug ? bestPr(prs, member.slug, movementSlug) : null;
  if (category === "barbell") {
    const bar = barWeight(member.sex, items);
    if (!bar) return null;
    const plates = [...plateList(items)].sort((a, b) => b.lb - a.lb);
    const snap = (target: number) => {
      const loaded = closestLoad(target, bar, plates);
      return loaded ? loaded.loaded : Math.max(bar, target);
    };
    const heaviest = plates[0]?.lb ?? 0;
    const second = plates[1]?.lb ?? 0;
    const rxTarget = pr ? pr * pctFor(load) : bar + (load === "heavy" ? heaviest * 2 : load === "moderate" ? second * 2 : 0);
    const rx = snap(rxTarget);
    const perf = snap(pr ? rx * 0.75 : bar + second * 2);
    const life = snap(pr ? rx * 0.55 : bar);
    return { rx, perf, life, unit: "lb" };
  }

  const implementsList = ownedImplements(items, category);
  if (!implementsList.length) return null;
  const count = implementsList.length;
  const baseIndex = member.sex === "f" && count >= 2 ? count - 2 : count - 1;
  const offset = load === "heavy" ? 0 : load === "light" ? 2 : 1;
  const rx = pr
    ? nearest(implementsList, pr * pctFor(load))
    : implementsList[Math.max(0, baseIndex - offset)];
  const perf = nearest(implementsList, rx.lb * 0.75);
  const life = nearest(implementsList, rx.lb * 0.55);
  return { rx: rx.lb, perf: perf.lb, life: life.lb, unit: rx.unit };
}

function inferCategory(items: EquipmentRow[]): ImplementCategory | null {
  const order: ImplementCategory[] = ["dumbbell", "kettlebell", "odd", "vest", "barbell"];
  for (const category of order) {
    if (ownedImplements(items, category).length) return category;
  }
  return null;
}

function bodyweightScales(slug: string): { label: string; text: string }[] {
  const movement = LIB_BY_ID.get(slug);
  if (!movement) return [];
  const easier = movement.scaling_options.easier
    .map((id) => LIB_BY_ID.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  if (!easier.length) return [];
  return [
    { label: "Performance", text: easier[0] },
    { label: "Lifestyle", text: easier[1] ?? easier[0] },
  ];
}

function tierValue(member: PlanMember, movement: { slug: string; category: ImplementCategory }, tier: LoadTier, input: {
  items: EquipmentRow[];
  prs: PrRow[];
  load: LoadKind;
  unit: Unit;
}): string | null {
  const tiers = tiersFor(member, movement.category, movement.slug, input.load, input.items, input.prs);
  if (!tiers) return null;
  const lb = tier === "rx" ? tiers.rx : tier === "performance" ? tiers.perf : tiers.life;
  return formatLoad(lb, input.unit);
}

export function computeLoadPlan(input: {
  items: EquipmentRow[];
  members: PlanMember[];
  prs: PrRow[];
  load: LoadKind;
  movements: { slug: string; name: string }[];
  unit?: Unit;
  representative?: string;
}): LoadPlan {
  const unit = input.unit ?? "lb";
  const loaded = input.movements
    .map((movement) => ({ ...movement, category: implementCategory(movement.slug) }))
    .filter((movement): movement is { slug: string; name: string; category: ImplementCategory } => Boolean(movement.category));
  const bodyweight = input.movements.filter((movement) => movement.slug && !implementCategory(movement.slug));
  if (!loaded.length && !bodyweight.length) {
    const inferred = inferCategory(input.items);
    if (!inferred) return { lines: [], byMovement: [], hasLoads: false };
    loaded.push({ slug: "", name: "Main lift", category: inferred });
  }

  const members: PlanMember[] = input.members.length
    ? input.members
    : [{ slug: "", initials: "", sex: "m" }];
  const representative = members.find((member) => member.slug === input.representative) ?? members[0];

  const byMovement: MovementScales[] = [];
  for (const movement of loaded) {
    if (!movement.slug) continue;
    const scales = TIER_ORDER.flatMap((tier) => {
      const value = tierValue(representative, movement, tier, { items: input.items, prs: input.prs, load: input.load, unit });
      return value ? [{ label: TIER_LABEL[tier], text: value }] : [];
    });
    if (scales.length) byMovement.push({ slug: movement.slug, name: movement.name, scales });
  }
  for (const movement of bodyweight) {
    const scales = bodyweightScales(movement.slug);
    if (scales.length) byMovement.push({ slug: movement.slug, name: movement.name, scales });
  }

  const primary = loaded[0];
  if (!primary) return { lines: [], byMovement, hasLoads: false };
  const lines: LoadLine[] = TIER_ORDER.flatMap((tier) => {
    const values = members
      .map((member) => {
        const value = tierValue(member, primary, tier, { items: input.items, prs: input.prs, load: input.load, unit });
        if (!value) return null;
        return member.initials ? `${member.initials} ${value}` : value;
      })
      .filter((value): value is string => Boolean(value));
    return values.length ? [{ label: TIER_LABEL[tier], value: values.join(" / ") }] : [];
  });

  return { lines, byMovement, hasLoads: lines.length > 0 };
}

export function loadPlanPrompt(plan: LoadPlan): string {
  if (!plan.hasLoads) {
    return "COMPUTED LOADS: no external load today. Prescribe bodyweight and rep-based versions for Rx, Performance, and Lifestyle, and do not write a Loads block.";
  }
  const block = plan.lines.map((line) => `- ${line.label}: ${line.value}`).join("\n");
  const perMovement = plan.byMovement
    .map((movement) => `- ${movement.name}: ${movement.scales.map((scale) => `${scale.label} ${scale.text}`).join(" / ")}`)
    .join("\n");
  return `COMPUTED LOADS (anchor loads derived from owned gear and logged PRs — the reference effort for a comparable lift, not a movement-blind prescription; Rx may pick a different implement from the owned equipment list when the movement programmed bears more or less than the anchor, with Performance and Lifestyle stepping down from there):
${block}${perMovement ? `\nPer movement:\n${perMovement}` : ""}`;
}

export function ensureLoadLines(existing: LoadLine[], fallback: LoadLine[]): LoadLine[] {
  const labels = new Set(existing.map((line) => line.label.toLowerCase()));
  const missing = fallback.filter((line) => !labels.has(line.label.toLowerCase()));
  return [...existing, ...missing];
}
