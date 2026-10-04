import fs from "node:fs";
import path from "node:path";

const fromFile = new Map<string, string>();
let loaded = false;

function parseEnv(text: string) {
  const values = new Map<string, string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

export function loadEnv() {
  if (loaded) return;
  loaded = true;
  for (const name of [".env", ".env.local"]) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const [key, value] of parseEnv(fs.readFileSync(file, "utf8"))) {
      if (!value.trim()) continue;
      fromFile.set(key, value);
      const live = process.env[key];
      if (typeof live === "string" && live.trim()) continue;
      process.env[key] = value;
    }
  }
}

export function env(name: string): string {
  loadEnv();
  const live = process.env[name];
  if (typeof live === "string" && live.trim()) return live;
  return fromFile.get(name) || "";
}
