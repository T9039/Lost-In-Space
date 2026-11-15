#!/usr/bin/env node
/**
 * Build a narration for one artifact, cache it by fact hash, and print it.
 *
 *   npm run story -- --slug opportunity --mode simple
 *   npm run story -- --slug opportunity --dry-run
 *
 * With LLM_PROVIDER=none (the default) it prints the snapshot hash and exits.
 */

import fs from "node:fs";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const value = (flag: string, fallback: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
};

const slug = value("--slug", "");
const mode = value("--mode", "simple");
const dryRun = args.includes("--dry-run");

if (!slug) {
  console.error("Usage: npm run story -- --slug <slug> [--mode simple|deep] [--dry-run]");
  process.exit(1);
}

const { getItemByAnyId } = await import("../lib/queries/items");
const { getCachedStory, saveStory } = await import("../lib/queries/story");
const {
  buildFactsSnapshot,
  factHash,
  generateNarration,
  providerFromEnv,
  PROMPT_VERSION,
} = await import("../lib/narration");

const item = await getItemByAnyId(slug);
if (!item) {
  console.error(`No curated artifact for ${slug}`);
  process.exit(1);
}

const snapshot = buildFactsSnapshot(item);
const hash = factHash(snapshot);
const config = providerFromEnv();

console.log(`item=${item.id} mode=${mode} prompt=${PROMPT_VERSION} hash=${hash}`);
console.log(`provider=${config.provider} model=${config.model}`);

const cached = await getCachedStory(item.id, mode, PROMPT_VERSION, hash);
if (cached) {
  console.log(`cache=hit story=${cached.id}`);
  console.log(cached.text);
  process.exit(0);
}

console.log("cache=miss");
if (config.provider === "none" || dryRun) {
  console.log(JSON.stringify(snapshot, null, 2));
  process.exit(0);
}

const text = await generateNarration(snapshot, config);
if (!text) {
  console.error("The provider returned no text.");
  process.exit(1);
}

const saved = await saveStory({
  id: item.id,
  mode,
  text,
  model: config.model,
  provider: config.provider,
  promptVersion: PROMPT_VERSION,
  factHash: hash,
  snapshot,
});
console.log(`cache=stored story=${saved?.id ?? "?"}`);
console.log(text);
