import OpenAI from "openai";
import { z } from "zod";
import { isFormatError, modeOrder, resolveProvider, type JsonMode, type ProviderConfig } from "./ai-config";
import {
  listAthletes,
  listEquipment,
  listMovements,
  listPrs,
  bestPr,
  recentFormats,
  recentWorkoutDetails,
  saveGeneratedDay,
  type AthleteRow,
  type EquipmentRow,
} from "./db";
import { env, loadEnv } from "./env";
import { pickFormat, type FormatDef } from "./formats";
import { capabilities, guardWorkout } from "./guard";

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
  if (members.length === 0) {
    return '"Loads: Rx — 25 lb · Performance — 20 lb · Lifestyle — 15 lb"';
  }
  const tier = (weight: number) => members.map((member) => `${member.initials} ${weight} lb`).join(" / ");
  return `"Loads: Rx — ${tier(25)} · Performance — ${tier(20)} · Lifestyle — ${tier(15)}"`;
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

NAME:
- Give the workout a fun, funny, clever name. Puns, wordplay, alliteration, and pop-culture riffs are great. Tie it to the day's movements or theme. Never use a generic name.

SCALING — choose a real version of each movement for each category, then show them on one bullet:
- Rx is the hardest, Lifestyle is the easiest, Performance sits in between.
- Label each version, e.g. "- 20 double-unders (Rx) / 40 single-unders (Performance) / 20 single-unders (Lifestyle)".
- Change something real between categories: the movement (double-unders vs single-unders), the reps, or both.
- If a movement and its reps are exactly the same for all three categories, write it once with NO label. Never add empty or identical labels.
- There is no switch; every option is visible right in the list.

BULLET FORMAT — THIS IS CRITICAL:
- Write every list as bullet points, one item per line, each line starting with "- ".
- Applies to the warm-up, the workout prep, every workout piece, and the cool-down. Never write a paragraph.
- Keep each bullet short and scannable, like a whiteboard: movement and reps only.
- Do NOT put weights or equipment in the bullet lines.

EQUIPMENT & LOADS (the "summary" field):
- Put the equipment and the loads in "summary", never in the movement lines.
- First line: "Equipment:" then each piece once, comma separated. Only what the workout uses.
- Second line: "Loads:" then one entry per category listing every member's load by their initials, e.g.
  ${loadExample(members)}.
- Only include the loads that matter. Never invent a weight that is not owned.

EQUIPMENT RULES:
- Bodyweight is always allowed. Use ONLY equipment in the owned list. Never invent a machine, barbell, bell, plate, box, rig, or load that is not listed.
- If a classic piece needs missing equipment, substitute a movement that keeps the stimulus with owned gear.
- The weight vest has no listed poundage. Write "weighted vest". Never invent a vest weight.

STRUCTURE — a real class, always in this order:
- Warm-up (8-12 min): general, movement and reps only, using only owned gear.
- Workout prep (3-6 min): a short, light rehearsal of the main workout's exact movements. Fewer reps, empty bar or the lightest owned load, technique focus. It is never scored.
- Workout: the main piece, in the format given below.
- Cool-down (5-8 min): stretches.
- If a PR exists, you may prescribe a percentage of it. If no PR exists, prescribe RPE and an owned implement. Never invent a 1RM.
- The main workout must be scored with scoreType time, reps, rounds_reps, or load, unless it is a skill piece.
- Program real CrossFit: constantly varied functional movements, measurable, intense, with a clear stimulus.

VARIETY:
- Never repeat the most recent day's primary movement. If yesterday was a 5x5 back squat strength piece, do not program back squats today.
- Reusing the same equipment is encouraged. Repeating the same movements is not.
- Do not repeat a benchmark workout (Fran, Murph, etc.) that appears in the recent list.

Return one JSON object with title, stimulus, summary, warmup, prep, parts, and cooldown.
Each part has name, kind (strength, metcon, or skill), format, details, timeCapMin, scoreType, repsPerRound, and equipment.`;
}

function userPrompt(input: {
  date: string;
  focus: string;
  items: EquipmentRow[];
  members: AthleteRow[];
  format: FormatDef;
  violations?: string[];
}) {
  const recent = recentWorkoutDetails(input.date, 3)
    .map((day) => `- ${day.date} [${day.focus || "mixed"}] ${day.title}: ${day.details || day.stimulus}`)
    .join("\n");
  const task = `Program one CrossFit workout for ${input.date}.\n${focusBrief(input.focus)}`;
  const formatBlock = `TODAY'S FORMAT: ${input.format.label}
${input.format.brief}
- Lead the main workout's "format" field with the exact words "${input.format.label}".
${shapeBrief(input.focus, input.format)}`;
  const retry = input.violations?.length
    ? `\n\nThe previous draft was rejected:\n${input.violations.map((item) => `- ${item}`).join("\n")}\nFix every rejection. Do not use equipment that is not owned.`
    : "";
  return `${task}

${formatBlock}

OWNED EQUIPMENT (anything absent is forbidden):
${inventoryText(input.items)}

CURRENT PRS:
${prText(input.members)}

RECENT WORKOUTS (do not repeat the main movements, format, or stimulus of the most recent day; reusing equipment is fine):
${recent || "- none"}
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
) {
  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    temperature: 0.6,
    max_tokens: 4000,
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
) {
  const modes = modeOrder(config.jsonMode);
  let lastError: unknown = new Error("Could not generate a workout.");
  for (const mode of modes) {
    try {
      return await complete(messages, config, mode);
    } catch (error) {
      lastError = error;
      if (!isFormatError(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function generateDay(input: { date: string; focus: string }) {
  loadEnv();
  const items = listEquipment();
  if (!items.some((item) => item.owned)) {
    throw new Error("Mark the equipment you own first. Workouts are built only from that list.");
  }

  const config = resolveProvider(env);
  const members = listAthletes();
  const format = pickFormat(input.focus, capabilities(items), recentFormats(input.date));
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt(members) },
    { role: "user", content: userPrompt({ ...input, items, members, format }) },
  ];

  let lastError = "Could not generate a workout.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let content = "";
    try {
      content = await completeWithFallback(messages, config);
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
        items,
      );
      if (violations.length) {
        lastError = violations.slice(0, 6).join(" ");
        messages.push({ role: "user", content: userPrompt({ ...input, items, members, format, violations }) });
        continue;
      }
      saveGeneratedDay({
        date: input.date,
        title: parsed.title,
        stimulus: parsed.stimulus,
        source: "programmed",
        sourceText: "",
        focus: input.focus,
        format: format.id,
        snapshot: JSON.stringify(
          items.filter((item) => item.owned).map((item) => ({ slug: item.slug, quantity: item.quantity })),
        ),
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
      messages.push({
        role: "user",
        content: `That response was invalid (${lastError}). Return one JSON object with a warm-up, a workout prep, a scored piece, and a cool-down. Use bullet points.`,
      });
    }
  }
  throw new Error(lastError);
}
