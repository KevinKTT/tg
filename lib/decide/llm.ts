import OpenAI from "openai";
import { isFormatError, modeOrder, resolveProvider } from "../ai-config";
import { env } from "../env";
import {
  clamp01,
  type Answer,
  type Decider,
  type DecisionRequest,
  type DecisionResponse,
  type Question,
} from "./types";

const SYSTEM = `You are a decision model. You never write prose.

You are given a STATE and a set of QUESTIONS. Answer every question about that state.
Return one JSON object:
{ "answers": { "<question id>": <answer> } }

Answer shapes:
- noul:  { "type": "noul", "noul": 0.0 to 1.0 }  // probability the statement is true
- score: { "type": "score", "score": 0 to criteria.length - 1, "confidence": 0.0 to 1.0 }
- choice:{ "type": "choice", "choice": "<one of the criteria keys>", "confidence": 0.0 to 1.0 }

Rules:
- Use probabilities you would defend, not rounded slogans. 0.5 means genuinely unsure.
- Never invent a question id and never invent a choice that is not a criteria key.
- Return JSON only. No commentary.`;

function questionBrief(questions: Record<string, Question>): string {
  return Object.entries(questions)
    .map(([id, question]) => {
      if (question.type === "choice") {
        const options = Object.entries(question.criteria)
          .map(([key, criterion]) => `    ${key}: ${criterion}`)
          .join("\n");
        return `${id} (choice) — ${question.instructions}\n${options}`;
      }
      if (question.type === "score") {
        const levels = question.criteria.map((criterion, index) => `    ${index}: ${criterion}`).join("\n");
        return `${id} (score) — ${question.instructions}\n${levels}`;
      }
      return `${id} (noul) — ${question.instructions}`;
    })
    .join("\n\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

function normaliseAnswers(value: unknown, questions: Record<string, Question>): Record<string, Answer> {
  if (!value || typeof value !== "object") throw new Error("The model returned no answers.");
  const raw = (value as { answers?: unknown }).answers;
  if (!raw || typeof raw !== "object") throw new Error("The model returned no answers.");
  const answers: Record<string, Answer> = {};
  for (const [id, question] of Object.entries(questions)) {
    const candidate = (raw as Record<string, unknown>)[id];
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    if (question.type === "noul") {
      if (typeof row.noul !== "number") continue;
      answers[id] = { type: "noul", noul: clamp01(row.noul) };
    } else if (question.type === "score") {
      if (typeof row.score !== "number") continue;
      answers[id] = {
        type: "score",
        score: Math.min(question.criteria.length - 1, Math.max(0, row.score)),
        confidence: clamp01(typeof row.confidence === "number" ? row.confidence : 0.5),
      };
    } else {
      if (typeof row.choice !== "string" || !(row.choice in question.criteria)) continue;
      answers[id] = {
        type: "choice",
        choice: row.choice,
        confidence: clamp01(typeof row.confidence === "number" ? row.confidence : 0.5),
      };
    }
  }
  if (!Object.keys(answers).length) throw new Error("The model answered no questions.");
  return answers;
}

/**
 * The same decision contract, answered by an ordinary chat model.
 *
 * Slower and no better calibrated than Jev, but it means the decision layer
 * works with the provider you already configured, and can be swapped later
 * without changing a single question.
 */
export class LlmDecider implements Decider {
  readonly name = "llm";

  async ask(request: DecisionRequest): Promise<DecisionResponse> {
    const config = resolveProvider(env);
    if (!config.apiKey) throw new Error("Add AI_API_KEY before using the LLM decider.");
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: 60_000 });
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `STATE:\n${request.state}\n\nQUESTIONS:\n${questionBrief(request.questions)}`,
      },
    ];
    let lastError: unknown = new Error("The decision model did not answer.");
    for (const mode of modeOrder("object")) {
      try {
        const response = await client.chat.completions.create({
          model: config.model,
          temperature: 0,
          max_tokens: 1_500,
          messages,
          ...(mode === "object" ? { response_format: { type: "json_object" as const } } : {}),
        });
        const content = response.choices[0]?.message?.content?.trim() || "";
        if (!content) throw new Error("The model returned an empty decision.");
        return {
          model: config.model,
          answers: normaliseAnswers(extractJson(content), request.questions),
        };
      } catch (error) {
        lastError = error;
        if (!isFormatError(error)) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
