/**
 * A tiny decision interface.
 *
 * The point is that the *questions* are the contract, not the vendor. The same
 * question set can be answered by a System One model (Jev), by an ordinary
 * chat model wearing the same schema, or skipped entirely in favour of the
 * deterministic engine.
 */

export type NoulQuestion = {
  type: "noul";
  instructions: string;
};

export type ScoreQuestion = {
  type: "score";
  instructions: string;
  /** Ordered worst to best. */
  criteria: string[];
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  /** Option id to the criterion that makes it the right pick. */
  criteria: Record<string, string>;
};

export type Question = NoulQuestion | ScoreQuestion | ChoiceQuestion;

export type NoulAnswer = { type: "noul"; noul: number };

export type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
};

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities?: Record<string, number>;
};

export type Answer = NoulAnswer | ScoreAnswer | ChoiceAnswer;

export type DecisionRequest = {
  state: string;
  questions: Record<string, Question>;
};

export type DecisionResponse = {
  model: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export interface Decider {
  readonly name: string;
  ask(request: DecisionRequest): Promise<DecisionResponse>;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Defensive read: a model answer is data, never trusted blindly. */
export function noulAnswer(response: DecisionResponse, key: string): number | null {
  const answer = response.answers[key];
  if (!answer || answer.type !== "noul") return null;
  return clamp01(answer.noul);
}

export function scoreAnswer(response: DecisionResponse, key: string): number | null {
  const answer = response.answers[key];
  if (!answer || answer.type !== "score") return null;
  return Number.isFinite(answer.score) ? answer.score : null;
}

export function choiceAnswer(response: DecisionResponse, key: string): string | null {
  const answer = response.answers[key];
  if (!answer || answer.type !== "choice") return null;
  return typeof answer.choice === "string" ? answer.choice : null;
}
