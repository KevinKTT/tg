import OpenAI from "openai";
import { z } from "zod";
import { isFormatError, modeOrder, resolveProvider, type JsonMode, type ProviderConfig } from "./ai-config";
import { DAY_TRACK, focusLabel, FOCUSES } from "./athletes";
import {
  getDay,
  listAthletes,
  listEquipment,
  listMovements,
  listPrs,
  bestPr,
  recentDaySignals,
  saveGeneratedDay,
  type AthleteRow,
  type DayView,
  type EquipmentRow,
  type TrackView,
} from "./db";
import { startOfWeek } from "./dates";
import { env, loadEnv } from "./env";
import { formatById, formatFromScheme, pickFormat, pieceScheme, type FormatDef } from "./formats";
import { capabilities, guardWorkout, schemeViolations, sessionDurationViolations, type ProgramCheck } from "./guard";
import { movementMenu, movementMenuPrompt } from "./movement-library";
import {
  assignmentPrompt,
  inferProgram,
  planDay,
  tagFromDraft,
  tagFromSignal,
  type Assignment,
  type ProgramTag,
} from "./program";

const scoreType = z.string().transform((value) => {
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (["time", "for_time", "fortime"].includes(normalized)) return "time" as const;
  if (["reps", "rep", "amrap", "calories", "cals"].includes(normalized)) return "reps" as const;
  if (["rounds_reps", "rounds_and_reps", "rounds"].includes(normalized)) return "rounds_reps" as const;
  if (["load", "weight", "1rm"].includes(normalized)) return "load" as const;
  if (["done", "checkbox", "check"].includes(normalized)) return "done" as const;
  return "none" as const;
});

const partSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["strength", "metcon", "skill"]).catch("metcon"),
  format: z.string().catch(""),
  details: z.string().min(1),
  timeCapMin: z.number().nullable().catch(null),
  estimatedDurationMin: z.number().int().positive(),
  scoreType,
  repsPerRound: z.number().int().positive().nullable().catch(null),
  equipment: z.array(z.string()).catch([]),
});

const daySchema = z.object({
  title: z.string().min(1),
  stimulus: z.string().min(1),
  summary: z.string().catch(""),
  warmup: z.string().min(1),
  warmupDurationMin: z.number().int().positive(),
  prep: z.string().min(1),
  prepDurationMin: z.number().int().positive(),
  parts: z.array(partSchema).min(1).max(4),
  cooldown: z.string().min(1),
  cooldownDurationMin: z.number().int().positive(),
});

const partJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "kind", "format", "details", "timeCapMin", "estimatedDurationMin", "scoreType", "repsPerRound", "equipment"],
  properties: {
    name: { type: "string" },
    kind: { type: "string", enum: ["strength", "metcon", "skill"] },
    format: { type: "string" },
    details: { type: "string" },
    timeCapMin: { anyOf: [{ type: "number" }, { type: "null" }] },
    estimatedDurationMin: { type: "integer" },
    scoreType: { type: "string", enum: ["time", "reps", "rounds_reps", "load", "done", "none"] },
    repsPerRound: { anyOf: [{ type: "integer" }, { type: "null" }] },
    equipment: { type: "array", items: { type: "string" } },
  },
};

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "stimulus", "summary", "warmup", "warmupDurationMin", "prep", "prepDurationMin", "parts", "cooldown", "cooldownDurationMin"],
  properties: {
    title: { type: "string" },
    stimulus: { type: "string" },
    summary: { type: "string" },
    warmup: { type: "string" },
    warmupDurationMin: { type: "integer" },
    prep: { type: "string" },
    prepDurationMin: { type: "integer" },
    cooldown: { type: "string" },
    cooldownDurationMin: { type: "integer" },
    parts: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: partJsonSchema,
    },
  },
};

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

function inventoryText(items: EquipmentRow[]) {
  const owned = items.filter((item) => item.owned);
  if (owned.length === 0) return "";
  return owned
    .map((item) => {
      const load = item.loadValue != null ? ` ${item.loadValue} ${item.unit}` : "";
      const count = item.kind === "item" ? "" : ` ×${item.quantity}`;
      return `- ${item.name}${load}${count} [${item.slug}]`;
    })
    .join("\n");
}

