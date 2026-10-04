import { fromLb, roundLoad } from "./scoring";

export type Plate = {
  lb: number;
  quantity: number;
  label: string;
};

export type LoadedBar = {
  achievable: boolean;
  loaded: number;
  perSide: { lb: number; count: number; label: string }[];
  label: string;
};

const EPS = 0.05;

export function loadBar(targetLb: number, barLb: number, plates: Plate[]): LoadedBar {
  if (targetLb + EPS < barLb) {
    return { achievable: false, loaded: barLb, perSide: [], label: `under the ${roundLoad(barLb, "lb")} lb bar` };
  }
  let remaining = (targetLb - barLb) / 2;
  const perSide: LoadedBar["perSide"] = [];
  const sorted = [...plates].filter((plate) => plate.quantity >= 2 && plate.lb > 0).sort((a, b) => b.lb - a.lb);
  for (const plate of sorted) {
    const pairs = Math.floor(plate.quantity / 2);
    const count = Math.min(pairs, Math.floor((remaining + EPS) / plate.lb));
    if (count > 0) {
      perSide.push({ lb: plate.lb, count, label: plate.label });
      remaining -= count * plate.lb;
    }
  }
  const loaded = targetLb - remaining * 2;
  const achievable = Math.abs(remaining) < EPS;
  return {
    achievable,
    loaded: achievable ? targetLb : loaded,
    perSide,
    label: plateLabel(barLb, perSide),
  };
}

export function closestLoad(targetLb: number, barLb: number, plates: Plate[]): LoadedBar | null {
  if (plates.length === 0) return null;
  let best: LoadedBar | null = null;
  const start = Math.max(barLb, targetLb - 50);
  const end = targetLb + 50;
  for (let candidate = start; candidate <= end + EPS; candidate += 0.5) {
    const attempt = loadBar(candidate, barLb, plates);
    if (!attempt.achievable) continue;
    if (!best || Math.abs(attempt.loaded - targetLb) < Math.abs(best.loaded - targetLb) - EPS) {
      best = attempt;
    }
  }
  return best;
}

export function plateLabel(barLb: number, perSide: { count: number; label: string }[]): string {
  if (perSide.length === 0) return `${roundLoad(barLb, "lb")} lb bar`;
  const side = perSide
    .map((plate) => (plate.count > 1 ? `${plate.count}×${plate.label}` : plate.label))
    .join(" + ");
  return `${roundLoad(barLb, "lb")} lb bar · ${side} / side`;
}

export function percentOf(max: number, pct: number): number {
  return (max * pct) / 100;
}

export function formatPercentLoad(lb: number, unit: "lb" | "kg"): string {
  return `${roundLoad(fromLb(lb, unit), unit)} ${unit}`;
}
