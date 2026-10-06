import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DAY_TRACK, type Sex, type TrackId } from "./athletes";
import { EQUIPMENT, MOVEMENTS } from "./catalog";
import { env, loadEnv } from "./env";
import { isBetter } from "./scoring";

export type AthleteRow = {
  slug: string;
  name: string;
  initials: string;
  sex: Sex;
  sort: number;
};

export type AthleteSummary = AthleteRow & { hasData: boolean };

export type EquipmentRow = {
  slug: string;
  name: string;
  category: string;
  kind: string;
  loadValue: number | null;
  unit: string | null;
  quantity: number;
  owned: boolean;
  custom: boolean;
  sort: number;
};

export type MovementRow = {
  slug: string;
  name: string;
  category: string;
  scoreKind: string;
  sort: number;
  custom: boolean;
};

export type PrRow = {
  id: number;
  athleteSlug: string;
  movementSlug: string;
  value: number;
  unit: string;
  display: string;
  date: string;
  notes: string;
};

export type PartView = {
  id: number;
  kind: string;
  name: string;
  format: string;
  body: string;
  timeCapSec: number | null;
  scoreType: string;
  scoreDirection: string;
  repsPerRound: number | null;
  sortOrder: number;
};

export type TrackView = {
  id: number;
  track: TrackId;
  summary: string;
  parts: PartView[];
};

export type DayView = {
  id: number;
  date: string;
  title: string;
  stimulus: string;
  source: string;
  sourceText: string;
  focus: string;
  format: string;
  status: string;
  tracks: TrackView[];
};

export type ScoreView = {
  id: number;
  partId: number;
  athleteSlug: string;
  display: string;
  valueNumeric: number;
  notes: string;
  track: string;
  partName: string;
  partKind: string;
  scoreType: string;
  scoreDirection: string;
};

export type DayMark = {
  date: string;
  status: string;
  title: string;
  scoreCount: number;
  athleteCount: number;
};

type SqlEquipment = {
  slug: string;
  name: string;
  category: string;
  kind: string;
  load_value: number | null;
  unit: string | null;
  quantity: number;
  owned: number;
  custom: number;
  sort: number;
};

