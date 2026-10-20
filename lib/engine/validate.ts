import {
  doseInRange,
  doseRangeFor,
  estimateDoseSeconds,
  isAdvancedSkill,
  movementById,
  movementEligible,
  type EquipmentProfile,
} from "./movements";
import type { AiWorkout } from "./class";
import type { DayAssignment } from "./planner";
import { scoreTypeForScheme } from "./scheme";

export type ValidationIssue = {
  path: string;
  message: string;
};

export function validateAiWorkout(input: {
  assignment: DayAssignment;
  ai: AiWorkout;
  profile: EquipmentProfile;
}): ValidationIssue[] {
  const { assignment, ai, profile } = input;
  const issues: ValidationIssue[] = [];
  if (!ai.title.trim()) issues.push({ path: "title", message: "Add a workout title." });
  if (ai.title.length > 60) issues.push({ path: "title", message: "Keep the title under 60 characters." });
  if (/\b(locomotion|monostructural|modality)\b/i.test(ai.title)) {
    issues.push({ path: "title", message: "Use a human workout title, not internal programming words." });
  }
  if (!ai.stimulus.trim()) issues.push({ path: "stimulus", message: "Add a one-line stimulus." });
  if (ai.stimulus.length > 140) issues.push({ path: "stimulus", message: "Keep the stimulus under 140 characters." });
  if (/\b\d+\s*(?:min|mins|minute|minutes|sec|secs|second|seconds)\b/i.test(ai.stimulus)) {
    issues.push({ path: "stimulus", message: "The stimulus describes effort, never a time estimate." });
  }
  if (ai.pieces.length !== assignment.pieces.length) {
    issues.push({
      path: "pieces",
      message: `Return exactly ${assignment.pieces.length} piece${assignment.pieces.length === 1 ? "" : "s"}; you returned ${ai.pieces.length}.`,
    });
    return issues;
  }

  assignment.pieces.forEach((brief, index) => {
    const piece = ai.pieces[index];
    const path = `pieces.${index}`;
    if (!piece) return;
    if (piece.movements.length < brief.movementCount.min || piece.movements.length > brief.movementCount.max) {
      issues.push({
        path: `${path}.movements`,
        message: `Use ${brief.movementCount.min}-${brief.movementCount.max} movements for this piece.`,
      });
    }
    const seen = new Set<string>();
    const seenPatterns = new Map<string, string>();
    for (const [movementIndex, item] of piece.movements.entries()) {
      const movement = movementById(item.id);
      if (!movement) {
        issues.push({ path: `${path}.movements.${movementIndex}.id`, message: `"${item.id}" is not a known movement.` });
        continue;
      }
      if (!movementEligible(movement, profile)) {
        issues.push({ path: `${path}.movements.${movementIndex}.id`, message: `${movement.name} needs equipment you do not own.` });
      }
      if (!brief.modalities.includes(movement.modality)) {
        issues.push({
          path: `${path}.movements.${movementIndex}.id`,
          message: `${movement.name} is ${movement.modality === "M" ? "monostructural" : movement.modality === "G" ? "gymnastics" : "weightlifting"}, but this piece only allows ${brief.modalities.join(" + ")}.`,
        });
      }
      if (!brief.allowSkill && brief.kind !== "skill" && isAdvancedSkill(movement)) {
        issues.push({
          path: `${path}.movements.${movementIndex}.id`,
          message: `${movement.name} is advanced skill work. Keep advanced skills in the skill piece.`,
        });
      }
      if (seen.has(item.id)) {
        issues.push({ path: `${path}.movements.${movementIndex}.id`, message: `Do not repeat ${movement.name} in one piece.` });
      }
      seen.add(item.id);
      if (movement.pattern !== "none" && movement.pattern !== "locomotion" && movement.pattern !== "core") {
        const previous = seenPatterns.get(movement.pattern);
        if (previous) {
          issues.push({
            path: `${path}.movements.${movementIndex}.id`,
            message: `${movement.name} repeats the ${movement.pattern} pattern already used by ${previous}. Pick a contrasting movement.`,
          });
        } else {
          seenPatterns.set(movement.pattern, movement.name);
        }
      }
      const doseOptional =
        brief.scheme.type === "ladder" ||
        brief.scheme.type === "strength" ||
        brief.scheme.type === "max_load" ||
        brief.scheme.type === "max_reps" ||
        brief.scheme.type === "skill" ||
        (brief.scheme.type === "for_time" && Boolean(brief.scheme.repScheme?.length));
      if (!doseOptional) {
        if (!doseInRange(movement, item.dose, brief.scheme)) {
          const ranges = doseRangeFor(movement, brief.scheme).map((range) => `${range.unit} ${range.min}-${range.max}`).join(" or ");
          issues.push({
            path: `${path}.movements.${movementIndex}.dose`,
            message: `${movement.name} needs a dose within ${ranges} for this scheme.`,
          });
        }
      }
      if (brief.kind === "strength" && !movement.load && piece.movements.length === 1) {
        issues.push({
          path: `${path}.movements.${movementIndex}.id`,
          message: "A strength piece needs at least one loaded movement.",
        });
      }
      if (brief.kind === "skill" && movement.load) {
        issues.push({
          path: `${path}.movements.${movementIndex}.id`,
          message: "Skill practice should use bodyweight or light-skill movements, not loaded work.",
        });
      }
    }

    if (scoreTypeForScheme(brief.scheme) !== "none" && piece.movements.length === 0) {
      issues.push({ path: `${path}.movements`, message: "A scored piece needs at least one movement." });
    }

    const chosenModalities = new Set(
      piece.movements
        .map((item) => movementById(item.id)?.modality)
        .filter((modality): modality is "M" | "G" | "W" => Boolean(modality)),
    );
    if (brief.kind === "metcon") {
      if (brief.scheme.type === "intervals") {
        const canMix = brief.modalities.length > 1;
        if (canMix && chosenModalities.size < 2) {
          issues.push({
            path: `${path}.movements`,
            message: "An interval circuit needs at least two modalities. Add a non-monostructural station.",
          });
        }
        if (canMix && brief.modalities.includes("M")) {
          const hasEngine = chosenModalities.has("M");
          const hasOther = [...chosenModalities].some((modality) => modality !== "M");
          if (!hasEngine || !hasOther) {
            issues.push({
              path: `${path}.movements`,
              message: "An interval circuit needs at least one monostructural station and one contrasting station.",
            });
          }
        }
      } else if (brief.modalities.length > 1 && chosenModalities.size < 2) {
        issues.push({
          path: `${path}.movements`,
          message: `A metcon needs at least two modalities. This piece allows ${brief.modalities.join(" + ")}.`,
        });
      }
    }

    if (brief.scheme.type === "intervals") {
      const roundSeconds = piece.movements.reduce((sum, item) => {
        const movement = movementById(item.id);
        return movement ? sum + estimateDoseSeconds(movement, item.dose) : sum;
      }, 0);
      if (roundSeconds > brief.scheme.workSec * 1.05) {
        issues.push({
          path: `${path}.movements`,
          message: `That round takes about ${Math.round(roundSeconds)} seconds, more than the ${brief.scheme.workSec}-second window. Reduce the doses.`,
        });
      }
    }
    if (brief.scheme.type === "emom") {
      const window = brief.scheme.everySec ?? 60;
      for (const [movementIndex, item] of piece.movements.entries()) {
        const movement = movementById(item.id);
        if (!movement) continue;
        if (estimateDoseSeconds(movement, item.dose) > window * 1.05) {
          issues.push({
            path: `${path}.movements.${movementIndex}.dose`,
            message: `${movement.name} will not fit inside one ${window}-second EMOM minute.`,
          });
        }
      }
    }
  });

  return issues;
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n");
}
