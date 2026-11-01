import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const SCHEMA = `
CREATE TABLE athletes (slug TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE scores (id INTEGER PRIMARY KEY, display TEXT NOT NULL);
CREATE TABLE workout_days (id INTEGER PRIMARY KEY, date TEXT NOT NULL);
`;

function count(file: string, table: "athletes" | "scores" | "workout_days"): number {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    return row.n;
  } finally {
    db.close();
  }
}

// Checkpointed rows live in the main file. Later rows are copied out while the
// writer is still open so close cannot fold them back into the main file.
function walFixture(dir: string): string {
  const scratch = path.join(dir, "scratch.sqlite");
  const writer = new Database(scratch);
  writer.pragma("journal_mode = WAL");
  writer.pragma("wal_autocheckpoint = 0");
  writer.exec(SCHEMA);
  const insertAthlete = writer.prepare("INSERT INTO athletes (slug, name) VALUES (?, ?)");
  const insertScore = writer.prepare("INSERT INTO scores (display) VALUES (?)");
  const insertDay = writer.prepare("INSERT INTO workout_days (date) VALUES (?)");
  insertAthlete.run("early", "Early");
  insertScore.run("checkpoint");
  insertDay.run("2026-10-01");
  writer.pragma("wal_checkpoint(TRUNCATE)");

  const checkpointBytes = statSync(scratch).size;
  insertAthlete.run("later", "Later");
  insertScore.run("wal");
  insertDay.run("2026-10-31");

  const file = path.join(dir, "tg.sqlite");
  copyFileSync(scratch, file);
  copyFileSync(`${scratch}-wal`, `${file}-wal`);
  writer.close();

  const checkpointOnly = path.join(dir, "checkpoint-only.sqlite");
  copyFileSync(file, checkpointOnly);
  assert.equal(statSync(file).size, checkpointBytes);
  assert.ok(statSync(`${file}-wal`).size > 0);
  assert.equal(count(checkpointOnly, "athletes"), 1);
  assert.equal(count(file, "athletes"), 2);
  assert.equal(count(file, "scores"), 2);
  assert.equal(count(file, "workout_days"), 2);
  return file;
}

function health(databasePath: string): { status: number; body: Record<string, unknown> } {
  const script = `
    import { GET } from ${JSON.stringify(path.join(process.cwd(), "app/api/health/route.ts"))};
    const response = GET();
    const body = await response.json();
    process.stdout.write(JSON.stringify({ status: response.status, body }));
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: databasePath },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout) as { status: number; body: Record<string, unknown> };
}

test("opening an existing WAL database keeps the user tables and does not create a second database", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tg-wal-"));
  const file = walFixture(dir);
  const before = {
    main: statSync(file).size,
    wal: statSync(`${file}-wal`).size,
  };
  const defaultDatabase = path.join(process.cwd(), "data", "tg.sqlite");
  const defaultExisted = existsSync(defaultDatabase);
  const { status, body } = health(file);
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.databasePath, file);
  assert.equal(body.journalMode, "wal");
  assert.deepEqual(body.counts, { athletes: 2, scores: 2, workout_days: 2 });
  assert.equal(statSync(file).size, before.main);
  assert.equal(statSync(`${file}-wal`).size, before.wal);
  assert.equal(count(file, "athletes"), 2);
  assert.equal(count(file, "scores"), 2);
  assert.equal(count(file, "workout_days"), 2);
  assert.deepEqual(
    readdirSync(dir)
      .filter((name) => name.endsWith(".sqlite"))
      .sort(),
    ["checkpoint-only.sqlite", "scratch.sqlite", "tg.sqlite"],
  );
  assert.equal(existsSync(defaultDatabase), defaultExisted);
});

test("health fails when the database file is missing and does not create one", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tg-missing-"));
  const missing = path.join(dir, "absent", "tg.sqlite");
  const { status, body } = health(missing);
  assert.equal(status, 503);
  assert.equal(body.ok, false);
  assert.equal(existsSync(missing), false);
  assert.equal(existsSync(path.dirname(missing)), false);
});
