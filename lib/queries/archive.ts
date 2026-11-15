import { buildZoneSummaries } from "@/lib/contract";
import { items as fixtureItems } from "@/lib/fixtures";
import type { Item, ZoneSummary } from "@/lib/types";
import { listItems } from "./items";

export type ArchiveDataSource = "database" | "fixtures";

export interface ArchiveData {
  items: Item[];
  zones: ZoneSummary[];
  dataSource: ArchiveDataSource;
  error?: string;
}

/**
 * The archive is the first DB-backed screen. If PostgreSQL is unreachable the
 * checked-in fixtures keep the page usable and the UI says so.
 */
export async function getArchiveData(): Promise<ArchiveData> {
  try {
    const items = await listItems();
    if (items.length === 0) throw new Error("database returned no curated artifacts");
    return { items, zones: buildZoneSummaries(items), dataSource: "database" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[archive] database read failed, using fixtures: ${message}`);
    return {
      items: fixtureItems,
      zones: buildZoneSummaries(fixtureItems),
      dataSource: "fixtures",
      error: message,
    };
  }
}
