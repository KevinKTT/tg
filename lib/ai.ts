import OpenAI from "openai";
import { isFormatError, modeOrder, resolveProvider, type JsonMode, type ProviderConfig } from "./ai-config";
import { FOCUSES, focusLabel } from "./athletes";
import { MOVEMENT_ALIASES } from "./catalog";
import {
  getDay,
  listAthletes,
  listEquipment,
  recentDaySignals,
  saveGeneratedDay,
  type DayView,
  type EquipmentRow,
  type TrackView,
} from "./db";
import { env, loadEnv } from "./env";
import { scanMovements } from "./program";
import {
  aiWorkoutSchema,
  buildClassFromAi,
  buildFallbackClass,
  parseAiWorkout,
  partCapSec,
  partScoreType,
  renderPieceBody,
  type AiWorkout,
  type ClassPlan,
  type PlannedPiece,
} from "./engine/class";
import {
  equipmentProfile,
  movementById,
  movementEligible,
  MOVEMENT_CATALOG,
  type Dose,
  type EquipmentProfile,
  type MovementDef,
  type MovementPattern,
} from "./engine/movements";
import {
  assignmentPrompt,
  hashString,
  isFocus,
  planDay,
  shortlistForPiece,
  withMetconScheme,
  type DayAssignment,
  type Focus,
  type RecentSignal,
  type SessionShape,
  type Shortlist,
} from "./engine/planner";
import { formatText, schemeMinutes, type Scheme } from "./engine/scheme";
import { coachDose } from "./engine/roles";
import { formatIssues, validateAiWorkout } from "./engine/validate";

const SYSTEM_PROMPT = `You are the head coach for a small garage CrossFit gym.
The assignment already chose the scheme and the slots. You choose the title, the stimulus, and one movement per slot.

Standards:
- Use only movement IDs from that slot. Return them in slot order. Never use equipment the athlete does not own.
- Prefer the first IDs in each slot. They are the classic choices. Do not pick a variation, trick, isometric, or accessory when a staple is listed.
- Fill a loaded slot, a gymnastics slot, and an engine slot with those staples when the assignment lists them.
- Keep every dose inside the range shown. A couplet or triplet round should take about a minute. An EMOM minute, or a 2-minute station, should finish with rest left. A chipper is one hard pass.
- Never stack two movements with the same pattern in one piece.
- Strength and skill pieces: the scheme owns the dose. Movement choice is what matters.
- Title: short and specific, like a whiteboard name. Do not name a scheme the assignment did not ask for.
- Stimulus: one line on effort and pacing. Never put a time estimate in it.
- Whiteboard style: the app renders the scheme, doses, loads, and scales. You provide only the title, stimulus, and movement choices.
Return one JSON object matching the schema. Do not add pieces or slots the assignment did not ask for.`;

function inventoryText(items: EquipmentRow[]) {
  const owned = items.filter((item) => item.owned);
  return owned
    .map((item) => {
      const load = item.loadValue != null ? ` ${item.loadValue} ${item.unit}` : "";
      const count = item.kind === "item" ? "" : ` x${item.quantity}`;
      return `- ${item.name}${load}${count} [${item.slug}]`;
    })
    .join("\n");
}

function memberLabel(member: { initials: string; name: string; sex: string }): string {
  return `${member.initials} (${member.name}, ${member.sex === "f" ? "female" : "male"})`;
}

