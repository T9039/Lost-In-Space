import { query } from "@/lib/db";
import { sourceIdsForItem, toDbSlug, toUiId } from "@/lib/contract";
import type { LineageEdge, LineageResponse } from "@/lib/types";
import { getItemByAnyId } from "./items";
import { sourcesForIds } from "./sources";

interface EdgeRow {
  kind: string;
  label: string;
  via: string | null;
  parent_slug: string;
  parent_name: string;
  child_slug: string;
  child_name: string;
}

export async function getLineage(id: string): Promise<LineageResponse | null> {
  const item = await getItemByAnyId(id);
  if (!item) return null;

  const [sources, edgeRows] = await Promise.all([
    sourcesForIds(sourceIdsForItem(item)),
    query<EdgeRow>(
      `SELECT e.kind,
              e.label,
              e.via,
              parent.slug          AS parent_slug,
              parent.canonical_name AS parent_name,
              child.slug           AS child_slug,
              child.canonical_name AS child_name
         FROM v_artifact_edge e
         JOIN artifact parent ON parent.artifact_id = e.parent_id
         JOIN artifact child  ON child.artifact_id  = e.child_id
        WHERE parent.slug = $1 OR child.slug = $1
        ORDER BY e.kind, e.label, parent.canonical_name, child.canonical_name`,
      [toDbSlug(id)]
    ),
  ]);

  const edges: LineageEdge[] = edgeRows.map((row) => ({
    kind: row.kind,
    label: row.label,
    via: row.via,
    parent_id: toUiId(row.parent_slug),
    parent_slug: row.parent_slug,
    parent_name: row.parent_name,
    child_id: toUiId(row.child_slug),
    child_slug: row.child_slug,
    child_name: row.child_name,
  }));

  return {
    item_id: item.id,
    phases: item.phases,
    facts: item.facts,
    sources,
    edges,
  };
}
