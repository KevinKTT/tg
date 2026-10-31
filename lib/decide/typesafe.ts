import { env } from "../env";
import type { Answer, Decider, DecisionRequest, DecisionResponse } from "./types";

export const DEFAULT_TYPESAFE_BASE_URL = "https://api.typesafe.ai/v1";
export const DEFAULT_TYPESAFE_MODEL = "jev-latest";

export type TypesafeRequest = {
  url: string;
  headers: Record<string, string>;
  body: { state: string; model: string; questions: DecisionRequest["questions"] };
};

export function typesafeConfigured(get: (name: string) => string = env): boolean {
  return Boolean(get("TYPESAFE_API_KEY"));
}

/** Pure request builder, so the wire format is testable without a network call. */
export function buildTypesafeRequest(
  request: DecisionRequest,
  get: (name: string) => string = env,
): TypesafeRequest {
  const base = (get("TYPESAFE_BASE_URL") || DEFAULT_TYPESAFE_BASE_URL).replace(/\/+$/, "");
  return {
    url: `${base}/systemone`,
    headers: {
      Authorization: `Bearer ${get("TYPESAFE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: {
      state: request.state,
      model: get("TYPESAFE_MODEL") || DEFAULT_TYPESAFE_MODEL,
      questions: request.questions,
    },
  };
}

function normaliseAnswers(value: unknown): Record<string, Answer> {
  if (!value || typeof value !== "object") throw new Error("TypeSafe returned no answers.");
  const raw = (value as { answers?: unknown }).answers;
  if (!raw || typeof raw !== "object") throw new Error("TypeSafe returned no answers.");
  return raw as Record<string, Answer>;
}

export class TypeSafeDecider implements Decider {
  readonly name = "typesafe";

  async ask(request: DecisionRequest): Promise<DecisionResponse> {
    const { url, headers, body } = buildTypesafeRequest(request);
    const timeout = Number(env("TYPESAFE_TIMEOUT_MS")) || 20_000;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`TypeSafe ${response.status}: ${detail.slice(0, 200)}`);
    }
    const payload = (await response.json()) as unknown;
    const answers = normaliseAnswers(payload);
    const record = payload as { model?: unknown; usage?: DecisionResponse["usage"] };
    return {
      model: typeof record.model === "string" ? record.model : body.model,
      answers,
      usage: record.usage,
    };
  }
}