let database: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS athletes (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  sex TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS equipment (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  kind TEXT NOT NULL,
  load_value REAL,
  unit TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  owned INTEGER NOT NULL DEFAULT 0,
  custom INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS movements (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  score_kind TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  custom INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS prs (
  id INTEGER PRIMARY KEY,
  athlete_slug TEXT NOT NULL,
  movement_slug TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  display TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS workout_days (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  stimulus TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  source_text TEXT NOT NULL DEFAULT '',
  focus TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  program TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',
  equipment_snapshot TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS workout_tracks (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  track TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  UNIQUE(day_id, track)
);
CREATE TABLE IF NOT EXISTS workout_parts (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES workout_tracks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  time_cap_sec INTEGER,
  score_type TEXT NOT NULL DEFAULT 'none',
  score_direction TEXT NOT NULL DEFAULT 'desc',
  reps_per_round INTEGER
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY,
  part_id INTEGER NOT NULL REFERENCES workout_parts(id) ON DELETE CASCADE,
  athlete_slug TEXT NOT NULL,
  display TEXT NOT NULL,
  value_numeric REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(part_id, athlete_slug)
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prs_lookup ON prs(athlete_slug, movement_slug);
CREATE INDEX IF NOT EXISTS idx_days_date ON workout_days(date);
`;

function mapEquipment(row: SqlEquipment): EquipmentRow {
  return {
    slug: row.slug,
    name: row.name,
    category: row.category,
    kind: row.kind,
    loadValue: row.load_value,
    unit: row.unit,
    quantity: row.quantity,
    owned: row.owned === 1,
    custom: row.custom === 1,
    sort: row.sort,
  };
}

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((entry) => entry.name === column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

export function getDb() {
  if (database) return database;
  loadEnv();
  const file = env("DATABASE_PATH") || path.join(process.cwd(), "data", "tg.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  ensureColumn(db, "workout_days", "format", "format TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "workout_days", "program", "program TEXT NOT NULL DEFAULT ''");
  if (ensureColumn(db, "athletes", "sort", "sort INTEGER NOT NULL DEFAULT 0")) {
    db.exec("UPDATE athletes SET sort = rowid");
  }
  seed(db);
  database = db;
  return db;
}

function seed(db: Database.Database) {
  const equipment = db.prepare(
    `INSERT OR IGNORE INTO equipment
      (slug, name, category, kind, load_value, unit, quantity, owned, custom, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
  );
  const seedGear = db.transaction(() => {
    for (const item of EQUIPMENT) {
      equipment.run(
        item.slug,
        item.name,
        item.category,
        item.kind,
        item.loadValue,
        item.unit,
        item.quantity,
        item.sort,
      );
    }
  });
  seedGear();

  const movement = db.prepare(
    `INSERT INTO movements (slug, name, category, score_kind, sort, custom)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       score_kind = excluded.score_kind,
       sort = excluded.sort
     WHERE movements.custom = 0`,
  );
  const seedMoves = db.transaction(() => {
    for (const item of MOVEMENTS) {
      movement.run(item.slug, item.name, item.category, item.scoreKind, item.sort);
    }
  });
  seedMoves();
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function defaultInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2);
  return words.slice(0, 2).map((word) => word[0]).join("");
}

function cleanInitials(name: string, initials: string): string {
  return (initials.trim() || defaultInitials(name)).toUpperCase().slice(0, 4);
}

export function listAthletes(): AthleteRow[] {
  return getDb()
    .prepare("SELECT slug, name, initials, sex, sort FROM athletes ORDER BY sort, name")
    .all() as AthleteRow[];
}

export function getAthlete(slug: string): AthleteRow | null {
  const row = getDb()
    .prepare("SELECT slug, name, initials, sex, sort FROM athletes WHERE slug = ?")
    .get(slug) as AthleteRow | undefined;
  return row ?? null;
}

export function athleteExists(slug: string): boolean {
  return Boolean(getDb().prepare("SELECT 1 FROM athletes WHERE slug = ?").get(slug));
}

export function athleteHasData(slug: string): boolean {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM scores WHERE athlete_slug = ? LIMIT 1").get(slug)) return true;
  return Boolean(db.prepare("SELECT 1 FROM prs WHERE athlete_slug = ? LIMIT 1").get(slug));
}

export function listAthleteSummaries(): AthleteSummary[] {
  return listAthletes().map((member) => ({ ...member, hasData: athleteHasData(member.slug) }));
}

export function addAthlete(input: { name: string; initials: string; sex: Sex }): string | null {
  const name = input.name.trim();
  if (!name) return null;
  const db = getDb();
  const base = slugify(name) || "member";
  let slug = base;
  let n = 2;
  const exists = db.prepare("SELECT 1 FROM athletes WHERE slug = ?");
  while (exists.get(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  const next = db.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS value FROM athletes").get() as { value: number };
  db.prepare("INSERT INTO athletes (slug, name, initials, sex, sort) VALUES (?, ?, ?, ?, ?)").run(
    slug,
    name,
    cleanInitials(name, input.initials),
    input.sex,
    next.value,
  );
  return slug;
}

export function updateAthlete(slug: string, input: { name: string; initials: string; sex: Sex }) {
  const name = input.name.trim();
  if (!name) return;
  getDb()
    .prepare("UPDATE athletes SET name = ?, initials = ?, sex = ? WHERE slug = ?")
    .run(name, cleanInitials(name, input.initials), input.sex, slug);
}

export function deleteAthlete(slug: string) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM scores WHERE athlete_slug = ?").run(slug);
    db.prepare("DELETE FROM prs WHERE athlete_slug = ?").run(slug);
    db.prepare("DELETE FROM athletes WHERE slug = ?").run(slug);
  });
  tx();
}

export function listEquipment(): EquipmentRow[] {
  const rows = getDb().prepare("SELECT * FROM equipment ORDER BY sort, name").all() as SqlEquipment[];
  return rows.map(mapEquipment);
}

export function countOwned(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM equipment WHERE owned = 1").get() as { n: number };
  return row.n;
}

export function setOwned(slug: string, owned: boolean) {
  const db = getDb();
  const current = db.prepare("SELECT kind, quantity FROM equipment WHERE slug = ?").get(slug) as
    | { kind: string; quantity: number }
    | undefined;
  if (!current) return;
  let quantity = current.quantity;
  if (owned && quantity < 1 && current.kind !== "item") quantity = current.kind === "plate" || current.kind === "implement" ? 2 : 1;
  if (owned && current.kind === "kettlebell") quantity = Math.max(quantity, 1);
  db.prepare("UPDATE equipment SET owned = ?, quantity = ? WHERE slug = ?").run(owned ? 1 : 0, quantity, slug);
}

export function setQuantity(slug: string, quantity: number) {
  const next = Math.max(0, Math.round(quantity));
  getDb().prepare("UPDATE equipment SET quantity = ?, owned = CASE WHEN ? > 0 THEN 1 ELSE owned END WHERE slug = ?").run(next, next, slug);
}

export function addEquipment(input: {
  name: string;
  category: string;
  kind: string;
  loadValue: number | null;
  unit: string | null;
  quantity: number;
}) {
  const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  let slug = `custom-${base}`;
  const exists = getDb().prepare("SELECT 1 FROM equipment WHERE slug = ?");
  let n = 2;
  while (exists.get(slug)) {
    slug = `custom-${base}-${n}`;
    n += 1;
  }
  getDb()
    .prepare(
      `INSERT INTO equipment (slug, name, category, kind, load_value, unit, quantity, owned, custom, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 5000)`,
    )
    .run(slug, input.name.trim(), input.category, input.kind, input.loadValue, input.unit, Math.max(1, input.quantity));
}

export function listMovements(): MovementRow[] {
  const rows = getDb().prepare("SELECT * FROM movements ORDER BY sort, name").all() as {
    slug: string;
    name: string;
    category: string;
    score_kind: string;
    sort: number;
    custom: number;
  }[];
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    category: row.category,
    scoreKind: row.score_kind,
    sort: row.sort,
    custom: row.custom === 1,
  }));
}

