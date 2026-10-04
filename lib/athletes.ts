export type Sex = "m" | "f";
export type Unit = "lb" | "kg";

export const DAY_TRACK = "day" as const;
export type TrackId = typeof DAY_TRACK;

export const WEEK_PLAN = ["strength", "cardio", "mixed", "heavy", "cardio", "mixed", "rest"] as const;

export function focusForDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const focus = WEEK_PLAN[(date.getDay() + 6) % 7];
  return focus === "rest" ? "mixed" : focus;
}

export const FOCUSES = [
  { id: "mixed", label: "Mixed" },
  { id: "strength", label: "Strength" },
  { id: "heavy", label: "Heavy" },
  { id: "cardio", label: "Cardio" },
  { id: "engine", label: "Engine" },
  { id: "gymnastics", label: "Gymnastics" },
  { id: "olympic", label: "Olympic lifting" },
  { id: "rest", label: "Rest" },
] as const;

export type FocusId = (typeof FOCUSES)[number]["id"];

export function focusLabel(id: string): string {
  return FOCUSES.find((item) => item.id === id)?.label ?? id;
}
