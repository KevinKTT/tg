import { env } from "../env";
import type { ClassPlan } from "../engine/class";
import { LlmDecider } from "./llm";
import { chooseFromResponse, type CandidateDecision } from "./policy";
import { candidateQuestions, candidatesState } from "./questions";
import type { Decider } from "./types";
import { TypeSafeDecider, typesafeConfigured } from "./typesafe";

export type { CandidateDecision } from "./policy";

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
 * Ask Jev which candidate to keep. One request holds every eligible session
 * and one Choice question per dimension, so the model compares them directly.
 *
 * Returns null when no decider is configured or the call fails: the caller
 * already has an audit-ranked answer, so a missing judge is never fatal.
 */
export async function chooseCandidate(input: {
  plans: ClassPlan[];
  decider?: Decider | null;
}): Promise<CandidateDecision | null> {
  if (input.plans.length < 2) return null;
  const decider = input.decider === undefined ? makeDecider() : input.decider;
  if (!decider) return null;
  try {
    const response = await decider.ask({
      state: candidatesState(input.plans),
      questions: candidateQuestions(input.plans),
    });
    const decision = chooseFromResponse(response, input.plans.length);
    if (decision) {
      const winner = decision.scores.find((score) => score.index === decision.winner);
      console.info(
        `[coach] ${decider.name} chose candidate ${decision.key} (composite ${winner?.composite.toFixed(3) ?? "n/a"}).`,
      );
    }
    return decision;
  } catch (error) {
    console.warn(
      `[decide] ${decider.name} could not choose a session:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