function memberLabel(member: AthleteRow): string {
  return `${member.initials} (${member.name}, ${member.sex === "f" ? "female" : "male"})`;
}

function prText(members: AthleteRow[]) {
  if (members.length === 0) return "No members added yet.";
  const movements = listMovements();
  const prs = listPrs();
  return members
    .map((member) => {
      const owned = movements
        .map((movement) => {
          const best = bestPr(prs, member.slug, movement.slug, movement.scoreKind);
          return best ? `- ${movement.name}: ${best.display}` : null;
        })
        .filter(Boolean);
      return owned.length
        ? `${memberLabel(member)}\n${owned.join("\n")}`
        : `${memberLabel(member)}\n- no PRs logged`;
    })
    .join("\n\n");
}

function loadExample(members: AthleteRow[]): string {
  const shared = "Rx — 90% of the lift\nPerformance — 70%\nLifestyle — 50%";
  const fallback =
    "If no PR exists, name the heaviest owned implement for Rx, a mid implement for Performance, and a light one for Lifestyle. Never use the lightest implement for Rx when a heavier one is owned.";
  if (members.length < 2) return `${shared}\n${fallback}`;
  const [first, second] = members;
  return `${shared}\n${fallback}\nOnly name initials when loads differ: Rx — ${first.initials} 90% / ${second.initials} 75%`;
}

function focusBrief(focus: string) {
  switch (focus) {
    case "strength":
      return "Strength bias: prioritize a primary lift with owned dumbbells. A barbell only if a bar and plates are owned.";
    case "heavy":
      return "Heavy bias: low-rep heavy lifting with the heaviest owned implements. A barbell only if a bar and plates are owned.";
    case "cardio":
    case "engine":
      return "Cardio bias: a measurable engine piece. Jump rope, running if owned, vest carries, or bodyweight cyclical work.";
    case "gymnastics":
      return "Gymnastics bias, using only owned rig pieces and bodyweight. Do not invent a pull-up bar, rings, or rope.";
    case "olympic":
      return "Power bias. Olympic lifts only if a bar and plates are owned. Otherwise heavy dumbbell or vest work that keeps the power stimulus.";
    default:
      return "Mixed bias: a classic couplet or triplet that blends strength and engine, using only owned gear.";
  }
}

function shapeBrief(focus: string, format: FormatDef) {
  if (format.id === "heavy") {
    return "Day shape: one 20-25 minute heavy strength piece only. No conditioning piece.";
  }
  if (format.id === "skill_metcon") {
    return "Day shape: an 8-10 minute skill piece (kind skill) first, then a 12-16 minute metcon (kind metcon).";
  }
  if (focus === "strength" || focus === "heavy") {
    return "Day shape: a 12-18 minute strength piece (kind strength) first, then an 8-12 minute metcon (kind metcon) in today's format.";
  }
  return "Day shape: one main piece in today's format.";
}

