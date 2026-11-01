import type { DecisionResponse } from "./types";
import { choiceAnswer, choiceProbabilities } from "./types";
import { candidateKey } from "./questions";

/**
 * How much each Jev judgment matters when the probabilities are combined.
 * These weights are business rules, not model output: change them here when
 * the rankings disagree with your taste.
 */
export const CANDIDATE_WEIGHTS: Record<string, number> = {
  most_real: 0.3,
  most_difficult: 0.25,
  most_variety: 0.2,
  best_stimulus: 0.15,
  cleanest: 0.1,
};

export type CandidateScore = {
  index: number;
  key: string;
  composite: number;
  probabilities: Record<string, number>;
};

export type CandidateDecision = {
  winner: number;
  key: string;
  model: string;
  weights: Record<string, number>;
  scores: CandidateScore[];
};

function answerProbabilities(
  response: DecisionResponse,
  questionId: string,
  candidateCount: number,
): Record<string, number> | null {
  const keys = Array.from({ length: candidateCount }, (_, index) => candidateKey(index));
  const probabilities = choiceProbabilities(response, questionId);
  if (probabilities && keys.every((key) => typeof probabilities[key] === "number")) {
    return probabilities;
  }
  const choice = choiceAnswer(response, questionId);
  if (!choice || !keys.includes(choice)) return null;
  // The LLM decider may omit a distribution. A one-hot answer is still a vote.
  return Object.fromEntries(keys.map((key) => [key, key === choice ? 1 : 0]));
}

/**
 * Weighted composite of Jev's Choice probabilities. Code does the arithmetic;
 * every judgment remains the model's.
 */
export function chooseFromResponse(
  response: DecisionResponse,
  candidateCount: number,
): CandidateDecision | null {
  if (candidateCount < 1) return null;
  const scores: CandidateScore[] = Array.from({ length: candidateCount }, (_, index) => ({
    index,
    key: candidateKey(index),
    composite: 0,
    probabilities: {},
  }));

  let usableWeight = 0;
  for (const [questionId, weight] of Object.entries(CANDIDATE_WEIGHTS)) {
    const probabilities = answerProbabilities(response, questionId, candidateCount);
    if (!probabilities) continue;
    usableWeight += weight;
    for (const score of scores) {
      const probability = probabilities[score.key] ?? 0;
      score.composite += weight * probability;
      score.probabilities[questionId] = probability;
    }
  }
  if (!usableWeight) return null;
  for (const score of scores) score.composite /= usableWeight;

  scores.sort(
    (left, right) =>
      right.composite - left.composite ||
      (right.probabilities.most_real ?? 0) - (left.probabilities.most_real ?? 0) ||
      (right.probabilities.most_difficult ?? 0) - (left.probabilities.most_difficult ?? 0) ||
      left.index - right.index,
  );
  const winner = scores[0];
  return {
    winner: winner.index,
    key: winner.key,
    model: response.model,
    weights: CANDIDATE_WEIGHTS,
    scores,
  };
}
