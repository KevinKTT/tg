import assert from "node:assert/strict";
import test from "node:test";
import { deciderMode } from "../lib/decide";
import { verdictFrom } from "../lib/decide/policy";
import { SESSION_QUESTIONS, sessionState } from "../lib/decide/questions";
import { buildTypesafeRequest, DEFAULT_TYPESAFE_BASE_URL } from "../lib/decide/typesafe";
import type { DecisionResponse } from "../lib/decide/types";
import { auditPlan } from "../lib/engine/quality";
import type { ClassPlan } from "../lib/engine/class";

function reader(values: Record<string, string>) {
  return (name: string) => values[name] ?? "";
}

const sample: ClassPlan = {
  date: "2026-10-31",
  title: "Row & Press",
  stimulus: "Hard, but repeatable.",
  focus: "mixed",
  format: "amrap",
  summary: "",
  warmup: "- 3 min easy jog",
  warmupDurationMin: 10,
  prep: "- 5 cal row\n- 5 Push press",
  prepDurationMin: 7,
  cooldown: "- Child's pose",
  cooldownDurationMin: 5,
  pieces: [
    {
      kind: "metcon",
      name: "Workout",
      scheme: { type: "amrap", minutes: 14 },
      movements: [
        { id: "row", dose: { cal: 12 } },
        { id: "db-push-press", dose: { reps: 10 } },
        { id: "box-jump", dose: { reps: 12 } },
      ],
      estimatedDurationMin: 14,
    },
  ],
};

function response(answers: DecisionResponse["answers"]): DecisionResponse {
  return { model: "jev-test", answers };
}

const goodAnswers: DecisionResponse["answers"] = {
  coherent: { type: "noul", noul: 0.9 },
  local_fatigue: { type: "noul", noul: 0.08 },
  volume: { type: "noul", noul: 0.82 },
  contrast: { type: "noul", noul: 0.86 },
  week_fit: { type: "noul", noul: 0.7 },
  stimulus: { type: "score", score: 2, confidence: 0.8 },
};

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

test("a coherent class is kept", () => {
  const verdict = verdictFrom(response(goodAnswers));
  assert.equal(verdict.keep, true, verdict.reasons.join(", "));
  assert.equal(verdict.confidence, 0.9);
});

test("local fatigue or bad volume rejects the class with a reason", () => {
  const verdict = verdictFrom(
    response({
      ...goodAnswers,
      local_fatigue: { type: "noul", noul: 0.91 },
      volume: { type: "noul", noul: 0.2 },
    }),
  );
  assert.equal(verdict.keep, false);
  assert.ok(verdict.reasons.some((reason) => /local fatigue/.test(reason)));
  assert.ok(verdict.reasons.some((reason) => /volume/.test(reason)));
});

test("a low-confidence verdict is rejected at the default threshold", () => {
  const verdict = verdictFrom(response({ ...goodAnswers, coherent: { type: "noul", noul: 0.5 } }));
  assert.equal(verdict.keep, false);
});

test("missing answers never crash the policy", () => {
  const verdict = verdictFrom(response({}));
  assert.equal(verdict.keep, true);
  assert.equal(verdict.confidence, 0);
});

test("the session question set covers taste, not schema", () => {
  assert.deepEqual(Object.keys(SESSION_QUESTIONS).sort(), [
    "coherent",
    "contrast",
    "local_fatigue",
    "stimulus",
    "volume",
    "week_fit",
  ]);
  const state = sessionState(sample, [
    { date: "2026-10-30", pattern: "hinge", shape: "heavy", movements: ["deadlift"], load: "heavy" },
  ]);
  assert.match(state, /TITLE: Row & Press/);
  assert.match(state, /2026-10-30: heavy/);
});

test("the audit distinguishes a good triplet from a dumbbell pile", () => {
  assert.equal(auditPlan(sample).hard, 0, JSON.stringify(auditPlan(sample).issues));
});
