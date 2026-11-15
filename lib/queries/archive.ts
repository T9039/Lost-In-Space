import { buildZoneSummaries } from "@/lib/contract";
import { items as fixtureItems } from "@/lib/fixtures";
import type { Item, ZoneSummary } from "@/lib/types";
import { listItems } from "./items";
import { listZones } from "./zones";

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
export async function getArchiveData(search?: string): Promise<ArchiveData> {
  const term = search?.trim();
  try {
    const [items, zones] = await Promise.all([listItems(undefined, term), listZones()]);
    if (items.length === 0 && !term) throw new Error("database returned no curated artifacts");
    return { items, zones, dataSource: "database" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[archive] database read failed, using fixtures: ${message}`);
    const needle = term?.toLowerCase();
    const items = needle
      ? fixtureItems.filter((item) =>
          `${item.name} ${item.short_name} ${item.type} ${item.location.label}`
            .toLowerCase()
            .includes(needle)
        )
      : fixtureItems;
    return {
      items,
      zones: buildZoneSummaries(fixtureItems),
      dataSource: "fixtures",
      error: message,
    };
  }
}
