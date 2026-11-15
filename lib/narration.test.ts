import assert from "node:assert/strict";
import test from "node:test";

import { items } from "./fixtures";
import {
  buildFactsSnapshot,
  buildNarrationRecord,
  factHash,
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
