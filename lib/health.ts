import fs from "node:fs";
import Database from "better-sqlite3";
import { databasePath } from "./db";

export type HealthReport = {
  ok: true;
  databasePath: string;
  journalMode: string;
  counts: {
    athletes: number;
    scores: number;
    workout_days: number;
  };
};

function countRows(db: Database.Database, table: "athletes" | "scores" | "workout_days"): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}

// Read an existing database. This must not create a file, directory, or schema.
export function readHealth(): HealthReport {
  const file = databasePath();
  if (!fs.statSync(file).isFile()) {
    throw new Error("database file is missing");
  }
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const journalMode = db.pragma("journal_mode", { simple: true });
    if (typeof journalMode !== "string" || journalMode.length === 0) {
      throw new Error("journal mode unavailable");
    }
    return {
      ok: true,
      databasePath: file,
      journalMode,
      counts: {
        athletes: countRows(db, "athletes"),
        scores: countRows(db, "scores"),
        workout_days: countRows(db, "workout_days"),
      },
    };
  } finally {
    db.close();
  }
}
