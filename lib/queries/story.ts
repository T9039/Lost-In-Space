import { query } from "@/lib/db";
import { toDbSlug } from "@/lib/contract";
import type { FactsSnapshot } from "@/lib/narration";
import type { NarrationSummary } from "@/lib/types";

interface StoryRow {
  story_id: string | number;
  slug: string;
  text: string;
  model: string | null;
  prompt_version: string;
  fact_hash: string;
  facts_snapshot: FactsSnapshot;
  created_at: string | Date;
}

function toSummary(row: StoryRow): NarrationSummary {
  return {
    id: String(row.story_id),
    text: row.text,
    model: row.model,
    prompt_version: row.prompt_version,
    fact_hash: row.fact_hash,
    is_ai_generated: true,
    facts_used: (row.facts_snapshot?.facts ?? []).map((fact) => fact.id),
    created_at: new Date(row.created_at).toISOString(),
  };
}

export async function getCachedStory(
  id: string,
  mode: string,
  promptVersion: string,
  factHash: string
): Promise<NarrationSummary | null> {
  const rows = await query<StoryRow>(
    `SELECT s.story_id, a.slug, s.text, s.model, s.prompt_version,
            s.fact_hash, s.facts_snapshot, s.created_at
       FROM story s
       JOIN artifact a ON a.artifact_id = s.artifact_id
      WHERE a.slug = $1
        AND s.mode = $2
        AND s.prompt_version = $3
        AND s.fact_hash = $4
      LIMIT 1`,
    [toDbSlug(id), mode, promptVersion, factHash]
  );
  return rows[0] ? toSummary(rows[0]) : null;
}

export async function saveStory(input: {
  id: string;
  mode: string;
  text: string;
  model: string;
  provider: string;
  promptVersion: string;
  factHash: string;
  snapshot: FactsSnapshot;
}): Promise<NarrationSummary | null> {
  const rows = await query<StoryRow>(
    `WITH artifact_row AS (
       SELECT artifact_id FROM artifact WHERE slug = $1
     ), inserted AS (
       INSERT INTO story (
         artifact_id, mode, text, model, prompt_version,
         is_ai_generated, fact_hash, facts_snapshot
       )
       SELECT artifact_id, $2, $3, $4, $5, true, $6, $7::jsonb
         FROM artifact_row
       ON CONFLICT DO NOTHING
       RETURNING story_id
     )
     SELECT s.story_id, a.slug, s.text, s.model, s.prompt_version,
            s.fact_hash, s.facts_snapshot, s.created_at
       FROM story s
       JOIN artifact a ON a.artifact_id = s.artifact_id
      WHERE a.slug = $1
        AND s.mode = $2
        AND s.prompt_version = $5
        AND s.fact_hash = $6
      LIMIT 1`,
    [
      toDbSlug(input.id),
      input.mode,
      input.text,
      `${input.provider}:${input.model}`,
      input.promptVersion,
      input.factHash,
      JSON.stringify(input.snapshot),
    ]
  );
  return rows[0] ? toSummary(rows[0]) : null;
}