function recentSignals(date: string): RecentSignal[] {
  return recentDaySignals(date, 14).map((row) => {
    let pattern: MovementPattern = "none";
    let movements: string[] = [];
    let load: RecentSignal["load"];
    try {
      const stored = JSON.parse(row.program) as { pattern?: MovementPattern; movements?: string[]; load?: RecentSignal["load"] };
      if (stored.pattern) pattern = stored.pattern;
      if (Array.isArray(stored.movements)) movements = stored.movements;
      if (stored.load) load = stored.load;
    } catch {
      // Legacy row: fall back to scanning the rendered text.
    }
    if (!movements.length) {
      movements = scanMovements(row.text).map((hit) => hit.slug);
    }
    return {
      date: row.date,
      pattern,
      scheme: row.format,
      movements,
      load,
    };
  });
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shortlistsFor(assignment: DayAssignment, items: EquipmentRow[]): Shortlist[] {
  const profile = equipmentProfile(items);
  return assignment.pieces.map((piece, index) => {
    const random = seededRandom(hashString(`${assignment.seed}:${index}:${piece.name}`));
    return shortlistForPiece(piece, profile, assignment.avoidMovements, random);
  });
}

function userPrompt(input: {
  assignment: DayAssignment;
  shortlists: Shortlist[];
  items: EquipmentRow[];
  members: { initials: string; name: string; sex: string }[];
}): string {
  const gear = inventoryText(input.items) || "- bodyweight only";
  const roster = input.members.length ? input.members.map(memberLabel).join("; ") : "no members added";
  const avoid = input.assignment.avoidMovements.length
    ? input.assignment.avoidMovements.map((id) => movementById(id)?.name ?? id).join(", ")
    : "none";
  return `DATE: ${input.assignment.date}
ROSTER: ${roster}

OWNED EQUIPMENT (anything absent is forbidden):
${gear}

RECENTLY USED (avoid unless the piece truly needs it): ${avoid}

${assignmentPrompt(input.assignment, input.shortlists)}

Return:
{
  "title": "short, specific name",
  "stimulus": "one line on effort and pacing",
  "pieces": [
    { "movements": [{ "id": "movement-id", "reps": 10 }] }
  ]
}
Use reps, cal, meters, or seconds exactly as the shortlist lists for that movement. Set the other dose fields to null.`;
}

function client(config: ProviderConfig) {
  if (!config.apiKey) {
    throw new Error("Add AI_API_KEY to .env.local before generating. See the README for provider examples.");
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: 90_000,
  });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

async function complete(
  messages: { role: "system" | "user"; content: string }[],
  config: ProviderConfig,
  mode: JsonMode,
  temperature: number,
) {
  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    temperature,
    max_tokens: config.maxOutputTokens,
    messages,
  };
  if (config.reasoningEffort) params.reasoning_effort = config.reasoningEffort;
  if (mode === "schema") {
    params.response_format = { type: "json_schema", json_schema: { name: "Workout", schema: aiWorkoutSchema() } };
  } else if (mode === "object") {
    params.response_format = { type: "json_object" };
  }
  const response = await client(config).chat.completions.create(params);
  const content = response.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("The model returned an empty workout.");
  if (response.choices[0]?.finish_reason === "length") {
    throw new Error(
      `The workout exceeded the ${config.maxOutputTokens}-token response limit. Increase AI_MAX_OUTPUT_TOKENS or lower AI_REASONING_EFFORT.`,
    );
  }
  return content;
}

