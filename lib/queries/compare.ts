import { query } from "@/lib/db";
import { compareItems, type CompareResult, type SpecRow } from "@/lib/compare";
import type { Item } from "@/lib/types";
import { getItemByAnyId } from "./items";

export type CompareDepth = "simple" | "deep";

export interface CompareOutcome {
  a: Item | null;
  b: Item | null;
  result: CompareResult | null;
}

interface SpecDiffRow {
  key: string;
  a: string;
  b: string;
  same: boolean;
  shared_count: string | number;
  different_count: string | number;
}

interface SpecDiff {
  specs: SpecRow[];
  sharedCount: number;
  differentCount: number;
}

/**
 * The spec join and the same/different arithmetic happen in PostgreSQL, not in
 * the browser. Values still come from the database-owned card fields; this is
 * presentation-free.
 */
export async function diffSpecsInSql(a: Item["specs"], b: Item["specs"]): Promise<SpecDiff> {
  const rows = await query<SpecDiffRow>(
    `WITH a AS (SELECT key, value FROM jsonb_each_text($1::jsonb)),
          b AS (SELECT key, value FROM jsonb_each_text($2::jsonb))
     SELECT COALESCE(a.key, b.key)              AS key,
            COALESCE(a.value, '—')              AS a,
            COALESCE(b.value, '—')              AS b,
            a.value IS NOT DISTINCT FROM b.value AS same,
            count(*) FILTER (WHERE a.value IS NOT DISTINCT FROM b.value) OVER ()::int AS shared_count,
            count(*) FILTER (WHERE a.value IS DISTINCT FROM b.value) OVER ()::int     AS different_count
       FROM a
       FULL JOIN b ON a.key = b.key
      ORDER BY 1`,
    [JSON.stringify(a), JSON.stringify(b)]
  );

  return {
    specs: rows.map(({ key, a: av, b: bv, same }) => ({ key, a: av, b: bv, same })),
    sharedCount: Number(rows[0]?.shared_count ?? 0),
    differentCount: Number(rows[0]?.different_count ?? 0),
  };
}

/**
 * Deterministic comparison. `depth` is presentation only: it must not alter
 * the item records or the diff. No narration is read or produced.
 */
export async function compareByIds(
  aId: string,
  bId: string,
  _depth: CompareDepth
): Promise<CompareOutcome> {
  const [a, b] = await Promise.all([getItemByAnyId(aId), getItemByAnyId(bId)]);
  if (!a || !b) return { a, b, result: null };

  const base = compareItems(a, b);
  const diff = await diffSpecsInSql(a.specs, b.specs);
  return { a, b, result: { ...base, ...diff } };
}
