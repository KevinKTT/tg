import { MOVEMENT_ALIASES } from "./catalog";

export type PercentHit = {
  pct: number;
  slug: string;
  label: string;
};

export function findPercents(text: string): PercentHit[] {
  const pattern = /(\d{1,3})\s*%(?:\s+of)?(?:\s+max)?\s+([a-z][a-z0-9 &'/-]{1,40})/gi;
  const hits: PercentHit[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const pct = Number(match[1]);
    if (pct < 30 || pct > 100) continue;
    const raw = match[2].replace(/\bmax\b/gi, "").replace(/[^a-z0-9 &'/-]+/gi, " ").trim().toLowerCase();
    const alias = MOVEMENT_ALIASES.find(([name]) => raw === name || raw.startsWith(`${name} `));
    if (!alias) continue;
    const key = `${pct}:${alias[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ pct, slug: alias[1], label: alias[0] });
  }
  return hits;
}
