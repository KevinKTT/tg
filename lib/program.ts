import { MOVEMENT_LIBRARY, type LibraryPattern } from "./movement-library";

export type Element = "M" | "G" | "W";
export type Pattern = "squat" | "hinge" | "press" | "pull" | "olympic" | "carry" | "none";

export type MovementHit = { slug: string; pattern: Pattern; element: Element };

const LIBRARY_TERMS = MOVEMENT_LIBRARY.flatMap((movement) =>
  [movement.name, ...movement.aliases].map((term) => ({ movement, term })),
).sort((left, right) => right.term.length - left.term.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function libraryPattern(pattern: LibraryPattern): Pattern {
  if (pattern === "squat" || pattern === "lunge") return "squat";
  if (pattern === "hinge") return "hinge";
  if (pattern === "horizontal push" || pattern === "vertical push") return "press";
  if (pattern === "horizontal pull" || pattern === "vertical pull") return "pull";
  if (pattern === "full-body/olympic-style") return "olympic";
  if (pattern === "carry") return "carry";
  return "none";
}

function libraryElement(movement: (typeof MOVEMENT_LIBRARY)[number]): Element {
  if (movement.modality === "monostructural") return "M";
  if (movement.modality === "gymnastics") return "G";
  return "W";
}

const DETECTORS: { re: RegExp; slug: string; pattern: Pattern; element: Element }[] = [
  { re: /\bthrusters?\b/i, slug: "thruster", pattern: "squat", element: "W" },
  { re: /\boverhead squats?\b/i, slug: "overhead_squat", pattern: "squat", element: "W" },
  { re: /\bfront squats?\b/i, slug: "front_squat", pattern: "squat", element: "W" },
  { re: /\bback squats?\b/i, slug: "back_squat", pattern: "squat", element: "W" },
  { re: /\bgoblet squats?\b/i, slug: "goblet_squat", pattern: "squat", element: "W" },
  { re: /\bair squats?\b/i, slug: "air_squat", pattern: "squat", element: "G" },
  { re: /\bdeadlifts?\b/i, slug: "deadlift", pattern: "hinge", element: "W" },
  { re: /\bswings?\b/i, slug: "swing", pattern: "hinge", element: "W" },
  { re: /\bclean and jerks?\b/i, slug: "clean_and_jerk", pattern: "olympic", element: "W" },
  { re: /\bsnatches?\b/i, slug: "snatch", pattern: "olympic", element: "W" },
  { re: /\bcleans?\b/i, slug: "clean", pattern: "olympic", element: "W" },
  { re: /\bjerks?\b/i, slug: "jerk", pattern: "olympic", element: "W" },
  { re: /\bpush presses?\b/i, slug: "push_press", pattern: "press", element: "W" },
  { re: /\bbench presses?\b/i, slug: "bench_press", pattern: "press", element: "W" },
  { re: /\bpress(?:es)?\b/i, slug: "press", pattern: "press", element: "W" },
  { re: /\bhandstand push-?ups?\b|\bhspu\b/i, slug: "hspu", pattern: "press", element: "G" },
  { re: /\bpush-?ups?\b/i, slug: "pushup", pattern: "press", element: "G" },
  { re: /\bpull-?ups?\b/i, slug: "pullup", pattern: "pull", element: "G" },
  { re: /\btoes-?to-?bar\b/i, slug: "toes_to_bar", pattern: "pull", element: "G" },
  { re: /\bwall ?balls?\b/i, slug: "wall_ball", pattern: "squat", element: "W" },
  { re: /\blunges?\b/i, slug: "lunge", pattern: "squat", element: "W" },
  { re: /\bburpees?\b/i, slug: "burpee", pattern: "none", element: "G" },
  { re: /\b(double-?unders?|single-?unders?|jump ropes?)\b/i, slug: "jump_rope", pattern: "none", element: "M" },
  { re: /\b(runs?|running)\b/i, slug: "run", pattern: "none", element: "M" },
  { re: /\b(farmer'?s? )?carries\b|\bcarry\b/i, slug: "carry", pattern: "carry", element: "W" },
  { re: /\bbox jumps?\b/i, slug: "box_jump", pattern: "none", element: "G" },
  { re: /\brows?\b/i, slug: "row", pattern: "pull", element: "W" },
];

/** Best-effort movement detection for legacy rows, load lookup, and recent-history signals. */
export function scanMovements(text: string): MovementHit[] {
  let rest = text;
  const found: MovementHit[] = [];
  const libraryIds = new Set<string>();
  for (const { movement, term } of LIBRARY_TERMS) {
    if (libraryIds.has(movement.id)) continue;
    const matcher = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}(?=$|[^a-z0-9])`, "i");
    if (!matcher.test(rest)) continue;
    found.push({ slug: movement.id, pattern: libraryPattern(movement.movement_pattern), element: libraryElement(movement) });
    libraryIds.add(movement.id);
    rest = rest.replace(new RegExp(matcher.source, "gi"), " ");
  }
  for (const detector of DETECTORS) {
    if (!new RegExp(detector.re.source, "i").test(rest)) continue;
    found.push({ slug: detector.slug, pattern: detector.pattern, element: detector.element });
    rest = rest.replace(new RegExp(detector.re.source, "gi"), " ");
  }
  return found;
}

const TIME_ONLY_STIMULUS = /^\s*(about\s+|around\s+|~)?\d+(?:\s*[-–]\s*\d+)?\s*(?::\d{2}\s*)?(min|mins|minute|minutes|sec|secs|second|seconds)?\.?\s*$/i;

export function stimulusForDisplay(stimulus: string): string {
  const text = stimulus.trim();
  if (!text || TIME_ONLY_STIMULUS.test(text)) return "";
  return text;
}
