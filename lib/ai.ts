import OpenAI from "openai";
import { isFormatError, modeOrder, resolveProvider, type JsonMode, type ProviderConfig } from "./ai-config";
import { FOCUSES, focusLabel } from "./athletes";
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
  type MovementPattern,
} from "./engine/movements";
import {
  assignmentPrompt,
  hashString,
  isFocus,
  planDay,
  shortlistForPiece,
  type DayAssignment,
  type Focus,
  type RecentSignal,
  type Shortlist,
} from "./engine/planner";
import { formatText, schemeMinutes, type Scheme } from "./engine/scheme";
import { formatIssues, validateAiWorkout } from "./engine/validate";

const SYSTEM_PROMPT = `You are the head coach for a small garage CrossFit gym.
The assignment already chose the scheme and the slots. You choose the title, the stimulus, and one movement per slot.

Standards:
- Use only movement IDs from that slot. Return them in slot order. Never use equipment the athlete does not own.
- Prefer the first IDs in each slot. They are the classic choices. Do not pick a variation, trick, isometric, or accessory when a staple is listed.
- Keep every dose inside the range shown. A couplet or triplet round should take about a minute. An EMOM minute should finish with rest left. A chipper is one hard pass.
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
    return `Clarify this workout. Keep the same movements and loads unless the note changes them. Do not invent a new piece.${ask ? `\nApplies only this note: ${ask}` : ""}`;
  }
  return `Rewrite this session toward ${focusLabel(intent).toLowerCase()}. Keep the same scheme when it still fits. Change movements and doses when they cannot carry that bias.`;
}

/** A clarify note can change the scheme. Keep this deterministic so score and clock stay coherent. */
function clarifyScheme(note: string, current: Scheme): Scheme {
  const text = note.toLowerCase();
  const minutes = Number(text.match(/(?:amrap|emom|every minute)[^\d]*(\d+)/)?.[1] ?? 0);
  const duration = minutes > 0 ? minutes : Math.max(6, schemeMinutes(current));
  if (/\bamrap\b|as many rounds/.test(text)) return { type: "amrap", minutes: duration };
  if (/\bemom\b|every minute/.test(text)) return { type: "emom", minutes: duration };
  if (/\bchipper\b/.test(text)) return { type: "chipper", capMin: Math.max(12, duration) };
  if (/\bintervals?\b/.test(text)) return { type: "intervals", rounds: 6, workSec: 120, restSec: 60, task: "fixed" };
  const rounds = Number(text.match(/(\d+)\s*rounds?\s*(?:for time)?/)?.[1] ?? 0);
  if (/\bfor time\b|fast as possible/.test(text)) {
    return rounds > 0 ? { type: "for_time", rounds } : { type: "for_time" };
  }
  if (/\bheavy\b/.test(text) && current.type === "strength") return { ...current, intent: "heavy" };
  return current;
}

export async function generateDay(input: { date: string; focus?: string }) {
  loadEnv();
  const items = listEquipment();
  if (!items.some((item) => item.owned)) {
    throw new Error("Mark the equipment you own first. Workouts are built only from that list.");
  }
  const focus: Focus | undefined = isFocus(input.focus) ? input.focus : input.focus === "cardio" ? ("engine" as Focus) : undefined;
  const assignment = planDay({
    date: input.date,
    focus,
    profile: equipmentProfile(items),
    recent: recentSignals(input.date),
  });
  const shortlists = shortlistsFor(assignment, items);
  let plan: ClassPlan;
  try {
    const ai = await askForWorkout({
      assignment,
      shortlists,
      items,
      members: listAthletes(),
    });
    plan = buildClassFromAi({
      assignment,
      ai,
      items,
      caps: equipmentProfile(items).caps,
      random: seededRandom(assignment.seed + 7),
    });
  } catch {
    // A valid, original session beats a failed generation.
    plan = fallbackPlan(assignment, shortlists, items);
  }
  savePlan({ assignment, plan, items });
  return { title: plan.title };
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

async function clarifyDay(input: { day: DayView; track: TrackView; note: string }) {
  const items = listEquipment();
  if (!items.some((item) => item.owned)) {
    throw new Error("Mark the equipment you own first. Workouts are built only from that list.");
  }
  const profile = equipmentProfile(items);
  const structured = input.track.parts.filter((part) => part.scheme && part.movements?.length);
  if (structured.length === 0) {
    throw new Error("This workout was written before structured workouts. Generate it again, then clarify.");
  }

  const pieces = structured.map((part) => {
    const currentScheme = part.scheme!;
    const scheme = part.kind === "metcon" ? clarifyScheme(input.note, currentScheme) : currentScheme;
    const existing = part.movements!
      .map((item) => movementById(item.id))
      .filter((movement): movement is NonNullable<typeof movement> => Boolean(movement));
    const modalities = [...new Set(existing.map((movement) => movement.modality))];
    const pattern = existing.find((movement) => movement.pattern !== "none")?.pattern ?? "none";
    return {
      kind: part.kind as "strength" | "metcon" | "skill",
      name: part.name,
      scheme,
      pattern,
      load: (/heavy|heavier/i.test(input.note) && part.kind === "strength" ? "heavy" : "moderate") as "heavy" | "moderate",
      modalities: (modalities.length ? modalities : part.kind === "skill" ? ["G"] : ["W", "G"]) as ("W" | "G" | "M")[],
      estimatedDurationMin: part.estimatedDurationMin ?? schemeMinutes(scheme),
      movementCount: { min: part.movements!.length, max: part.movements!.length },
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
    const existing = structured[index].movements!.map((item) => item.id);
    const available = shortlistForPiece(piece, profile, [], seededRandom(assignment.seed + index));
    const existingMovements = existing.flatMap((id) => {
      const movement = movementById(id);
      return movement ? [movement] : [];
    });
    return {
      movements: [
        ...existingMovements,
        ...available.movements.filter((movement) => !existingMovements.some((item) => item.id === movement.id)),
      ].slice(0, 18),
      byId: available.byId,
    } satisfies Shortlist;
  });

  const config = resolveProvider(env);
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Apply this coach note to the existing workout. Keep everything the note does not change.\n\nNOTE: ${input.note}\n\nCURRENT WORKOUT:\n${structured
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
