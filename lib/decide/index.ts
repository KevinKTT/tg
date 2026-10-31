import { env } from "../env";
import type { ClassPlan } from "../engine/class";
import type { RecentSignal } from "../engine/planner";
import { LlmDecider } from "./llm";
import { verdictFrom, verdictThreshold, type SessionVerdict } from "./policy";
import { SESSION_QUESTIONS, sessionState } from "./questions";
import type { Decider } from "./types";
import { TypeSafeDecider, typesafeConfigured } from "./typesafe";

export type DeciderMode = "auto" | "typesafe" | "llm" | "off";

export function deciderMode(get: (name: string) => string = env): DeciderMode {
  const value = get("AI_DECIDER").trim().toLowerCase();
  if (value === "typesafe" || value === "jev") return "typesafe";
  if (value === "llm") return "llm";
  if (value === "off" || value === "engine" || value === "none") return "off";
  return typesafeConfigured(get) ? "typesafe" : "off";
}

export function makeDecider(get: (name: string) => string = env): Decider | null {
  const mode = deciderMode(get);
  if (mode === "typesafe") return typesafeConfigured(get) ? new TypeSafeDecider() : null;
  if (mode === "llm") return get("AI_API_KEY") || get("FIREWORKS_API_KEY") ? new LlmDecider() : null;
  return null;
}

/**
 * Ask the decision model for a second opinion on one class.
 * Returns null when no decider is configured or the call fails: the caller
 * already has a deterministic answer, so a missing judge is never fatal.
 */
export async function judgeSession(input: {
  plan: ClassPlan;
  recent?: RecentSignal[];
  decider?: Decider | null;
}): Promise<SessionVerdict | null> {
  const decider = input.decider === undefined ? makeDecider() : input.decider;
  if (!decider) return null;
  try {
    const response = await decider.ask({
      state: sessionState(input.plan, input.recent ?? []),
      questions: SESSION_QUESTIONS,
    });
    return verdictFrom(response, verdictThreshold(env));
  } catch (error) {
    console.warn(`[decide] ${decider.name} could not judge the session:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Judge several candidates in parallel. One request each, so every verdict is
 * about a single class rather than a comparison the model has to hold in mind.
 */
export async function judgeCandidates(input: {
  plans: ClassPlan[];
  recent?: RecentSignal[];
  decider?: Decider | null;
}): Promise<(SessionVerdict | null)[]> {
  const decider = input.decider === undefined ? makeDecider() : input.decider;
  if (!decider) return input.plans.map(() => null);
  return Promise.all(
    input.plans.map((plan) => judgeSession({ plan, recent: input.recent, decider })),
  );
}