async function completeWithFallback(
  messages: { role: "system" | "user"; content: string }[],
  config: ProviderConfig,
  temperature = 0.6,
) {
  const modes = modeOrder(config.jsonMode);
  let lastError: unknown = new Error("Could not generate a workout.");
  for (const mode of modes) {
    try {
      return await complete(messages, config, mode, temperature);
    } catch (error) {
      lastError = error;
      if (!isFormatError(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function askForWorkout(input: {
  assignment: DayAssignment;
  shortlists: Shortlist[];
  items: EquipmentRow[];
  members: { initials: string; name: string; sex: string }[];
}): Promise<AiWorkout> {
  const config = resolveProvider(env);
  const profile = equipmentProfile(input.items);
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt(input) },
  ];
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = await completeWithFallback(messages, config, attempt === 0 ? 0.7 : 0.2);
    const parsed = parseAiWorkout(extractJson(content));
    if (!parsed) {
      lastIssues = ["Return the required JSON object with title, stimulus, and pieces."];
    } else {
      const issues = validateAiWorkout({
        assignment: input.assignment,
        ai: parsed,
        profile,
      });
      if (!issues.length) return parsed;
      lastIssues = issues.map((issue) => `${issue.path}: ${issue.message}`);
    }
    if (attempt === 0) {
      messages.push({
        role: "user",
        content: `Fix these issues. Do not change the scheme or piece count. Return the full corrected JSON object.\n${lastIssues.map((issue) => `- ${issue}`).join("\n")}`,
      });
    }
  }
  throw new Error(lastIssues.length ? `The coach could not produce a valid workout: ${lastIssues.join("; ")}` : "The coach could not produce a valid workout.");
}

function fallbackPlan(assignment: DayAssignment, shortlists: Shortlist[], items: EquipmentRow[]): ClassPlan {
  const random = seededRandom(assignment.seed + 17);
  return buildFallbackClass({
    assignment,
    shortlists,
    items,
    caps: equipmentProfile(items).caps,
    random,
  });
}

function savePlan(input: {
  assignment: DayAssignment;
  plan: ClassPlan;
  items: EquipmentRow[];
}) {
  const parts = input.plan.pieces.map((piece) => generatedPart(piece));
  saveGeneratedDay({
    date: input.plan.date,
    title: input.plan.title,
    stimulus: input.plan.stimulus,
    source: "programmed",
    sourceText: "",
    focus: input.plan.focus,
    format: input.plan.format,
    program: JSON.stringify({
      pattern: input.assignment.pieces[0]?.pattern ?? "none",
      movements: [...new Set(input.plan.pieces.flatMap((piece) => piece.movements.map((item) => item.id)))],
      load: input.assignment.load,
      shape: input.assignment.shape,
    }),
    snapshot: JSON.stringify(input.items.filter((item) => item.owned).map((item) => ({ slug: item.slug, quantity: item.quantity }))),
    track: {
      summary: input.plan.summary,
      warmup: input.plan.warmup,
      warmupDurationMin: input.plan.warmupDurationMin,
      prep: input.plan.prep,
      prepDurationMin: input.plan.prepDurationMin,
      cooldown: input.plan.cooldown,
      cooldownDurationMin: input.plan.cooldownDurationMin,
      parts,
    },
  });
}

function generatedPart(piece: PlannedPiece) {
  return {
    name: piece.name,
    kind: piece.kind,
    format: formatText(piece.scheme),
    details: renderPieceBody(piece),
    timeCapMin: partCapSec(piece) ? (partCapSec(piece) as number) / 60 : null,
    estimatedDurationMin: piece.estimatedDurationMin,
    scoreType: partScoreType(piece),
    repsPerRound: piece.scheme.type === "for_time" ? piece.scheme.rounds ?? null : null,
    scheme: piece.scheme,
    movements: piece.movements,
  };
}

export function rewriteIntent(value: string): string | null {
  if (value === "clarify") return "clarify";
  return FOCUSES.some((item) => item.id === value && item.id !== "rest") ? value : null;
}

export function coachNote(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
}

export function rewriteTask(intent: string, note = ""): string {
  if (intent === "clarify") {
    const ask = coachNote(note);
    const request = parseCoachRequest(ask);
    if (request.kind === "rebuild" || request.kind === "prescribe") {
      return `Build the workout this note asks for.${ask ? `\n${ask}` : ""}`;
    }
    return `Change only what the note asks for. Keep every other piece and movement.${ask ? `\n${ask}` : ""}`;
  }
  return `Rewrite this session toward ${focusLabel(intent).toLowerCase()}. Keep the same scheme when it still fits. Change movements and doses when they cannot carry that bias.`;
}

export type PrescribedMovement = { id: string; dose: Dose };

export type CoachRequest =
  | { kind: "rebuild"; shape: SessionShape; scheme?: Scheme }
  | { kind: "prescribe"; scheme: Scheme; movements: PrescribedMovement[]; vest: boolean }
  | { kind: "unknown"; phrases: string[] }
  | { kind: "edit" };

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\b(\w+)s\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function minutesIn(text: string): number {
  const before = text.match(/\b(\d+)\s*(?:min|mins|minute|minutes)\s+(?:amrap|emom|e2mom)\b/);
  if (before) return Number(before[1]);
  const after = text.match(/\b(?:amrap|emom|e2mom|every minute)\s+(\d+)\b/);
  if (after) return Number(after[1]);
  const plain = text.match(/(\d+)\s*(?:min|mins|minute|minutes)\b/);
  return plain ? Number(plain[1]) : 0;
}

function shapeFromNote(text: string): SessionShape | null {
  if (/strength\s+(?:piece\s+)?(?:and|then|\+|plus)\s+(?:a\s+)?(?:metcon|workout)|lift then|add a strength piece/.test(text)) return "strength_metcon";
  if (/\bheavy day\b|\bheavy workout\b|\bmake it heavy\b/.test(text)) return "heavy";
  if (/\bgymnastics\b|\bskill day\b|\bskill work\b/.test(text)) return "gymnastics";
  if (/\bcouplet\b|\b2 movements\b|\btwo movements\b/.test(text)) return "couplet";
  if (/\btriplet\b|\b3 movements\b|\bthree movements\b/.test(text)) return "triplet";
  if (/\b4 movements\b|\bfour movements\b/.test(text)) return "quad";
  if (/\bchipper\b|\b5 movements\b|\bfive movements\b/.test(text)) return "chipper";
  if (/\bladder\b|\b21\s*[-/]\s*15\s*[-/]\s*9\b/.test(text)) return "ladder";
  if (/\bemom\b|\be2mom\b|every minute/.test(text)) return "emom";
  if (/\bintervals?\b|\btabata\b/.test(text)) return "intervals";
  if (/\bfor time\b|\b\d+\s*rounds?\b/.test(text)) return "triplet";
  if (/\bamrap\b|as many rounds/.test(text)) return "triplet";
  return null;
}

function schemeFromNote(text: string, shape: SessionShape): Scheme | undefined {
  const minutes = minutesIn(text);
  const ladder = text.match(/(\d+)\s*[-/]\s*(\d+)\s*[-/]\s*(\d+)/);
  if (shape === "ladder" || ladder) {
    const reps = ladder ? [Number(ladder[1]), Number(ladder[2]), Number(ladder[3])] : [21, 15, 9];
    return { type: "ladder", reps, capMin: Math.max(12, minutes || 15) };
  }
  if (shape === "intervals") return { type: "emom", minutes: minutes || 16, everySec: 120 };
  if (shape === "emom") return { type: "emom", minutes: minutes || 15 };
  if (shape === "chipper") return minutes ? { type: "chipper", capMin: minutes } : undefined;
  const rounds = Number(text.match(/(\d+)\s*rounds?\b/)?.[1] ?? 0);
  if (/\bfor time\b/.test(text) || rounds > 0) {
    if (rounds > 0) return minutes ? { type: "for_time", rounds, capMin: minutes } : { type: "for_time", rounds };
    return minutes ? { type: "for_time", capMin: minutes } : { type: "for_time" };
  }
  if (/\bamrap\b|as many rounds/.test(text)) return { type: "amrap", minutes: minutes || 16 };
  return undefined;
}

const IMPLEMENT_WORDS = new Set(["barbell", "dumbbell", "kettlebell", "db", "kb"]);
const QUALIFIER_WORDS = new Set(["wall"]);
const DOSE_WORD = "calories|cals?|meters?|reps?|seconds?|secs?|minutes?|mins?";

function canonicalName(value: string): string {
  const fixed = value
    .toLowerCase()
    .replace(/dumb+ells?/g, "dumbbell")
    .replace(/kettlebel+s?/g, "kettlebell")
    .replace(/\bsnatches\b/g, "snatch");
  return normalizeName(fixed)
    .replace(/\bdumbbell\b/g, "db")
    .replace(/\bkettlebell\b/g, "kb")
    .replace(/\s+/g, " ")
    .trim();
}

function movementNamed(phrase: string): MovementDef | undefined {
  const needle = canonicalName(phrase);
  if (needle.length < 3) return undefined;
  const alias = MOVEMENT_ALIASES.find(([name]) => canonicalName(name) === needle);
  if (alias) {
    const aliased = movementById(alias[1]);
    if (aliased) return aliased;
  }
  const labels = (movement: MovementDef) => [canonicalName(movement.name), ...movement.aliases.map(canonicalName)];
  const exact = MOVEMENT_CATALOG.find((movement) => labels(movement).some((label) => label === needle));
  if (exact) return exact;
  const allowed = new Set([...IMPLEMENT_WORDS, ...QUALIFIER_WORDS]);
  const hits = MOVEMENT_CATALOG.filter((movement) =>
    labels(movement).some((label) => {
      if (label.length < 3 || !needle.includes(label)) return false;
      const leftover = needle.replace(label, " ").trim().split(" ").filter(Boolean);
      return leftover.every((word) => allowed.has(word));
    }),
  );
  const wantsBarbell = /\bbarbell\b/.test(needle);
  const wantsDumbbell = /\bdb\b/.test(needle);
  const wantsKettlebell = /\bkb\b/.test(needle);
  hits.sort((left, right) => {
    const score = (movement: MovementDef) => {
      let value = canonicalName(movement.name).length;
      if (wantsBarbell && movement.load === "barbell") value += 100;
      if (wantsDumbbell && movement.load === "dumbbell") value += 100;
      if (wantsKettlebell && movement.load === "kettlebell") value += 100;
      if (wantsBarbell && movement.load === "dumbbell") value -= 50;
      return value;
    };
    return score(right) - score(left);
  });
  return hits[0];
}

function prescriptionClock(text: string, schemeWord: "amrap" | "emom"): number | null {
  const unit = "(?:min|mins|minute|minutes)";
  const withUnit =
    text.match(new RegExp(`\\b(\\d+)\\s*${unit}\\s+${schemeWord}\\b`)) ??
    text.match(new RegExp(`\\b${schemeWord}\\s+(\\d+)\\s*${unit}\\b`));
  if (withUnit) return Number(withUnit[1]);
  const bare =
    text.match(new RegExp(`\\b${schemeWord}\\s+(\\d{1,2})\\b(?!\\s*(?:${DOSE_WORD})\\b)`)) ??
    text.match(new RegExp(`\\b(\\d{1,2})\\s+${schemeWord}\\b`));
  if (bare) return Number(bare[1]);
  const anyMinutes = text.match(/\b(\d+)\s*(?:min|mins|minute|minutes)\b/);
  return anyMinutes ? Number(anyMinutes[1]) : null;
}

function prescriptionScheme(text: string): Scheme {
  if (/\bfor time\b/.test(text)) {
    const rounds = Number(text.match(/(\d+)\s*rounds?\b/)?.[1] ?? 0);
    const minutes = prescriptionClock(text, "amrap");
    return rounds > 0 ? { type: "for_time", rounds, ...(minutes ? { capMin: minutes } : {}) } : { type: "for_time" };
  }
  if (/\bchipper\b/.test(text)) return { type: "chipper", capMin: prescriptionClock(text, "amrap") ?? 20 };
  if (/\bemom\b|\be2mom\b|every minute/.test(text)) {
    return { type: "emom", minutes: prescriptionClock(text, "emom") ?? 15 };
  }
  return { type: "amrap", minutes: prescriptionClock(text, "amrap") ?? 12 };
}

const DOSE_UNIT = `${DOSE_WORD}|m`;

function doseFromUnit(amount: number, unit: string | undefined): Dose {
  if (!unit || /rep/.test(unit)) return { reps: amount };
  if (/cal/.test(unit)) return { cal: amount };
  if (/min/.test(unit)) return { seconds: amount * 60 };
  if (/sec/.test(unit)) return { seconds: amount };
  return { meters: amount };
}

function clauseDose(body: string): { name: string; dose: Dose; explicit: boolean } | null {
  const withMinutes = body.match(/^(\d+)\s*(?:min|mins|minute|minutes)\s+(.+)$/);
  if (withMinutes) return peelTrailingUnit({ name: withMinutes[2], dose: { seconds: Number(withMinutes[1]) * 60 }, explicit: true });
  const withUnit = body.match(new RegExp(`^(\\d+)\\s*(${DOSE_UNIT})\\s+(.+)$`));
  if (withUnit) return peelTrailingUnit({ name: withUnit[3], dose: doseFromUnit(Number(withUnit[1]), withUnit[2]), explicit: true });
  const withCount = body.match(/^(\d+)\s+(.+)$/);
  if (withCount) return peelTrailingUnit({ name: withCount[2], dose: { reps: Number(withCount[1]) }, explicit: true });
  const trailing = body.match(new RegExp(`^(.+?)\\s+(?:for\\s+)?(\\d+)\\s*(${DOSE_UNIT})?$`));
  if (trailing) return peelTrailingUnit({ name: trailing[1], dose: doseFromUnit(Number(trailing[2]), trailing[3]), explicit: true });
  if (!body) return null;
  return { name: body, dose: { reps: 10 }, explicit: false };
}

function peelTrailingUnit(parsed: { name: string; dose: Dose; explicit: boolean }): { name: string; dose: Dose; explicit: boolean } {
  const match = parsed.name.match(new RegExp(`^(.*?)\\s+(${DOSE_WORD})$`));
  const name = match?.[1]?.trim() ?? "";
  if (!match || name.length < 3) return parsed;
  const amount = parsed.dose.reps ?? parsed.dose.cal ?? parsed.dose.meters ?? parsed.dose.seconds;
  if (amount == null) return parsed;
  return { name, dose: doseFromUnit(amount, match[2]), explicit: true };
}

function literalMovementId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `note-${slug || "movement"}`;
}

function explicitDose(movement: MovementDef, dose: Dose): Dose {
  if (movement.unilateral && dose.reps != null && dose.eachSide == null) return { ...dose, eachSide: false };
  return dose;
}

const FILLER = /^(?:please|make|the|workout|for|today|be|a|an|it|into|of|just|with|and|then|do|followed|by|plus|also|finish|finishing|finally|some)\b\s*/;

function prescriptionClauses(text: string): string[] {
  const stripped = text
    .replace(/\b\d+\s*(?:min|mins|minute|minutes)\s+(?:amrap|emom|e2mom)\b/g, " ")
    .replace(/\b(?:amrap|emom|e2mom)\s+\d+\s*(?:min|mins|minute|minutes)\b/g, " ")
    .replace(new RegExp(`\\b(?:amrap|emom|e2mom)\\s+\\d{1,2}\\b(?!\\s*(?:${DOSE_WORD})\\b)`, "g"), " ")
    .replace(/\b\d{1,2}\s+(?:amrap|emom|e2mom)\b/g, " ")
    .replace(/\b(?:amrap|emom|e2mom|every minute|for time|chipper|intervals?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped
    .split(/,|\.\s+(?=\d)|\bwith\s+(?:(?:a|an)\s+)?(?=\d)|\band\s+(?=\d)|\bthen\b|\bfollowed by\b|\bplus\b/)
    .map((raw) => {
      let body = raw.replace(/\s+/g, " ").trim().replace(/^[\s.,:;]+|[\s.,:;]+$/g, "");
      while (FILLER.test(body)) body = body.replace(FILLER, "");
      return body.trim();
    })
    .filter((body) => Boolean(body) && !/^\d+$/.test(body));
}

function isVestCue(body: string): boolean {
  return /^(?:weighted vest|weight vest|in a vest)$/.test(normalizeName(body));
}

function vestWorkout(text: string): boolean {
  return /\b(?:weighted vest|weight vest|in a vest)\b/.test(text);
}

function exactMovementName(name: string, movement: MovementDef): boolean {
  const needle = normalizeName(name);
  return needle === normalizeName(movement.name) || movement.aliases.some((alias) => normalizeName(alias) === needle);
}

/** Two or more named movements means the note is the workout, not a tweak. */
function parsePrescription(text: string): CoachRequest | null {
  const scheme = prescriptionScheme(text);
  const movements: PrescribedMovement[] = [];
  for (const body of prescriptionClauses(text)) {
    if (isVestCue(body)) continue;
    const parsed = clauseDose(body);
    if (!parsed) continue;
    const movement = movementNamed(parsed.name);
    if (!movement) {
      if (parsed.explicit) movements.push({ id: literalMovementId(parsed.name), dose: parsed.dose });
      continue;
    }
    if (!parsed.explicit && !exactMovementName(parsed.name, movement)) continue;
    movements.push({
      id: movement.id,
      dose: parsed.explicit ? explicitDose(movement, parsed.dose) : coachDose(movement, scheme),
    });
  }
  if (movements.length < 2) return null;
  return { kind: "prescribe", scheme, movements, vest: vestWorkout(text) };
}

/** A named workout replaces the day. Anything else is a change to one part. */
export function parseCoachRequest(note: string): CoachRequest {
  const text = coachNote(note).toLowerCase();
  if (!text) return { kind: "edit" };
  const prescription = parsePrescription(text);
  if (prescription) return prescription;
  const durationTweak = /\bmake the (?:amrap|emom|chipper|interval|intervals)\b|\b(?:shorten|lengthen) the\b/.test(text);
  const asksForNew = /\bmake it\b|\bi want\b|\bgive me\b|\bbuild\b/.test(text);
  if (durationTweak && !asksForNew) return { kind: "edit" };
  const shape = shapeFromNote(text);
  if (!shape) return { kind: "edit" };
  const scheme = schemeFromNote(text, shape);
  return scheme ? { kind: "rebuild", shape, scheme } : { kind: "rebuild", shape };
}

function ownedVersion(movement: MovementDef, profile: EquipmentProfile): MovementDef | null {
  if (movementEligible(movement, profile)) return movement;
  const stem = normalizeName(movement.name)
    .replace(/\b(dumbbell|barbell|kettlebell|db|kb)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (
    MOVEMENT_CATALOG.find((item) => {
      if (item.id === movement.id || !movementEligible(item, profile)) return false;
      const name = normalizeName(item.name)
        .replace(/\b(dumbbell|barbell|kettlebell|db|kb)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return name === stem;
    }) ?? null
  );
}

function replacement(date: string): { salt?: number; avoid: string[] } {
  const day = getDay(date);
  if (!day || day.status === "rest") return { avoid: [] };
  const avoid = [
    ...new Set(day.tracks.flatMap((track) => track.parts.flatMap((part) => part.movements?.map((item) => item.id) ?? []))),
  ];
  return { salt: Date.now(), avoid };
}

export async function generateDay(input: { date: string; focus?: string }) {
  loadEnv();
  const items = listEquipment();
  if (!items.some((item) => item.owned)) {
    throw new Error("Mark the equipment you own first. Workouts are built only from that list.");
  }
  const focus: Focus | undefined = isFocus(input.focus) ? input.focus : input.focus === "cardio" ? ("engine" as Focus) : undefined;
  const prior = replacement(input.date);
  const assignment = planDay({
    date: input.date,
    focus,
    profile: equipmentProfile(items),
    recent: recentSignals(input.date),
    salt: prior.salt,
    avoid: prior.avoid,
  });
  const plan = await composePlan(assignment, items);
  savePlan({ assignment, plan, items });
  return { title: plan.title };
}

async function composePlan(assignment: DayAssignment, items: EquipmentRow[]): Promise<ClassPlan> {
  const shortlists = shortlistsFor(assignment, items);
  try {
    const ai = await askForWorkout({
      assignment,
      shortlists,
      items,
      members: listAthletes(),
    });
    return buildClassFromAi({
      assignment,
      ai,
      items,
      caps: equipmentProfile(items).caps,
      random: seededRandom(assignment.seed + 7),
    });
  } catch {
    // A valid, original session beats a failed generation.
    return fallbackPlan(assignment, shortlists, items);
  }
}

export async function rewriteDay(input: { date: string; intent: string; note?: string }) {
  loadEnv();
  const intent = rewriteIntent(input.intent);
  if (!intent) throw new Error("Pick clarify or a workout focus.");
  const note = coachNote(input.note);
  if (intent === "clarify" && !note) throw new Error("Tell the coach what to fix.");
  const day = getDay(input.date);
  const track = day?.tracks.find((item) => item.track === "day") ?? day?.tracks[0];
  if (!day || day.status === "rest" || !track) throw new Error("There is no workout to rewrite.");

  if (intent === "clarify") {
    return clarifyDay({ day, track, note });
  }

  return generateDay({ date: input.date, focus: intent });
}

function editedScheme(note: string, kind: string, scheme: Scheme): Scheme {
  const text = note.toLowerCase();
  if (kind === "strength" && /\bheavier\b|\bmake the lift heavy\b/.test(text) && scheme.type === "strength") {
    return { ...scheme, intent: "heavy", reps: "3" };
  }
  if (kind !== "metcon") return scheme;
  const minutes = minutesIn(text);
  if (/\bmake the amrap\b|\bthe amrap\b/.test(text) && minutes) return { type: "amrap", minutes };
  if (/\bmake the emom\b|\bthe emom\b/.test(text) && minutes) return { type: "emom", minutes };
  return scheme;
}

function pieceLoad(kind: string, scheme: Scheme, note: string): "heavy" | "moderate" | "light" {
  if (kind === "strength" && (/\bheavier\b|\bmake the lift heavy\b/i.test(note) || (scheme.type === "strength" && scheme.intent === "heavy") || scheme.type === "max_load")) {
    return "heavy";
  }
  if (kind === "skill") return "light";
  return "moderate";
}

async function clarifyDay(input: { day: DayView; track: TrackView; note: string }) {
  const items = listEquipment();
  if (!items.some((item) => item.owned)) {
    throw new Error("Mark the equipment you own first. Workouts are built only from that list.");
  }
  const profile = equipmentProfile(items);
  const request = parseCoachRequest(input.note);
  if (request.kind === "unknown") {
    throw new Error(`The coach doesn't know ${request.phrases.join(", ")}.`);
  }
  if (request.kind === "prescribe") {
    const resolved: PrescribedMovement[] = [];
    for (const item of request.movements) {
      const named = movementById(item.id);
      if (!named) {
        resolved.push(item);
        continue;
      }
      const owned = ownedVersion(named, profile) ?? named;
      const dose = owned.unilateral && item.dose.reps != null && item.dose.eachSide == null ? { ...item.dose, eachSide: false } : item.dose;
      resolved.push({ id: owned.id, dose });
    }
    const defs = resolved.flatMap((item) => {
      const movement = movementById(item.id);
      return movement ? [movement] : [];
    });
    const count = resolved.length;
    const shape: SessionShape = count >= 5 ? "chipper" : count === 4 ? "quad" : count === 3 ? "triplet" : "couplet";
    const modalities = [...new Set(defs.map((movement) => movement.modality))];
    const assignment: DayAssignment = {
      date: input.day.date,
      focus: "mixed",
      shape,
      domain: "medium",
      load: "moderate",
      pieces: [
        {
          kind: "metcon",
          name: "Workout",
          scheme: request.scheme,
          pattern: defs.find((movement) => movement.pattern !== "none" && movement.pattern !== "locomotion")?.pattern ?? "squat",
          load: "moderate",
          modalities: modalities.length ? modalities : ["W", "G"],
          estimatedDurationMin: schemeMinutes(request.scheme),
          movementCount: { min: count, max: count },
        },
      ],
      brief: `METCON: ${formatText(request.scheme)}. ${count} movements.`,
      seed: hashString(`${input.day.date}:${input.note}`),
      avoidMovements: [],
      avoidPatterns: [],
      avoidDumbbell: false,
    };
    const names = defs.map((movement) => movement.name);
    const plan = buildClassFromAi({
      assignment,
      ai: {
        title: names.slice(0, 2).join(" & ") || "Workout",
        stimulus: "Hard, but repeatable. Break the grind, not the pace.",
        pieces: [{ movements: resolved }],
      },
      items,
      caps: profile.caps,
      random: seededRandom(assignment.seed + 3),
    });
    if (request.vest) {
      for (const piece of plan.pieces) piece.cue = "Weight vest";
    }
    savePlan({ assignment, plan, items });
    return { title: plan.title };
  }
  if (request.kind === "rebuild") {
    const planned = planDay({
      date: input.day.date,
      shape: request.shape,
      profile,
      recent: recentSignals(input.day.date),
      salt: hashString(`${input.day.date}:${input.note}`),
    });
    const assignment = request.scheme ? withMetconScheme(planned, request.scheme) : planned;
    const plan = await composePlan(assignment, items);
    savePlan({ assignment, plan, items });
    return { title: plan.title };
  }

  const structured = input.track.parts.filter((part) => part.scheme && part.movements?.length);
  if (structured.length === 0) {
    throw new Error("This workout was written before structured workouts. Generate it again, then clarify.");
  }

  const swap = input.note.match(/\b(?:swap|replace)\s+(?:the\s+)?(.+?)\s+(?:for|with)\s+(?:the\s+)?(.+)/i);
  const drop = input.note.match(/\b(?:drop|remove)\s+(?:the\s+)?([a-z0-9][a-z0-9 -]{1,40})/i);
  const swapTo = swap ? movementNamed(swap[2]) : undefined;
  const dropped = drop ? movementNamed(drop[1]) : undefined;
  const ownedSwap = swapTo && movementEligible(swapTo, profile) ? swapTo : undefined;

  const pieces = structured.map((part) => {
    const currentScheme = part.scheme!;
    const scheme = editedScheme(input.note, part.kind, currentScheme);
    const existing = part.movements!
      .map((item) => movementById(item.id))
      .filter((movement): movement is NonNullable<typeof movement> => Boolean(movement));
    const removed = dropped && existing.some((movement) => movement.id === dropped.id);
    const kept = removed ? existing.filter((movement) => movement.id !== dropped.id) : existing;
    const modalities = [...new Set([...(kept.length ? kept : existing).map((movement) => movement.modality), ...(ownedSwap ? [ownedSwap.modality] : [])])];
    const pattern = existing.find((movement) => movement.pattern !== "none")?.pattern ?? "none";
    const count = Math.max(1, (removed ? kept.length : part.movements!.length));
    return {
      kind: part.kind as "strength" | "metcon" | "skill",
      name: part.name,
      scheme,
      pattern,
      load: pieceLoad(part.kind, scheme, input.note),
      modalities: (modalities.length ? modalities : part.kind === "skill" ? ["G"] : ["W", "G"]) as ("W" | "G" | "M")[],
      estimatedDurationMin: schemeMinutes(scheme),
      movementCount: { min: count, max: count },
    };
  });

  const assignment: DayAssignment = {
    date: input.day.date,
    focus: (isFocus(input.day.focus) ? input.day.focus : "mixed") as Focus,
    shape: "couplet",
    domain: "medium",
    load: "moderate",
    pieces,
    brief: pieces.map((piece) => `${piece.kind}: ${formatText(piece.scheme)}`).join("\n"),
    seed: hashString(`${input.day.date}:clarify`),
    avoidMovements: [],
    avoidPatterns: [],
    avoidDumbbell: false,
  };
  const shortlists = pieces.map((piece, index) => {
    const existingIds = structured[index].movements!.map((item) => item.id).filter((id) => id !== dropped?.id);
    const available = shortlistForPiece(piece, profile, dropped ? [dropped.id] : [], seededRandom(assignment.seed + index));
    const existingMovements = existingIds.flatMap((id) => {
      const movement = movementById(id);
      return movement ? [movement] : [];
    });
    const pinned = ownedSwap && !existingMovements.some((movement) => movement.id === ownedSwap.id) ? [ownedSwap] : [];
    const movements = [...pinned, ...existingMovements, ...available.movements.filter((movement) => !existingMovements.some((item) => item.id === movement.id) && movement.id !== ownedSwap?.id)].slice(0, 18);
    const byId = new Map(available.byId);
    for (const movement of movements) byId.set(movement.id, movement);
    return { movements, byId } satisfies Shortlist;
  });

  const config = resolveProvider(env);
  const ask = [
    ownedSwap ? `Use ${ownedSwap.name} where the note asks for it.` : "",
    dropped ? `Leave out ${dropped.name}.` : "",
  ].filter(Boolean);
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Apply this coach note to the existing workout. Change only what the note asks for. Keep every other piece and movement.\n\nNOTE: ${input.note}${ask.length ? `\n${ask.join("\n")}` : ""}\n\nCURRENT WORKOUT:\n${structured
        .map((part) => `${part.name}: ${part.format}\n${part.body}`)
        .join("\n\n")}\n\n${assignmentPrompt(assignment, shortlists)}`,
    },
  ];
  let lastError = "Could not clarify the workout.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = await completeWithFallback(messages, config, attempt === 0 ? 0.4 : 0.2);
    const parsed = parseAiWorkout(extractJson(content));
    if (!parsed) {
      lastError = "The coach returned an incomplete workout.";
    } else {
      const issues = validateAiWorkout({ assignment, ai: parsed, profile });
      if (!issues.length) {
        const plan = buildClassFromAi({
          assignment,
          ai: parsed,
          items,
          caps: profile.caps,
          random: seededRandom(assignment.seed + 3),
        });
        savePlan({ assignment, plan, items });
        return { title: plan.title };
      }
      lastError = formatIssues(issues);
    }
    messages.push({ role: "user", content: `Fix these issues and return the full JSON object.\n${lastError}` });
  }
  throw new Error(lastError);
}
