import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_MODEL,
  isFormatError,
  modeOrder,
  resolveProvider,
  type EnvReader,
} from "../lib/ai-config";

function reader(values: Record<string, string>): EnvReader {
  return (name) => values[name] ?? "";
}

test("defaults to OpenAI", () => {
  const config = resolveProvider(reader({ AI_API_KEY: "sk-test" }));
  assert.equal(config.apiKey, "sk-test");
  assert.equal(config.baseURL, DEFAULT_BASE_URL);
  assert.equal(config.model, DEFAULT_MODEL);
  assert.equal(config.jsonMode, "schema");
  assert.equal(config.reasoningEffort, null);
  assert.equal(config.maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS);
});

test("accepts FIREWORKS_API_KEY as an alias", () => {
  assert.equal(resolveProvider(reader({ FIREWORKS_API_KEY: "fw" })).apiKey, "fw");
});

test("honors explicit overrides", () => {
  const config = resolveProvider(
    reader({
      AI_API_KEY: "k",
      AI_BASE_URL: "https://api.groq.com/openai/v1",
      AI_MODEL: "llama-3.3-70b-versatile",
      AI_JSON_MODE: "object",
      AI_REASONING_EFFORT: "low",
      AI_MAX_OUTPUT_TOKENS: "9000",
    }),
  );
  assert.equal(config.baseURL, "https://api.groq.com/openai/v1");
  assert.equal(config.model, "llama-3.3-70b-versatile");
  assert.equal(config.jsonMode, "object");
  assert.equal(config.reasoningEffort, "low");
  assert.equal(config.maxOutputTokens, 9000);
});

test("auto-sets reasoning effort for a Fireworks base URL", () => {
  const config = resolveProvider(reader({ AI_BASE_URL: "https://api.fireworks.ai/inference/v1" }));
  assert.equal(config.reasoningEffort, "none");
});

test("invalid json mode falls back to schema", () => {
  assert.equal(resolveProvider(reader({ AI_JSON_MODE: "bogus" })).jsonMode, "schema");
});

test("invalid output token limits use the safe default", () => {
  assert.equal(resolveProvider(reader({ AI_MAX_OUTPUT_TOKENS: "nope" })).maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS);
  assert.equal(resolveProvider(reader({ AI_MAX_OUTPUT_TOKENS: "100" })).maxOutputTokens, 1000);
  assert.equal(resolveProvider(reader({ AI_MAX_OUTPUT_TOKENS: "999999" })).maxOutputTokens, 32000);
});

test("mode order degrades from schema to object to none", () => {
  assert.deepEqual(modeOrder("schema"), ["schema", "object", "none"]);
  assert.deepEqual(modeOrder("object"), ["object", "none"]);
  assert.deepEqual(modeOrder("none"), ["none"]);
});

test("detects format errors but not auth or network failures", () => {
  assert.equal(isFormatError({ status: 400, message: "Invalid response_format" }), true);
  assert.equal(isFormatError(new Error("json_schema is not supported")), true);
  assert.equal(isFormatError({ status: 401, message: "Invalid API key" }), false);
  assert.equal(isFormatError(new Error("fetch failed")), false);
});