export function addMovement(name: string, category: string, scoreKind: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "move";
  let slug = `custom-${base}`;
  const exists = getDb().prepare("SELECT 1 FROM movements WHERE slug = ?");
  let n = 2;
  while (exists.get(slug)) {
    slug = `custom-${base}-${n}`;
    n += 1;
  }
  getDb()
    .prepare("INSERT INTO movements (slug, name, category, score_kind, sort, custom) VALUES (?, ?, ?, ?, 900, 1)")
    .run(slug, name.trim(), category, scoreKind);
}

export function listPrs(): PrRow[] {
  const rows = getDb()
    .prepare("SELECT id, athlete_slug, movement_slug, value, unit, display, date, notes FROM prs ORDER BY date DESC, id DESC")
    .all() as {
    id: number;
    athlete_slug: string;
    movement_slug: string;
    value: number;
    unit: string;
    display: string;
    date: string;
    notes: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    athleteSlug: row.athlete_slug,
    movementSlug: row.movement_slug,
    value: row.value,
    unit: row.unit,
    display: row.display,
    date: row.date,
    notes: row.notes,
  }));
}

export function bestPr(prs: PrRow[], athlete: string, movement: string, scoreKind: string): PrRow | null {
  const rows = prs.filter((row) => row.athleteSlug === athlete && row.movementSlug === movement);
  return rows.reduce<PrRow | null>((best, row) => {
    if (!best || isBetter(scoreKind, row.value, best.value)) return row;
    return best;
  }, null);
}

