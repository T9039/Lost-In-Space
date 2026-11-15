import { sourceIdsForItem } from "@/lib/contract";
import type { LineageResponse } from "@/lib/types";
import { getItemByAnyId } from "./items";
import { sourcesForIds } from "./sources";

export async function getLineage(id: string): Promise<LineageResponse | null> {
  const item = await getItemByAnyId(id);
  if (!item) return null;

  const sources = await sourcesForIds(sourceIdsForItem(item));
  return {
    item_id: item.id,
    phases: item.phases,
    facts: item.facts,
    sources,
  };
}
