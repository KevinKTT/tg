"use server";

import { revalidatePath } from "next/cache";
import type { Sex } from "./athletes";
import { isISODate, todayISO } from "./dates";
import {
  addAthlete,
  addEquipment,
  addMovement,
  athleteExists,
  athleteHasData,
  deleteAthlete,
  deleteDay,
  deletePr,
  deleteScore,
  getDay,
  insertPr,
  listMovements,
  markRest,
  saveManualDay,
  setOwned,
  setQuantity,
  updateAthlete,
  updateDayMeta,
  updatePart,
  upsertScore,
} from "./db";
import { lbFrom, normalizeScore, roundLoad } from "./scoring";

function refresh() {
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function number(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : NaN;
}

function sex(formData: FormData): Sex {
  return text(formData, "sex") === "f" ? "f" : "m";
}

export async function createAthlete(formData: FormData) {
  const name = text(formData, "name");
  if (!name) return;
  addAthlete({ name, initials: text(formData, "initials"), sex: sex(formData) });
  refresh();
}

export async function editAthlete(formData: FormData) {
  const slug = text(formData, "slug");
  const name = text(formData, "name");
  if (!slug || !name) return;
  updateAthlete(slug, { name, initials: text(formData, "initials"), sex: sex(formData) });
  refresh();
}

export async function removeAthlete(formData: FormData) {
  const slug = text(formData, "slug");
  if (!slug || athleteHasData(slug)) return;
  deleteAthlete(slug);
  refresh();
}

export async function toggleEquipment(formData: FormData) {
  const slug = text(formData, "slug");
  const owned = text(formData, "owned") !== "1";
  setOwned(slug, owned);
  refresh();
}

export async function changeQuantity(formData: FormData) {
  setQuantity(text(formData, "slug"), number(formData, "quantity"));
  refresh();
}

export async function createEquipment(formData: FormData) {
  const name = text(formData, "name");
  if (!name) return;
  const kind = text(formData, "kind") || "item";
  const load = number(formData, "load");
  addEquipment({
    name,
    category: text(formData, "category") || "accessory",
    kind,
    loadValue: Number.isFinite(load) && load > 0 ? load : null,
    unit: text(formData, "unit") === "kg" ? "kg" : kind === "item" ? null : "lb",
    quantity: Number.isFinite(number(formData, "quantity")) ? number(formData, "quantity") : 1,
  });
  refresh();
}

export async function savePr(formData: FormData) {
  const athlete = text(formData, "athlete");
  const movementSlug = text(formData, "movement");
  const date = text(formData, "date") || todayISO();
  if (!athleteExists(athlete) || !movementSlug || !isISODate(date)) return;
  const movement = listMovements().find((item) => item.slug === movementSlug);
  if (!movement) return;
  const notes = text(formData, "notes");
  const unit = text(formData, "unit") === "kg" ? "kg" : "lb";

  if (movement.scoreKind === "load") {
    const entered = number(formData, "value");
    if (!Number.isFinite(entered) || entered <= 0) return;
    insertPr({
      athleteSlug: athlete,
      movementSlug,
      value: lbFrom(entered, unit),
      unit: "lb",
      display: `${roundLoad(entered, unit)} ${unit}`,
      date,
      notes,
    });
  } else if (movement.scoreKind === "time") {
    const score = normalizeScore({
      scoreType: "time",
      minutes: number(formData, "minutes"),
      seconds: number(formData, "seconds"),
    });
    if (!score) return;
    insertPr({
      athleteSlug: athlete,
      movementSlug,
      value: score.value,
      unit: "sec",
      display: score.display,
      date,
      notes,
    });
  } else if (movement.scoreKind === "rounds_reps") {
    const score = normalizeScore({
      scoreType: "rounds_reps",
      rounds: number(formData, "rounds"),
      reps: number(formData, "reps"),
    });
    if (!score) return;
    insertPr({
      athleteSlug: athlete,
      movementSlug,
      value: score.value,
      unit: "rounds_reps",
      display: score.display,
      date,
      notes,
    });
  } else {
    const reps = number(formData, "reps");
    if (!Number.isFinite(reps) || reps < 0) return;
    insertPr({
      athleteSlug: athlete,
      movementSlug,
      value: Math.round(reps),
      unit: "reps",
      display: String(Math.round(reps)),
      date,
      notes,
    });
  }
  refresh();
}

export async function removePr(formData: FormData) {
  const id = number(formData, "id");
  if (Number.isFinite(id)) deletePr(id);
  refresh();
}

export async function createMovement(formData: FormData) {
  const name = text(formData, "name");
  const scoreKind = text(formData, "scoreKind");
  const category = text(formData, "category") || "lift";
  if (!name || !["load", "reps", "time", "rounds_reps"].includes(scoreKind)) return;
  addMovement(name, category, scoreKind);
  refresh();
}

export async function saveScore(formData: FormData) {
  const athlete = text(formData, "athlete");
  const partId = number(formData, "partId");
  const scoreType = text(formData, "scoreType");
  if (!athleteExists(athlete) || !Number.isFinite(partId)) return;
  const unit = text(formData, "unit") === "kg" ? "kg" : "lb";
  const score = normalizeScore({
    scoreType,
    minutes: number(formData, "minutes"),
    seconds: number(formData, "seconds"),
    reps: number(formData, "reps"),
    rounds: number(formData, "rounds"),
    load: number(formData, "load"),
    unit,
  });
  if (!score) return;
  upsertScore({
    partId,
    athleteSlug: athlete,
    display: score.display,
    valueNumeric: score.value,
    notes: text(formData, "notes"),
  });
  refresh();
}

export async function removeScore(formData: FormData) {
  const id = number(formData, "id");
  if (Number.isFinite(id)) deleteScore(id);
  refresh();
}

export async function writeDay(formData: FormData) {
  const date = text(formData, "date");
  if (!isISODate(date)) return;
  const cap = number(formData, "timeCap");
  saveManualDay({
    date,
    title: text(formData, "title"),
    stimulus: text(formData, "stimulus"),
    warmup: text(formData, "warmup"),
    prep: text(formData, "prep"),
    strength: text(formData, "strength"),
    metcon: text(formData, "metcon"),
    scoreType: text(formData, "scoreType") || "time",
    timeCapMin: Number.isFinite(cap) && cap > 0 ? cap : null,
    cooldown: text(formData, "cooldown"),
  });
  refresh();
}

export async function restDay(formData: FormData) {
  const date = text(formData, "date");
  if (!isISODate(date)) return;
  markRest(date);
  refresh();
}

export async function editDay(formData: FormData) {
  const date = text(formData, "date");
  if (!isISODate(date) || !getDay(date)) return;
  updateDayMeta(date, text(formData, "title") || "Workout", text(formData, "stimulus"));
  refresh();
}

export async function editPart(formData: FormData) {
  const id = number(formData, "id");
  if (!Number.isFinite(id)) return;
  updatePart(id, text(formData, "body"), text(formData, "format"));
  refresh();
}

export async function removeDay(formData: FormData) {
  const date = text(formData, "date");
  if (isISODate(date)) deleteDay(date);
  refresh();
}