function systemPrompt(members: AthleteRow[]) {
  const roster = members.length ? members.map(memberLabel).join("; ") : "no members added yet";
  return `You are the head coach and programmer for "the garage", a home CrossFit gym. The members are: ${roster}.

PROGRAMMING STANDARD
- Write a realistic CrossFit class, not a random exercise circuit.
- The complete session is 40-50 minutes, including warm-up, workout prep, every workout piece, transitions, and cool-down.
- Give every section an integer estimated duration. Budget 8-12 minutes for warm-up, 5-10 for prep, 18-30 total for workout pieces, and 3-7 for cool-down. The estimates must add to 40-50 minutes. Include transitions in the neighboring section.
- Normal Rx is challenging but sustainable: moderate sets usually break, sprint pace is difficult to hold, and athletes commonly finish near the cap. Do not train to failure or max out every day.
- Vary movement combinations, rep structures, planes, unilateral work, and workout feel. Do not default to air squats, burpees, push-ups, thrusters, or basic dumbbell work unless selected for today's assignment.
- Follow the supplied movement library. For its supported equipment, use exact displayed movement names and its matched preparation. Movements using other owned equipment are still allowed.

WHITEBOARD STYLE
One glance. Movement lines, doses, and loads only. No coaching paragraphs or technique cues.

Name: a fun name tied to the work. Not generic.
Stimulus: the time domain only. Example: "about 8-12 min".

Lines start with "- ", then reps, then the movement. No cues. No weights on the line.
Same movement and reps for every scale: one line, no label. Never label a scale that matches Rx. Never write "(Rx) / (Performance) / (Lifestyle)" on one line.
A scale that changes the movement or reps: the Rx line, then only the scales that differ.
Loads live in "summary" only. "Equipment:" then the pieces used. Then "Loads:" and one line per scale:
${loadExample(members)}
Heavy-day Rx is 85-95% of a PR or the heaviest owned implement. Conditioning Rx is generally 70-80% of a PR or the upper half of owned implements. Performance is about 75% of Rx. Lifestyle is about 55%, fewer reps, or the library's easier movement. Never invent a weight or vest poundage. Never Rx the lightest owned implement when a heavier one exists. Write "weighted vest".
Owned gear only. Bodyweight is always allowed. If a classic piece needs missing gear, substitute.

Class order: warmup, prep, parts, cooldown.
Warm-up is 6-8 lines: one general raise, 1-2 activation drills, and 2-3 dynamic mobility drills, with useful doses. Prep is 3-5 lines that rehearse and ramp the exact workout movements. Cool-down is 3-5 matched mobility/stretch/breathing lines. Never put the workout's scheme, AMRAP, EMOM, round count, or cap in these sections.
Each scored part "format" is the full scheme with its number: "5 rounds for time", "AMRAP 12", "EMOM 12", "21-15-9". The label alone is invalid. Do not restate the scheme in details.
EMOM and intervals are scoreType done with timeCapMin null. AMRAP is rounds_reps, no cap. For time is time. A cap only if the scheme says cap. Heavy is load. Skill is none.
Follow the assignment. Do not add a piece it does not ask for. Do not reuse a banned movement.

Return one JSON object with title, stimulus, summary, warmup, warmupDurationMin, prep, prepDurationMin, parts, cooldown, and cooldownDurationMin.
Each part has name, kind (strength, metcon, or skill), format, details, timeCapMin, estimatedDurationMin, scoreType, repsPerRound, and equipment.`;
}

function userPrompt(input: {
  date: string;
  items: EquipmentRow[];
  members: AthleteRow[];
  assignment: Assignment;
  library: string;
  violations?: string[];
}) {
  const retry = input.violations?.length
    ? `\n\nThe previous draft was rejected:\n${input.violations.map((item) => `- ${item}`).join("\n")}\nFix every rejection. Do not use equipment that is not owned. Obey the assignment and the bans.`
    : "";
  return `Program one CrossFit workout for ${input.date}. Write it as a whiteboard: short lines, no coaching notes.

${assignmentPrompt(input.assignment)}

${input.library}

OWNED EQUIPMENT (anything absent is forbidden):
${inventoryText(input.items)}

CURRENT PRS:
${prText(input.members)}
${retry}`;
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
  temperature = 0.6,
) {
  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    temperature,
    max_tokens: config.maxOutputTokens,
    messages,
  };
  if (config.reasoningEffort) params.reasoning_effort = config.reasoningEffort;
  if (mode === "schema") {
    params.response_format = { type: "json_schema", json_schema: { name: "WorkoutDay", schema: jsonSchema } };
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

const ownedError = "Mark the equipment you own first. Workouts are built only from that list.";

function ownedSnapshot(items: EquipmentRow[]) {
  return JSON.stringify(items.filter((item) => item.owned).map((item) => ({ slug: item.slug, quantity: item.quantity })));
}

function programHistory(date: string) {
  const weekStart = startOfWeek(date);
  const tagged = recentDaySignals(date).map((row) => ({ date: row.date, tag: tagFromSignal(row) }));
  return {
    recent: tagged.map((item) => item.tag),
    week: tagged.filter((item) => item.date >= weekStart).map((item) => item.tag),
  };
}

function checkFor(tag: ProgramTag): ProgramCheck {
  return {
    load: tag.load,
    allowRun: tag.mono === "run",
    allowHeavy: tag.load === "heavy",
  };
}

function describeSchemaError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "workout";
      if (issue.code === "too_small") {
        return issue.origin === "string" ? `${path} must not be empty` : `${path} must be greater than 0`;
      }
      if (issue.code === "invalid_type") return `${path} is missing or the wrong type`;
      return `${path}: ${issue.message}`;
    });
    return [...new Set(issues)].slice(0, 8).join("; ");
  }
  return error instanceof Error ? error.message : "Could not read the workout.";
}

