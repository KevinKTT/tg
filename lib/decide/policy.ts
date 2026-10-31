import type { DecisionResponse } from "./types";
import { noulAnswer, scoreAnswer } from "./types";

export const DEFAULT_THRESHOLD = 0.6;

export type SessionVerdict = {
  keep: boolean;
  confidence: number;
  reasons: string[];
  signals: Record<string, number | null>;
};

function threshold(get: (name: string) => string): number {
  const parsed = Number(get("AI_DECIDER_THRESHOLD"));
  if (!Number.isFinite(parsed)) return DEFAULT_THRESHOLD;
  return Math.min(0.95, Math.max(0.05, parsed));
}

/**
 * Probabilities are evidence, not truth. These are the business rules for when
 * a class is kept, and they stay in code where they can be reviewed.
 */
export function verdictFrom(
  response: DecisionResponse,
  minConfidence = DEFAULT_THRESHOLD,
): SessionVerdict {
  const coherent = noulAnswer(response, "coherent");
  const localFatigue = noulAnswer(response, "local_fatigue");
  const volume = noulAnswer(response, "volume");
  const contrast = noulAnswer(response, "contrast");
  const weekFit = noulAnswer(response, "week_fit");
  const stimulus = scoreAnswer(response, "stimulus");
  const reasons: string[] = [];

  if (coherent != null && coherent < minConfidence) reasons.push("does not read as one intentional class");
  if (localFatigue != null && localFatigue >= minConfidence) reasons.push("local fatigue will decide the score");
  if (volume != null && volume < minConfidence) reasons.push("volume does not fit the cap");
  if (contrast != null && contrast < minConfidence) reasons.push("movements repeat the same stress");
  if (weekFit != null && weekFit < 0.45) reasons.push("repeats what the week already trained");
  if (stimulus != null && stimulus < 1) reasons.push("movements fight the stated stimulus");

  return {
    keep: reasons.length === 0,
    confidence: coherent ?? 0,
    reasons,
    signals: {
      coherent,
      local_fatigue: localFatigue,
      volume,
      contrast,
      week_fit: weekFit,
      stimulus,
    },
  };
}

export function verdictThreshold(get: (name: string) => string): number {
  return threshold(get);
}
