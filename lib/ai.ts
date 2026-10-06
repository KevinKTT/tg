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
  recentFormats,
  saveGeneratedDay,
  type AthleteRow,
  type DayView,
  type EquipmentRow,
  type TrackView,
} from "./db";
import { startOfWeek } from "./dates";
import { env, loadEnv } from "./env";
import { formatById, pickFormat, type FormatDef } from "./formats";
import { capabilities, guardWorkout, type ProgramCheck } from "./guard";
import {
  assignmentPrompt,
  inferProgram,
  neighborBans,
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
  return "none" as const;
});

const partSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["strength", "metcon", "skill"]).catch("metcon"),
  format: z.string().catch(""),
  details: z.string().min(1),
  timeCapMin: z.number().nullable().catch(null),
  scoreType,
  repsPerRound: z.number().int().positive().nullable().catch(null),
  equipment: z.array(z.string()).catch([]),
});

const daySchema = z.object({
  title: z.string().min(1),
  stimulus: z.string().min(1),
  summary: z.string().catch(""),
  warmup: z.string().min(1),
  prep: z.string().min(1),
  parts: z.array(partSchema).min(1).max(4),
  cooldown: z.string().min(1),
});

const partJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "kind", "format", "details", "timeCapMin", "scoreType", "repsPerRound", "equipment"],
  properties: {
    name: { type: "string" },
    kind: { type: "string", enum: ["strength", "metcon", "skill"] },
    format: { type: "string" },
    details: { type: "string" },
    timeCapMin: { anyOf: [{ type: "number" }, { type: "null" }] },
    scoreType: { type: "string", enum: ["time", "reps", "rounds_reps", "load", "none"] },
    repsPerRound: { anyOf: [{ type: "integer" }, { type: "null" }] },
    equipment: { type: "array", items: { type: "string" } },
  },
};

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "stimulus", "summary", "warmup", "prep", "parts", "cooldown"],
  properties: {
    title: { type: "string" },
    stimulus: { type: "string" },
    summary: { type: "string" },
    warmup: { type: "string" },
    prep: { type: "string" },
    cooldown: { type: "string" },
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
    return "Day shape: one heavy strength piece only. No conditioning piece.";
  }
  if (format.id === "skill_metcon") {
    return "Day shape: a skill piece (kind skill) first, then a brief metcon (kind metcon).";
  }
  if (focus === "strength" || focus === "heavy") {
    return "Day shape: a strength piece (kind strength) first, then a short metcon (kind metcon) in today's format.";
  }
  return "Day shape: one main piece in today's format.";
}

