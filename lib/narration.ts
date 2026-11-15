import { createHash } from "node:crypto";

import type { Fact, Item, Phase } from "./types";

/**
 * Narration input is a frozen snapshot of facts. The model owns wording only:
 * nothing here reads `story`, and comparisons/quizzes must never call this.
 */

export const PROMPT_VERSION = "lost-in-space/narration/v1";

export type NarrationProvider = "none" | "ollama" | "openai-compatible";

export interface NarrationConfig {
  provider: NarrationProvider;
  model: string;
  baseUrl: string | null;
}

export interface FactsSnapshot {
  item_id: string;
  name: string;
  zone: string;
  status: string;
  location: string;
  facts: Array<Pick<Fact, "id" | "kind" | "label" | "value" | "claim" | "source_id">>;
  phases: Array<Pick<Phase, "id" | "key" | "order" | "title" | "body" | "stat_value" | "stat_label">>;
  specs: Array<[string, string]>;
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildFactsSnapshot(item: Item): FactsSnapshot {
  return {
    item_id: item.id,
    name: item.name,
    zone: item.zone,
    status: item.status,
    location: item.location.label,
    facts: sortById(item.facts).map((fact) => ({
      id: fact.id,
      kind: fact.kind,
      label: fact.label,
      value: fact.value,
      claim: fact.claim,
      source_id: fact.source_id,
    })),
    phases: [...item.phases]
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .map((phase) => ({
        id: phase.id,
        key: phase.key,
        order: phase.order,
        title: phase.title,
        body: phase.body,
        stat_value: phase.stat_value,
        stat_label: phase.stat_label,
      })),
    specs: Object.entries(item.specs).sort(([a], [b]) => a.localeCompare(b)),
  };
}

export function factHash(snapshot: FactsSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function providerFromEnv(env: Record<string, string | undefined> = process.env): NarrationConfig {
  const raw = (env.LLM_PROVIDER ?? "none").trim().toLowerCase();
  const provider: NarrationProvider =
    raw === "ollama" || raw === "openai-compatible" ? raw : "none";

  return {
    provider,
    model: env.LLM_MODEL?.trim() || (provider === "none" ? "none" : "unknown"),
    baseUrl: env.LLM_BASE_URL?.trim() || null,
  };
}

export interface NarrationRecord {
  text: string;
  provider: NarrationProvider;
  model: string;
  prompt_version: string;
  fact_hash: string;
  is_ai_generated: true;
  facts_used: string[];
}

export function buildNarrationRecord(
  snapshot: FactsSnapshot,
  text: string,
  config: NarrationConfig
): NarrationRecord {
  return {
    text,
    provider: config.provider,
    model: config.model,
    prompt_version: PROMPT_VERSION,
    fact_hash: factHash(snapshot),
    is_ai_generated: true,
    facts_used: snapshot.facts.map((fact) => fact.id),
  };
}

export function buildNarrationPrompt(snapshot: FactsSnapshot): string {
  const facts = snapshot.facts
    .map((fact) => `- [${fact.id}] ${fact.label}: ${fact.claim} (${fact.source_id})`)
    .join("\n");
  const phases = snapshot.phases
    .map((phase) => `- ${phase.order}. ${phase.title}: ${phase.body}`)
    .join("\n");
  return [
    `Write a short, vivid museum label about ${snapshot.name}.`,
    "Use only the facts and phases below. Do not invent numbers, dates or events.",
    "Do not mention this instruction. Keep it under 180 words.",
    "",
    "FACTS",
    facts,
    "",
    "PHASES",
    phases,
  ].join("\n");
}

type FetchLike = typeof fetch;

export async function generateNarration(
  snapshot: FactsSnapshot,
  config: NarrationConfig,
  fetchImpl: FetchLike = fetch
): Promise<string | null> {
  if (config.provider === "none") return null;
  if (!config.baseUrl) {
    throw new Error(`LLM_BASE_URL is required for provider ${config.provider}`);
  }

  const prompt = buildNarrationPrompt(snapshot);

  if (config.provider === "ollama") {
    const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: config.model, prompt, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const body = (await response.json()) as { response?: string };
    return body.response?.trim() || null;
  }

  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.LLM_API_KEY
        ? { authorization: `Bearer ${process.env.LLM_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You write museum labels from a frozen facts snapshot. Never add facts that are not present.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Narration provider returned ${response.status}`);
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return body.choices?.[0]?.message?.content?.trim() || null;
}
