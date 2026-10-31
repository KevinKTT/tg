import type { ClassPlan } from "../engine/class";
import type { RecentSignal } from "../engine/planner";
import { describePlan } from "../engine/quality";
import type { Question } from "./types";

/**
 * The taste layer.
 *
 * Each question is a claim a coach could disagree with in writing, which is
 * the point: prompts drift, criteria can be reviewed, tested, and versioned.
 * Every question is phrased so that a high probability is *good* for the class.
 */
export const SESSION_QUESTIONS: Record<string, Question> = {
  coherent: {
    type: "noul",
    instructions:
      "This reads as one intentional CrossFit class a coach would put on the whiteboard, not a pile of movements assembled to fill a time slot.",
  },
  stimulus: {
    type: "score",
    instructions: "How well the movements deliver the stimulus the class claims.",
    criteria: ["The movements fight the stimulus", "Workable but muddled", "Textbook for this stimulus"],
  },
  local_fatigue: {
    type: "noul",
    instructions:
      "One implement, joint, or muscle group carries so much of the work that local fatigue, not conditioning, will decide the score.",
  },
  volume: {
    type: "noul",
    instructions:
      "The prescribed volume is completable inside the time cap by an intermediate athlete at the intended effort.",
  },
  contrast: {
    type: "noul",
    instructions:
      "The movements contrast with each other rather than repeating the same pattern, implement, or muscle group.",
  },
  week_fit: {
    type: "noul",
    instructions:
      "This session adds something the previous days did not already train, and does not repeat yesterday's stress.",
  },
};

function recentSummary(recent: RecentSignal[], limit = 6): string {
  if (!recent.length) return "No previous sessions logged.";
  return recent
    .slice(0, limit)
    .map((signal) => `${signal.date}: ${signal.shape ?? signal.format ?? "session"} (${signal.pattern}, ${signal.load ?? "load n/a"})`)
    .join("\n");
}

export function sessionState(plan: ClassPlan, recent: RecentSignal[] = []): string {
  return `${describePlan(plan)}\n\nRECENT SESSIONS (most recent first):\n${recentSummary(recent)}`;
}