function systemPrompt(members: AthleteRow[]) {
  const roster = members.length
    ? members.map(memberLabel).join("; ")
    : "no members added yet";
  return `You are the coach for "the garage", a home CrossFit gym. The members are: ${roster}.

Write the workout like a class whiteboard. A person mid-workout should read it in one glance on a phone or a TV. List the work and the loads. No coaching essay.

NAME:
- Give the workout a fun, funny, clever name. Puns, wordplay, alliteration, and pop-culture riffs are great. Tie it to the day's movements or theme. Never use a generic name.

STIMULUS:
- One short line, the time domain only. Example: "about 8-12 min".
- No coaching. No "target:". No explanation of the piece.

SCALING:
- Rx is the workout a good athlete might fail or get time-capped on. It is not a casual session.
- Strength: Rx is 85-95% of a logged PR for that lift, sets of 1-5. If no PR exists, Rx is the heaviest owned implement at RPE 9. Never invent a 1RM.
- Metcon: Rx loads come from the top of the owned implements, or 70-80% of a PR when one exists. Reps are dense enough that sets break.
- Performance is about 75% of the Rx load, or fewer reps. It should be finishable.
- Lifestyle is about 55% of the Rx load, or an easier movement. It should always be finishable.
- If the movement and the reps are the same for every scale, write the line once. No label.
- If a scale changes the movement or the reps, write the Rx line, then only the scales that differ, each on its own line:
  - 20 Double-unders
  - Performance: 40 Single-unders
  - Lifestyle: 20 Single-unders
- Never write "(Rx) / (Performance) / (Lifestyle)" on one line.
- Never label a scale that matches Rx.
- Do not put weights on movement lines.
- Do not prescribe the lightest dumbbell or kettlebell for Rx when a heavier one is owned.

MOVEMENT LINES:
- One item per line, each line starting with "- ".
- Reps, then the movement: "- 10 Dumbbell deadlifts".
- No paragraphs. No cues. No "focus on". No "quality over quantity". No breathing scripts. No "rest the remainder of each minute".
- A complex piece can have many lines. Each line stays short.
- Warm-up: 4-6 lines. Prep: 2-4 lines. Cool-down: 3-5 stretch names. Never a minute-by-minute script.

EQUIPMENT & LOADS (the "summary" field):
- Put equipment and loads in "summary", never in the movement lines.
- First line: "Equipment:" then each piece once, comma separated. Only what the workout uses. No parenthetical essays.
- Then "Loads:" and one line per scale that has a load:
  ${loadExample(members)}
- Only include the loads that matter. Never invent a weight that is not owned.

EQUIPMENT RULES:
- Bodyweight is always allowed. Use ONLY equipment in the owned list. Never invent a machine, barbell, bell, plate, box, rig, or load that is not listed.
- If a classic piece needs missing equipment, substitute a movement that keeps the stimulus with owned gear.
- The weight vest has no listed poundage. Write "weighted vest". Never invent a vest weight.

STRUCTURE — a real class, always in this order:
- Warm-up: short, general, movement and reps only, using only owned gear.
- Workout prep: a few light reps of the main movements. Never scored.
- Workout: the main piece, in the format given below. Put the scheme in the part "format" field ("5 rounds for time", "AMRAP 12", "21-15-9"). Do not restate it as a paragraph in details.
- Cool-down: stretch names only.
- On a strength or heavy piece, if a PR exists for that lift, Rx is 85-95% of it. If no PR exists, Rx is the heaviest owned implement at RPE 9. Never invent a 1RM.
- The main workout must be scored with scoreType time, reps, rounds_reps, or load, unless it is a skill piece.
- Program real CrossFit: constantly varied functional movements, measurable, intense.

ASSIGNMENT:
- Follow today's assignment exactly. It already decided the shape, load, time domain, and pattern.
- You are not shown previous workouts. Do not reuse a banned movement or invent a day from memory.
- A day can be a single piece. Do not add a metcon, a lift, or a run unless the assignment asks for it.

Return one JSON object with title, stimulus, summary, warmup, prep, parts, and cooldown.
Each part has name, kind (strength, metcon, or skill), format, details, timeCapMin, scoreType, repsPerRound, and equipment.`;
}