async function draftDay(input: {
  date: string;
  focus: string;
  formatId: string;
  program?: ProgramTag;
  check?: ProgramCheck;
  sourceText: string;
  items: EquipmentRow[];
  messages: { role: "system" | "user"; content: string }[];
  temperature?: number;
  rejected: (violations: string[]) => string;
  invalid: (error: string) => string;
}) {
  const config = resolveProvider(env);
  let lastError = "Could not generate a workout.";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let content = "";
    try {
      content = await completeWithFallback(input.messages, config, input.temperature);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "The AI provider request failed.";
      break;
    }
    try {
      const parsed = daySchema.parse(extractJson(content));
      const violations = [
        ...guardWorkout(
          {
            day: {
              summary: parsed.summary,
              warmup: parsed.warmup,
              prep: parsed.prep,
              cooldown: parsed.cooldown,
              parts: parsed.parts.map((part) => ({
                name: part.name,
                details: part.details,
                equipment: part.equipment,
              })),
            },
          },
          input.items,
          input.check,
        ),
        ...schemeViolations({
          warmup: parsed.warmup,
          prep: parsed.prep,
          cooldown: parsed.cooldown,
          parts: parsed.parts,
        }),
        ...sessionDurationViolations({
          warmupDurationMin: parsed.warmupDurationMin,
          prepDurationMin: parsed.prepDurationMin,
          cooldownDurationMin: parsed.cooldownDurationMin,
          parts: parsed.parts,
        }),
      ];
      if (violations.length) {
        lastError = violations.slice(0, 6).join(" ");
        input.messages.push({ role: "user", content: input.rejected(violations) });
        continue;
      }
      const written = parsed.parts.map((part) => `${part.name}\n${part.details}`).join("\n");
      const nextFormat = clarifyFormat(input.sourceText, input.formatId, parsed.parts);
      const tag = tagFromDraft(
        input.program ?? inferProgram({ focus: input.focus, format: nextFormat, text: written, stimulus: parsed.stimulus }),
        written,
      );
      saveGeneratedDay({
        date: input.date,
        title: parsed.title,
        stimulus: parsed.stimulus,
        source: "programmed",
        sourceText: input.sourceText,
        focus: input.focus,
        format: nextFormat,
        program: JSON.stringify(tag),
        snapshot: ownedSnapshot(input.items),
        track: {
          summary: parsed.summary,
          warmup: parsed.warmup,
          warmupDurationMin: parsed.warmupDurationMin,
          prep: parsed.prep,
          prepDurationMin: parsed.prepDurationMin,
          cooldown: parsed.cooldown,
          cooldownDurationMin: parsed.cooldownDurationMin,
          parts: parsed.parts.map((part) => {
            const scheme = pieceScheme(part.format, nextFormat, part.kind);
            return {
              name: part.name,
              kind: part.kind,
              format: part.format,
              details: part.details,
              timeCapMin: scheme && !scheme.allowCap ? null : part.timeCapMin,
              estimatedDurationMin: part.estimatedDurationMin,
              scoreType: scheme?.scoreType ?? part.scoreType,
              repsPerRound: part.repsPerRound,
            };
          }),
        },
      });
      return { title: parsed.title };
    } catch (error) {
      const readable = describeSchemaError(error);
      lastError =
        error instanceof z.ZodError
          ? `The coach returned an incomplete workout (${readable}). Try again.`
          : readable;
      input.messages.push({ role: "user", content: input.invalid(readable) });
    }
  }
  throw new Error(lastError);
}