export function insertPr(input: Omit<PrRow, "id">) {
  getDb()
    .prepare(
      "INSERT INTO prs (athlete_slug, movement_slug, value, unit, display, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(input.athleteSlug, input.movementSlug, input.value, input.unit, input.display, input.date, input.notes);
}

export function deletePr(id: number) {
  getDb().prepare("DELETE FROM prs WHERE id = ?").run(id);
}

function mapPart(row: {
  id: number;
  kind: string;
  name: string;
  format: string;
  body: string;
  time_cap_sec: number | null;
  score_type: string;
  score_direction: string;
  reps_per_round: number | null;
  sort_order: number;
}): PartView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    format: row.format,
    body: row.body,
    timeCapSec: row.time_cap_sec,
    scoreType: row.score_type,
    scoreDirection: row.score_direction,
    repsPerRound: row.reps_per_round,
    sortOrder: row.sort_order,
  };
}

export function getDay(date: string): DayView | null {
  const db = getDb();
  const day = db.prepare("SELECT * FROM workout_days WHERE date = ?").get(date) as
    | {
        id: number;
        date: string;
        title: string;
        stimulus: string;
        source: string;
        source_text: string;
        focus: string;
        format: string;
        status: string;
      }
    | undefined;
  if (!day) return null;
  const tracks = db.prepare("SELECT * FROM workout_tracks WHERE day_id = ?").all(day.id) as {
    id: number;
    track: TrackId;
    summary: string;
  }[];
  const parts = db
    .prepare(
      `SELECT p.*, t.id AS track_id FROM workout_parts p
       JOIN workout_tracks t ON t.id = p.track_id
       WHERE t.day_id = ?
       ORDER BY p.sort_order, p.id`,
    )
    .all(day.id) as ({ track_id: number } & Parameters<typeof mapPart>[0])[];
  return {
    id: day.id,
    date: day.date,
    title: day.title,
    stimulus: day.stimulus,
    source: day.source,
    sourceText: day.source_text,
    focus: day.focus,
    format: day.format,
    status: day.status,
    tracks: tracks.map((track) => ({
      id: track.id,
      track: track.track,
      summary: track.summary,
      parts: parts.filter((part) => part.track_id === track.id).map(mapPart),
    })),
  };
}

