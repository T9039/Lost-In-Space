import { compareItems, type CompareResult } from "@/lib/compare";
import type { Item } from "@/lib/types";
import { getItemByAnyId } from "./items";

export type CompareDepth = "simple" | "deep";

export interface CompareOutcome {
  a: Item | null;
  b: Item | null;
  result: CompareResult | null;
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
  return { a, b, result: compareItems(a, b) };
}