export function rewriteIntent(value: string): string | null {
  if (value === "clarify") return "clarify";
  return FOCUSES.some((item) => item.id === value && item.id !== "rest") ? value : null;
}

export function coachNote(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
}

function clarifyFormat(
  sourceText: string,
  formatId: string,
  parts: { kind: string; name: string; format: string; scoreType: string }[],
) {
  if (!sourceText.startsWith("rewrite:clarify")) return formatId;
  const metcon =
    parts.find((part) => part.kind === "metcon" && !/warm-?up|workout prep|cool-?down/i.test(part.name)) ??
    parts.find((part) => part.scoreType !== "none");
  return formatFromScheme(metcon?.format ?? "") ?? formatId;
}

export function rewriteTask(intent: string, note = ""): string {
  if (intent === "clarify") {
    const ask = coachNote(note);
    const asked = ask ? `\nApply this note, and only this note: ${ask}` : "";
    return `Clarify this workout. Keep the same movements and loads unless the note changes them. Do not invent a new piece.${asked}\nIf the note changes the scheme, update that part's format, scoreType, and timeCapMin together. Otherwise keep the scheme and fix only what the note asks.`;
  }
  return `Rewrite this session toward ${focusLabel(intent).toLowerCase()}. Keep it a rewrite of this workout when the movements can carry that bias. Change movements, reps, and format only when they cannot. Do not write an unrelated workout.\n${focusBrief(intent)}`;
}

function workoutText(day: DayView, track: TrackView) {
  const pieces = track.parts
    .map((part) => {
      const meta = [
        part.kind,
        part.format,
        part.scoreType !== "none" ? `score ${part.scoreType}` : "",
        part.timeCapSec ? `cap ${Math.round(part.timeCapSec / 60)} min` : "",
        part.estimatedDurationMin ? `estimated ${part.estimatedDurationMin} min` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `${part.name} (${meta})\n${part.body}`;
    })
    .join("\n\n");
  return `Title: ${day.title}
Stimulus: ${day.stimulus || "none"}
Focus: ${day.focus || "mixed"}
Format: ${day.format || "unspecified"}
Summary:
${track.summary || "none"}

${pieces}`;
}

function rewritePrompt(input: {
  date: string;
  intent: string;
  source: string;
  focus: string;
  format: FormatDef;
  items: EquipmentRow[];
  members: AthleteRow[];
  library: string;
  note?: string;
  violations?: string[];
}) {
  const clarify = input.intent === "clarify";
  const ask = coachNote(input.note);
  const formatBlock = clarify
    ? `Keep each part's scheme unless the note changes it. If the note changes the scheme, write the full scheme with its count in "format", and set scoreType and timeCapMin to match. Warm-up, prep, and cool-down never carry a scheme or a clock.`
    : `TODAY'S FORMAT: ${input.format.label}
${input.format.brief}
- The main workout's "format" field is a complete scheme in this style, including the count. Not the label alone.
${shapeBrief(input.focus, input.format)}`;
  const retry = input.violations?.length
    ? `\n\nThe previous draft was rejected:\n${input.violations.map((item) => `- ${item}`).join("\n")}\nFix every rejection. Do not use equipment that is not owned.`
    : "";
  const noted = ask ? `\n\nCOACH NOTE (do this, keep the rest): ${ask}` : "";
  return `${rewriteTask(input.intent, ask)}

CURRENT WORKOUT:
${input.source}

${formatBlock}

${input.library}

OWNED EQUIPMENT (anything absent is forbidden):
${inventoryText(input.items)}

CURRENT PRS:
${prText(input.members)}${noted}${retry}`;
}

export async function generateDay(input: { date: string; focus?: string }) {
  loadEnv();
  const items = listEquipment();
  if (!items.some((item) => item.owned)) throw new Error(ownedError);

  const members = listAthletes();
  const history = programHistory(input.date);
  const bias = input.focus && input.focus !== "auto" ? input.focus : undefined;
  const assignment = planDay({
    bias,
    caps: capabilities(items),
    recent: history.recent,
    week: history.week,
  });
  const menu = movementMenu({
    items,
    pattern: assignment.tag.pattern,
    mono: assignment.tag.mono,
  });
  const library = movementMenuPrompt(menu);
  const prompt = (violations?: string[]) => userPrompt({ date: input.date, items, members, assignment, library, violations });
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt(members) },
    { role: "user", content: prompt() },
  ];
  return draftDay({
    date: input.date,
    focus: assignment.focus,
    formatId: assignment.tag.format,
    program: assignment.tag,
    check: checkFor(assignment.tag),
    sourceText: "",
    items,
    messages,
    rejected: (violations) => prompt(violations),
    invalid: (error) =>
      `That response was invalid (${error}). Return one JSON object for a complete 40-50 minute session. Every section (warmup, prep, cooldown) and every part needs non-empty text and a duration greater than 0. One movement per line. No paragraphs.`,
  });
}