export function dayHasScores(date: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM scores s
       JOIN workout_parts p ON p.id = s.part_id
       JOIN workout_tracks t ON t.id = p.track_id
       JOIN workout_days d ON d.id = t.day_id
       WHERE d.date = ?`,
    )
    .get(date) as { n: number };
  return row.n > 0;
}

export function listDays(from: string, to: string): DayMark[] {
  const rows = getDb()
    .prepare(
      `SELECT d.date, d.status, d.title,
        (SELECT COUNT(*) FROM scores s
          JOIN workout_parts p ON p.id = s.part_id
          JOIN workout_tracks t ON t.id = p.track_id
          WHERE t.day_id = d.id) AS score_count,
        (SELECT COUNT(DISTINCT s.athlete_slug) FROM scores s
          JOIN workout_parts p ON p.id = s.part_id
          JOIN workout_tracks t ON t.id = p.track_id
          WHERE t.day_id = d.id) AS athlete_count
       FROM workout_days d
       WHERE d.date >= ? AND d.date <= ?
       ORDER BY d.date`,
    )
    .all(from, to) as { date: string; status: string; title: string; score_count: number; athlete_count: number }[];
  return rows.map((row) => ({
    date: row.date,
    status: row.status,
    title: row.title,
    scoreCount: row.score_count,
    athleteCount: row.athlete_count,
  }));
}

export type DaySignal = {
  date: string;
  focus: string;
  format: string;
  stimulus: string;
  program: string;
  text: string;
};

export function recentDaySignals(before: string, limit = 21): DaySignal[] {
  const db = getDb();
  const days = db
    .prepare(
      `SELECT id, date, focus, format, stimulus, program FROM workout_days
       WHERE date < ? AND status != 'rest'
       ORDER BY date DESC LIMIT ?`,
    )
    .all(before, limit) as {
    id: number;
    date: string;
    focus: string;
    format: string;
    stimulus: string;
    program: string;
  }[];
  const parts = db.prepare(
    `SELECT p.body FROM workout_parts p
     JOIN workout_tracks t ON t.id = p.track_id
     WHERE t.day_id = ? AND p.kind NOT IN ('warmup', 'prep', 'cooldown')
     ORDER BY p.sort_order, p.id`,
  );
  return days.map((day) => ({
    date: day.date,
    focus: day.focus,
    format: day.format,
    stimulus: day.stimulus,
    program: day.program ?? "",
    text: (parts.all(day.id) as { body: string }[]).map((row) => row.body).join("\n"),
  }));
}

export function recentFormats(before: string, limit = 3): string[] {
  const rows = getDb()
    .prepare(
      `SELECT format FROM workout_days
       WHERE date < ? AND status != 'rest' AND format != ''
       ORDER BY date DESC LIMIT ?`,
    )
    .all(before, limit) as { format: string }[];
  return rows.map((row) => row.format);
}

export function getScores(dayId: number): ScoreView[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.part_id, s.athlete_slug, s.display, s.value_numeric, s.notes,
              t.track, p.name AS part_name, p.kind AS part_kind, p.score_type, p.score_direction
       FROM scores s
       JOIN workout_parts p ON p.id = s.part_id
       JOIN workout_tracks t ON t.id = p.track_id
       WHERE t.day_id = ?`,
    )
    .all(dayId) as {
    id: number;
    part_id: number;
    athlete_slug: string;
    display: string;
    value_numeric: number;
    notes: string;
    track: string;
    part_name: string;
    part_kind: string;
    score_type: string;
    score_direction: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    partId: row.part_id,
    athleteSlug: row.athlete_slug,
    display: row.display,
    valueNumeric: row.value_numeric,
    notes: row.notes,
    track: row.track,
    partName: row.part_name,
    partKind: row.part_kind,
    scoreType: row.score_type,
    scoreDirection: row.score_direction,
  }));
}

