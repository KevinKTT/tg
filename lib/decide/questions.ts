import type { ClassPlan } from "../engine/class";
import { movementById } from "../engine/movements";
import { describePlan } from "../engine/quality";
import type { Question } from "./types";

/**
 * The taste layer, now comparative.
 *
 * Jev sees every eligible candidate in one state and answers "which is most
 * ..." for each dimension. Code combines the probabilities, but the judgments
 * stay here where they can be reviewed and versioned.
 *
 * There is deliberately no week history: the planner is deterministic, and a
 * candidate is judged on the session in front of it.
 */
export const REFERENCE_ATHLETE =
  "an intermediate CrossFit athlete at Rx loads who can do pull-ups, double-unders, and a 225 lb deadlift. The class should be hard but finishable inside its cap.";

export const CANDIDATE_QUESTION_IDS = [
  "most_real",
  "most_difficult",
  "most_variety",
  "best_stimulus",
  "cleanest",
] as const;

export function candidateKey(index: number): string {
  return String.fromCharCode(65 + index);
}

function movementNames(plan: ClassPlan): string {
  return plan.pieces
    .flatMap((piece) => piece.movements.map((item) => movementById(item.id)?.name ?? item.id))
    .join(", ");
}

function candidateCriteria(plans: ClassPlan[]): Record<string, string> {
  return Object.fromEntries(
    plans.map((plan, index) => {
      const key = candidateKey(index);
      const schemes = plan.pieces.map((piece) => piece.scheme.type).join(" + ");
      return [key, `Candidate ${key} — ${plan.title} (${schemes}): ${movementNames(plan)}`];
    }),
  );
}

/** The full candidate set is one state, because the questions compare them. */
export function candidatesState(plans: ClassPlan[]): string {
  const body = plans
    .map((plan, index) => `CANDIDATE ${candidateKey(index)}\n${describePlan(plan)}`)
    .join("\n\n");
  return `REFERENCE ATHLETE: ${REFERENCE_ATHLETE}\n\n${body}`;
}

export function candidateQuestions(plans: ClassPlan[]): Record<string, Question> {
  const criteria = candidateCriteria(plans);
  return {
    most_real: {
      type: "choice",
      instructions:
        "Which candidate reads most like a real CrossFit class a coach would put on the whiteboard — a clear stimulus, standard movements, sensible doses, and no filler?",
      criteria,
    },
    most_difficult: {
      type: "choice",
      instructions:
        "Which candidate is hardest for the reference athlete while still being completable inside its time cap at the intended stimulus?",
      criteria,
    },
    most_variety: {
      type: "choice",
      instructions:
        "Which candidate has the best variety of movement patterns, modalities, and implements while still reading as one coherent class, not random novelty?",
      criteria,
    },
    best_stimulus: {
      type: "choice",
      instructions:
        "Which candidate's movements best deliver the stimulus its title and stimulus line claim?",
      criteria,
    },
    cleanest: {
      type: "choice",
      instructions:
        "Which candidate is least likely to be decided by local fatigue — one muscle group, implement, or grip — rather than by conditioning?",
      criteria,
    },
  };
}
