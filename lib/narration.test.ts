import assert from "node:assert/strict";
import test from "node:test";

import { items } from "./fixtures";
import {
  buildFactsSnapshot,
  buildNarrationRecord,
  buildNarrationPrompt,
  factHash,
  generateNarration,
  PROMPT_VERSION,
  providerFromEnv,
} from "./narration";

const item = items.find((candidate) => candidate.id === "opportunity");

test("snapshot order is canonical and hashing is stable", () => {
  assert.ok(item);
  const snapshot = buildFactsSnapshot(item);
  const reversed = buildFactsSnapshot({
    ...item,
    facts: [...item.facts].reverse(),
    phases: [...item.phases].reverse(),
  });
  assert.deepEqual(snapshot, reversed);
  assert.equal(factHash(snapshot), factHash(reversed));
  assert.match(factHash(snapshot), /^[a-f0-9]{64}$/);
});

test("a fact change changes the hash", () => {
  assert.ok(item);
  const snapshot = buildFactsSnapshot(item);
  const changed = buildFactsSnapshot({
    ...item,
    facts: item.facts.map((fact, index) =>
      index === 0 ? { ...fact, claim: `${fact.claim} (edited)` } : fact
    ),
  });
  assert.notEqual(factHash(snapshot), factHash(changed));
});

test("snapshots and records never read story text", () => {
  assert.ok(item);
  const withStory = { ...item, story: "Generated wording that must not leak" } as typeof item;
  const snapshot = buildFactsSnapshot(withStory);
  assert.equal("story" in snapshot, false);

  const record = buildNarrationRecord(snapshot, "Generated wording", {
    provider: "none",
    model: "none",
    baseUrl: null,
  });
  assert.equal(record.prompt_version, PROMPT_VERSION);
  assert.equal(record.is_ai_generated, true);
  assert.equal(record.fact_hash, factHash(snapshot));
  assert.deepEqual(record.facts_used, snapshot.facts.map((fact) => fact.id));
});

test("provider configuration defaults to none", () => {
  assert.deepEqual(providerFromEnv({}), { provider: "none", model: "none", baseUrl: null });
  assert.deepEqual(
    providerFromEnv({ LLM_PROVIDER: "ollama", LLM_MODEL: "llama3", LLM_BASE_URL: "http://x" }),
    { provider: "ollama", model: "llama3", baseUrl: "http://x" }
  );
  assert.equal(providerFromEnv({ LLM_PROVIDER: "openai-compatible" }).provider, "openai-compatible");
  assert.equal(providerFromEnv({ LLM_PROVIDER: "bogus" }).provider, "none");
});


test("the prompt contains facts and phases but not generated text", () => {
  assert.ok(item);
  const prompt = buildNarrationPrompt(buildFactsSnapshot(item));
  assert.match(prompt, /FAC TS|FACTS/);
  assert.match(prompt, /Opportunity/);
  assert.doesNotMatch(prompt, /Generated wording that must not leak/);
});

test("the Ollama adapter posts the prompt and returns the response", async () => {
  assert.ok(item);
  const captured: Array<{ url: string; body: any }> = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ response: "A cached label." }), { status: 200 });
  }) as typeof fetch;

  const text = await generateNarration(
    buildFactsSnapshot(item),
    { provider: "ollama", model: "llama3", baseUrl: "http://ollama" },
    fakeFetch
  );

  assert.equal(text, "A cached label.");
  assert.equal(captured[0]?.url, "http://ollama/api/generate");
  assert.equal(captured[0]?.body.model, "llama3");
  assert.match(captured[0]?.body.prompt, /Opportunity/);
});

test("the OpenAI-compatible adapter reads choices[0].message.content", async () => {
  assert.ok(item);
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "A label." } }] }), {
      status: 200,
    })) as typeof fetch;

  const text = await generateNarration(
    buildFactsSnapshot(item),
    { provider: "openai-compatible", model: "gpt", baseUrl: "http://llm" },
    fakeFetch
  );
  assert.equal(text, "A label.");
});

test("provider none does not call the network", async () => {
  assert.ok(item);
  const fakeFetch = (async () => {
    throw new Error("should not be called");
  }) as typeof fetch;
  assert.equal(
    await generateNarration(
      buildFactsSnapshot(item),
      { provider: "none", model: "none", baseUrl: null },
      fakeFetch
    ),
    null
  );
});