function userPrompt(input: {
  date: string;
  items: EquipmentRow[];
  members: AthleteRow[];
  assignment: Assignment;
  violations?: string[];
}) {
  const retry = input.violations?.length
    ? `\n\nThe previous draft was rejected:\n${input.violations.map((item) => `- ${item}`).join("\n")}\nFix every rejection. Do not use equipment that is not owned. Obey the assignment and the bans.`
    : "";
  return `Program one CrossFit workout for ${input.date}. Write it as a whiteboard: short lines, no coaching notes.

${assignmentPrompt(input.assignment)}

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
    max_tokens: 1600,
    messages,
  };
  if (config.reasoningEffort) params.reasoning_effort = config.reasoningEffort;
  if (mode === "schema") {
    params.response_format = { type: "json_schema", json_schema: { name: "WorkoutDay", schema: jsonSchema } };
  } else if (mode === "object") {
    params.response_format = { type: "json_object" };
  }
  const response = await client(config).chat.completions.create(params);
  const message = response.choices[0]?.message as
    | (OpenAI.Chat.ChatCompletionMessage & { reasoning_content?: string | null })
    | undefined;
  const content = message?.content?.trim() || message?.reasoning_content?.trim() || "";
  if (!content) throw new Error("The model returned an empty workout.");
  if (response.choices[0]?.finish_reason === "length") {
    throw new Error("The workout was cut off. Try again.");
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

function checkFor(tag: ProgramTag, bannedMovements: string[]): ProgramCheck {
  return {
    load: tag.load,
    allowRun: tag.mono === "run",
    allowHeavy: tag.load === "heavy",
    bannedMovements,
  };
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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let content = "";
    try {
      content = await completeWithFallback(input.messages, config, input.temperature);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "The AI provider request failed.";
      break;
    }
    try {
      const parsed = daySchema.parse(extractJson(content));
      const violations = guardWorkout(
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
      );
      if (violations.length) {
        lastError = violations.slice(0, 6).join(" ");
        input.messages.push({ role: "user", content: input.rejected(violations) });
        continue;
      }
      const written = parsed.parts.map((part) => `${part.name}\n${part.details}`).join("\n");
      const tag = tagFromDraft(
        input.program ?? inferProgram({ focus: input.focus, format: input.formatId, text: written, stimulus: parsed.stimulus }),
        written,
      );
      saveGeneratedDay({
        date: input.date,
        title: parsed.title,
        stimulus: parsed.stimulus,
        source: "programmed",
        sourceText: input.sourceText,
        focus: input.focus,
        format: input.formatId,
        program: JSON.stringify(tag),
        snapshot: ownedSnapshot(input.items),
        track: {
          summary: parsed.summary,
          warmup: parsed.warmup,
          prep: parsed.prep,
          cooldown: parsed.cooldown,
          parts: parsed.parts.map((part) => ({
            name: part.name,
            kind: part.kind,
            format: part.format,
            details: part.details,
            timeCapMin: part.timeCapMin,
            scoreType: part.scoreType,
            repsPerRound: part.repsPerRound,
          })),
        },
      });
      return { title: parsed.title };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Could not read the workout.";
      input.messages.push({ role: "user", content: input.invalid(lastError) });
    }
  }
  throw new Error(lastError);
}

export function rewriteIntent(value: string): string | null {
  if (value === "clarify") return "clarify";
  return FOCUSES.some((item) => item.id === value && item.id !== "rest") ? value : null;
}

export function rewriteTask(intent: string): string {
  if (intent === "clarify") {
    return "Clarify this workout so a person can follow it in one glance. Keep the same movements, loads, and intended scheme. Do not invent a new piece or a new stimulus. Fix only lines that are confusing, contradictory, or impossible to follow. If a line is already clear, leave it. Keep the title unless it does not match the work.";
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
  bans?: string;
  violations?: string[];
}) {
  const clarify = input.intent === "clarify";
  const formatBlock = clarify
    ? `Keep today's format (${input.format.label}). Copy each part "format" field from the current workout. Do not change the scheme.`
    : `TODAY'S FORMAT: ${input.format.label}
${input.format.brief}
- Lead the main workout's "format" field with the exact words "${input.format.label}".
${shapeBrief(input.focus, input.format)}`;
  const retry = input.violations?.length
    ? `\n\nThe previous draft was rejected:\n${input.violations.map((item) => `- ${item}`).join("\n")}\nFix every rejection. Do not use equipment that is not owned.`
    : "";
  return `${rewriteTask(input.intent)}

CURRENT WORKOUT:
${input.source}

${formatBlock}

OWNED EQUIPMENT (anything absent is forbidden):
${inventoryText(input.items)}

CURRENT PRS:
${prText(input.members)}${clarify ? "" : input.bans || ""}${retry}`;
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
  const prompt = (violations?: string[]) => userPrompt({ date: input.date, items, members, assignment, violations });
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt(members) },
    { role: "user", content: prompt() },
  ];
  return draftDay({
    date: input.date,
    focus: assignment.focus,
    formatId: assignment.tag.format,
    program: assignment.tag,
    check: checkFor(assignment.tag, assignment.bannedMovements),
    sourceText: "",
    items,
    messages,
    rejected: (violations) => prompt(violations),
    invalid: (error) =>
      `That response was invalid (${error}). Return one JSON object with a short warm-up, a short workout prep, a scored piece, and a short cool-down. One movement per line. No paragraphs.`,
  });
}

export async function rewriteDay(input: { date: string; intent: string }) {
  loadEnv();
  const intent = rewriteIntent(input.intent);
  if (!intent) throw new Error("Pick clarify or a workout focus.");
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
  const avoided = recentFormats(input.date);
  if (!clarify && yesterday?.load === "heavy" && !avoided.includes("heavy")) avoided.push("heavy");
  const picked = clarify ? formatById(day.format) : pickFormat(focus, capabilities(items), avoided);
  const format: FormatDef = picked ?? {
    id: "for_time",
    label: day.format || "the scheme already on the board",
    brief: "Keep the scheme already written on the board.",
    focuses: [],
  };
  const source = workoutText(day, track);
  const bans = clarify ? "" : neighborBans(yesterday);
  const prompt = (violations?: string[]) =>
    rewritePrompt({ date: input.date, intent, source, focus, format, items, members, bans, violations });
  const check: ProgramCheck | undefined = clarify
    ? undefined
    : {
        load: intent === "heavy" && yesterday?.load !== "heavy" ? "heavy" : "moderate",
        allowRun: !(yesterday && (yesterday.mono === "run" || yesterday.movements.includes("run"))),
        allowHeavy: yesterday?.load !== "heavy",
        bannedMovements: yesterday?.movements ?? [],
      };
  const messages: { role: "system" | "user"; content: string }[] = [
    {
      role: "system",
      content: `${systemPrompt(members)}\n\nREWRITE:\nThis is a rewrite of the workout already on the board, not a new day. You may keep this workout's movements. Obey neighbor bans over the rewrite focus. Follow the rewrite instructions over the naming rules.`,
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
    invalid: (error) => `That response was invalid (${error}). Return one JSON object. ${rewriteTask(intent)}`,
  });
}