export async function rewriteDay(input: { date: string; intent: string; note?: string }) {
  loadEnv();
  const intent = rewriteIntent(input.intent);
  if (!intent) throw new Error("Pick clarify or a workout focus.");
  const note = coachNote(input.note);
  if (intent === "clarify" && !note) throw new Error("Tell the coach what to fix.");
  const day = getDay(input.date);
  const track = day?.tracks.find((item) => item.track === DAY_TRACK) ?? day?.tracks[0];
  if (!day || day.status === "rest" || !track) throw new Error("There is no workout to rewrite.");

  const items = listEquipment();
  if (!items.some((item) => item.owned)) throw new Error(ownedError);

  const members = listAthletes();
  const clarify = intent === "clarify";
  const history = programHistory(input.date);
  const yesterday = history.recent[0];
  const focus = clarify ? (day.focus && day.focus !== "rest" ? day.focus : "mixed") : intent;
  const picked = clarify ? formatById(day.format) : pickFormat(focus, capabilities(items), []);
  const format: FormatDef = picked ?? {
    id: "for_time",
    label: day.format || "the scheme already on the board",
    brief: "Keep the scheme already written on the board.",
    focuses: [],
  };
  const source = workoutText(day, track);
  const sourceProgram = inferProgram({ focus, format: day.format, text: source, stimulus: day.stimulus });
  const library = movementMenuPrompt(
    movementMenu({
      items,
      pattern: sourceProgram.pattern,
      mono: sourceProgram.mono,
    }),
  );
  const prompt = (violations?: string[]) =>
    rewritePrompt({ date: input.date, intent, source, focus, format, items, members, library, note, violations });
  const check: ProgramCheck | undefined = clarify
    ? undefined
    : {
        load: intent === "heavy" && yesterday?.load !== "heavy" ? "heavy" : "moderate",
        allowRun: !(yesterday && (yesterday.mono === "run" || yesterday.movements.includes("run"))),
        allowHeavy: yesterday?.load !== "heavy",
      };
  const messages: { role: "system" | "user"; content: string }[] = [
    {
      role: "system",
      content: `${systemPrompt(members)}\n\nREWRITE:\nThis is a rewrite of the workout already on the board, not a new day. You may keep this workout's movements. Follow the rewrite instructions over the naming rules. On a clarify, the coach note wins over the current scheme.`,
    },
    { role: "user", content: prompt() },
  ];
  return draftDay({
    date: input.date,
    focus,
    formatId: clarify ? day.format : format.id,
    check,
    sourceText: `rewrite:${intent}`,
    items,
    messages,
    temperature: clarify ? 0.3 : 0.6,
    rejected: (violations) => prompt(violations),
    invalid: (error) =>
      `That response was invalid (${error}). Return one JSON object. Every section (warmup, prep, cooldown) and every part needs non-empty text and a duration greater than 0. ${rewriteTask(intent, note)}`,
  });
}