export function upsertScore(input: {
  partId: number;
  athleteSlug: string;
  display: string;
  valueNumeric: number;
  notes: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO scores (part_id, athlete_slug, display, value_numeric, notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(part_id, athlete_slug) DO UPDATE SET
         display = excluded.display,
         value_numeric = excluded.value_numeric,
         notes = excluded.notes`,
    )
    .run(input.partId, input.athleteSlug, input.display, input.valueNumeric, input.notes);
}

export function deleteScore(id: number) {
  getDb().prepare("DELETE FROM scores WHERE id = ?").run(id);
}

export function updateDayMeta(date: string, title: string, stimulus: string) {
  getDb().prepare("UPDATE workout_days SET title = ?, stimulus = ? WHERE date = ?").run(title, stimulus, date);
}

export function updatePart(id: number, body: string, format: string) {
  getDb().prepare("UPDATE workout_parts SET body = ?, format = ? WHERE id = ?").run(body, format, id);
}

export function deleteDay(date: string) {
  getDb().prepare("DELETE FROM workout_days WHERE date = ?").run(date);
}

export type GeneratedPart = {
  name: string;
  kind: "strength" | "metcon" | "skill";
  format: string;
  details: string;
  timeCapMin: number | null;
  scoreType: "time" | "reps" | "rounds_reps" | "load" | "none";
  repsPerRound: number | null;
};

export type GeneratedTrack = {
  summary: string;
  warmup: string;
  prep: string;
  cooldown: string;
  parts: GeneratedPart[];
};

export function saveGeneratedDay(input: {
  date: string;
  title: string;
  stimulus: string;
  source: string;
  sourceText: string;
  focus: string;
  format: string;
  program?: string;
  status?: string;
  snapshot: string;
  track: GeneratedTrack;
}) {
  const db = getDb();
  const direction = (scoreType: string) => (scoreType === "time" ? "asc" : "desc");
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM workout_days WHERE date = ?").run(input.date);
    const day = db
      .prepare(
        `INSERT INTO workout_days (date, title, stimulus, source, source_text, focus, format, program, status, equipment_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.date,
        input.title,
        input.stimulus,
        input.source,
        input.sourceText,
        input.focus,
        input.format,
        input.program ?? "",
        input.status ?? "published",
        input.snapshot,
      );
    const dayId = Number(day.lastInsertRowid);
    const insertTrack = db.prepare("INSERT INTO workout_tracks (day_id, track, summary) VALUES (?, ?, ?)");
    const insertPart = db.prepare(
      `INSERT INTO workout_parts
        (track_id, sort_order, kind, name, format, body, time_cap_sec, score_type, score_direction, reps_per_round)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const body = input.track;
    const inserted = insertTrack.run(dayId, DAY_TRACK, body.summary);
    const trackId = Number(inserted.lastInsertRowid);
    insertPart.run(trackId, 0, "warmup", "Warm-up", "", body.warmup, null, "none", "desc", null);
    if (body.prep.trim()) {
      insertPart.run(trackId, 1, "prep", "Workout prep", "", body.prep, null, "none", "desc", null);
    }
    body.parts.forEach((part, index) => {
      insertPart.run(
        trackId,
        index + 2,
        part.kind,
        part.name,
        part.format,
        part.details,
        part.timeCapMin ? Math.round(part.timeCapMin * 60) : null,
        part.scoreType,
        direction(part.scoreType),
        part.repsPerRound,
      );
    });
    insertPart.run(trackId, 100, "cooldown", "Cool-down", "", body.cooldown, null, "none", "desc", null);
  });
  tx();
}

export function saveManualDay(input: {
  date: string;
  title: string;
  stimulus: string;
  warmup: string;
  prep: string;
  strength: string;
  metcon: string;
  scoreType: string;
  timeCapMin: number | null;
  cooldown: string;
}) {
  const scoreType = (["time", "reps", "rounds_reps", "load", "none"].includes(input.scoreType)
    ? input.scoreType
    : "time") as GeneratedPart["scoreType"];
  const parts: GeneratedPart[] = [];
  if (input.strength.trim()) {
    parts.push({
      name: "Strength",
      kind: "strength",
      format: "",
      details: input.strength.trim(),
      timeCapMin: null,
      scoreType: "none",
      repsPerRound: null,
    });
  }
  parts.push({
    name: "Metcon",
    kind: "metcon",
    format: "",
    details: input.metcon.trim(),
    timeCapMin: input.timeCapMin,
    scoreType,
    repsPerRound: null,
  });
  const track: GeneratedTrack = {
    summary: "Written in the garage.",
    warmup: input.warmup.trim(),
    prep: input.prep.trim(),
    cooldown: input.cooldown.trim(),
    parts,
  };
  saveGeneratedDay({
    date: input.date,
    title: input.title.trim() || "Garage workout",
    stimulus: input.stimulus.trim(),
    source: "manual",
    sourceText: "",
    focus: "mixed",
    format: "",
    snapshot: "[]",
    track,
  });
}

export function markRest(date: string) {
  const track: GeneratedTrack = {
    summary: "",
    warmup: "Walk, or skip it.",
    prep: "",
    cooldown: "Easy stretch if you want it.",
    parts: [],
  };
  saveGeneratedDay({
    date,
    title: "Rest",
    stimulus: "Rest day.",
    source: "manual",
    sourceText: "",
    focus: "rest",
    format: "",
    status: "rest",
    snapshot: "[]",
    track,
  });
}
