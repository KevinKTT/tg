import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("a non-empty DATABASE_PATH in the process environment is not replaced by .env", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tg-env-"));
  // The local-dev default is the value this test must not let the process environment lose.
  writeFileSync(path.join(dir, ".env"), "DATABASE_PATH=./data/tg.sqlite\nTG_ENV_FILE_MARKER=from-dotenv\n"); // pragma: allowlist secret
  const script = `
    process.chdir(process.env.TG_ENV_DIR);
    const { env } = await import(process.env.TG_ENV_MODULE);
    const got = env("DATABASE_PATH");
    if (got !== "/data/tg.sqlite") {
      console.error("resolved " + JSON.stringify(got));
      process.exit(1);
    }
    if (process.env.DATABASE_PATH !== "/data/tg.sqlite") {
      console.error("process " + JSON.stringify(process.env.DATABASE_PATH));
      process.exit(2);
    }
    if (env("TG_ENV_FILE_MARKER") !== "from-dotenv") {
      console.error("dotenv was not loaded");
      process.exit(3);
    }
  `;
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_PATH: "/data/tg.sqlite",
        TG_ENV_DIR: dir,
        TG_ENV_MODULE: path.join(process.cwd(), "lib/env.ts"),
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
