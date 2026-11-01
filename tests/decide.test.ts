import assert from "node:assert/strict";
import test from "node:test";
import { chooseCandidate, deciderMode } from "../lib/decide";
import { chooseFromResponse } from "../lib/decide/policy";
import { CANDIDATE_QUESTION_IDS, candidateQuestions, candidatesState } from "../lib/decide/questions";
import { buildTypesafeRequest, DEFAULT_TYPESAFE_BASE_URL } from "../lib/decide/typesafe";
import type { DecisionRequest, DecisionResponse } from "../lib/decide/types";
import type { ClassPlan } from "../lib/engine/class";

function reader(values: Record<string, string>) {
  return (name: string) => values[name] ?? "";
}

function samplePlan(title: string, ids: string[]): ClassPlan {
  return {
    date: "2026-10-31",
    title,
    stimulus: "Hard, but repeatable.",
    focus: "mixed",
    format: "amrap",
    summary: "",
    warmup: "- 3 min easy jog",
    warmupDurationMin: 10,
    prep: "- 5 cal row",
    prepDurationMin: 7,
    cooldown: "- Child's pose",
    cooldownDurationMin: 5,
    pieces: [
      {
        kind: "metcon",
        name: "Workout",
        scheme: { type: "amrap", minutes: 14 },
        movements: ids.map((id) => ({ id, dose: { reps: 10 } })),
        estimatedDurationMin: 14,
      },
    ],
  };
}

const plans = [
  samplePlan("Row & Press", ["row", "db-push-press", "box-jump"]),
  samplePlan("Deadlift & Burpee", ["db-deadlift", "burpee", "air-squat"]),
  samplePlan("Jump Rope Chipper", ["double-under", "push-up", "air-squat"]),
  samplePlan("Run & Carry", ["run", "db-walking-lunge", "box-jump"]),
];

function response(answers: DecisionResponse["answers"]): DecisionResponse {
  return { model: "jev-test", answers };
}

function choice(probabilities: Record<string, number>): DecisionResponse["answers"][string] {
  const winner = Object.entries(probabilities).sort((left, right) => right[1] - left[1])[0][0];
  return { type: "choice", choice: winner, confidence: 0.5, probabilities };
}

test("the TypeSafe request matches the documented wire format", () => {
  const request = buildTypesafeRequest(
    {
      state: "a state",
      questions: { urgent: { type: "noul", instructions: "It is urgent" } },
    },
    reader({ TYPESAFE_API_KEY: "ts-key", TYPESAFE_MODEL: "jev-test" }),
  );
  assert.equal(request.url, `${DEFAULT_TYPESAFE_BASE_URL}/systemone`);
  assert.equal(request.headers.Authorization, "Bearer ts-key");
  assert.equal(request.body.model, "jev-test");
  assert.equal(request.body.state, "a state");
  assert.deepEqual(request.body.questions, { urgent: { type: "noul", instructions: "It is urgent" } });
});

test("a base URL override keeps one slash", () => {
  const request = buildTypesafeRequest(
    { state: "x", questions: {} },
    reader({ TYPESAFE_API_KEY: "k", TYPESAFE_BASE_URL: "https://example.test/v1/" }),
  );
  assert.equal(request.url, "https://example.test/v1/systemone");
});

test("the decider is off until a key or an explicit mode says otherwise", () => {
  assert.equal(deciderMode(reader({})), "off");
  assert.equal(deciderMode(reader({ TYPESAFE_API_KEY: "k" })), "typesafe");
  assert.equal(deciderMode(reader({ AI_DECIDER: "llm" })), "llm");
  assert.equal(deciderMode(reader({ AI_DECIDER: "jev", TYPESAFE_API_KEY: "k" })), "typesafe");
  assert.equal(deciderMode(reader({ AI_DECIDER: "off", TYPESAFE_API_KEY: "k" })), "off");
});

test("the candidate question set compares the same dimensions", () => {
  const questions = candidateQuestions(plans);
  assert.deepEqual(Object.keys(questions).sort(), [...CANDIDATE_QUESTION_IDS].sort());
  for (const question of Object.values(questions)) {
    assert.equal(question.type, "choice");
    assert.deepEqual(Object.keys(question.criteria), ["A", "B", "C", "D"]);
  }
});

test("the state contains the reference athlete and every candidate, but no history", () => {
  const state = candidatesState(plans);
  assert.match(state, /REFERENCE ATHLETE: an intermediate CrossFit athlete/);
  assert.match(state, /CANDIDATE A/);
  assert.match(state, /CANDIDATE D/);
  assert.match(state, /TITLE: Row & Press/);
  assert.doesNotMatch(state, /RECENT/);
  assert.doesNotMatch(state, /week/i);
});

test("weighted probabilities choose the candidate Jev rates highest overall", () => {
  const decision = chooseFromResponse(
    response({
      most_real: choice({ A: 0.5, B: 0.2, C: 0.2, D: 0.1 }),
      most_difficult: choice({ A: 0.1, B: 0.7, C: 0.1, D: 0.1 }),
      most_variety: choice({ A: 0.1, B: 0.2, C: 0.6, D: 0.1 }),
      best_stimulus: choice({ A: 0.2, B: 0.5, C: 0.2, D: 0.1 }),
      cleanest: choice({ A: 0.2, B: 0.3, C: 0.3, D: 0.2 }),
    }),
    4,
  );
  assert.ok(decision);
  assert.equal(decision.winner, 1);
  assert.equal(decision.key, "B");
  assert.deepEqual(
    decision.scores.map((score) => score.key),
    ["B", "C", "A", "D"],
  );
});

test("a choice without a distribution still counts as a one-hot vote", () => {
  const decision = chooseFromResponse(
    response({
      most_real: { type: "choice", choice: "C", confidence: 0.8 },
      most_difficult: { type: "choice", choice: "C", confidence: 0.8 },
    }),
    4,
  );
  assert.ok(decision);
  assert.equal(decision.winner, 2);
});

test("no usable answers means no decision", () => {
  assert.equal(chooseFromResponse(response({}), 4), null);
  assert.equal(
    chooseFromResponse(
      response({ most_real: { type: "choice", choice: "Z", confidence: 1 } }),
      4,
    ),
    null,
  );
});

test("one request carries every candidate and no history", async () => {
  const seen: DecisionRequest[] = [];
  const decider = {
    name: "fake",
    async ask(request: DecisionRequest): Promise<DecisionResponse> {
      seen.push(request);
      return response({
        most_real: choice({ A: 0.1, B: 0.7, C: 0.1, D: 0.1 }),
        most_difficult: choice({ A: 0.1, B: 0.7, C: 0.1, D: 0.1 }),
      });
    },
  };
  const decision = await chooseCandidate({ plans, decider });
  assert.equal(seen.length, 1);
  assert.match(seen[0].state, /CANDIDATE A/);
  assert.doesNotMatch(seen[0].state, /RECENT/);
  assert.deepEqual(Object.keys(seen[0].questions).sort(), [...CANDIDATE_QUESTION_IDS].sort());
  assert.equal(decision?.winner, 1);
});
