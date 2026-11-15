import { buildZoneSummaries, toUiId } from "@/lib/contract";
import { items as fixtureItems, sources as fixtureSources } from "@/lib/fixtures";
import type { Item, LineageEdge, Source, ZoneSummary } from "@/lib/types";
import { getItemByAnyId, listItems } from "./items";
import { listEdgesForItem } from "./lineage";
import { listSources } from "./sources";
import { listZones } from "./zones";

export type PageDataSource = "database" | "fixtures";

export interface ItemPageData {
  item: Item;
  sources: Source[];
  peers: Item[];
  edges: LineageEdge[];
  dataSource: PageDataSource;
}

/**
 * Item pages still fall back to fixtures, but resolve both the database slug
 * and the legacy UI id (`apollo-11-eagle`, `skylab-debris`). Archive links
 * therefore work while the remaining screens are migrated one at a time.
 */
export async function getItemPageData(id: string): Promise<ItemPageData | null> {
  try {
    const item = await getItemByAnyId(id);
    if (!item) return null;

    const [items, sources, edges] = await Promise.all([
      listItems(),
      listSources(),
      listEdgesForItem(id),
    ]);
    return {
      item,
      sources,
      peers: items.filter((peer) => peer.id !== item.id),
      edges,
      dataSource: "database",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[item] database read failed, using fixtures: ${message}`);
  }

  const uiId = toUiId(id);
  const item = fixtureItems.find((candidate) => candidate.id === id || candidate.id === uiId);
  if (!item) return null;

  return {
    item,
    sources: fixtureSources,
    peers: fixtureItems.filter((peer) => peer.id !== item.id),
    edges: [],
    dataSource: "fixtures",
  };
}

export interface HomeData {
  items: Item[];
  zones: ZoneSummary[];
  dataSource: PageDataSource;
  error?: string;
}

export async function getHomeData(): Promise<HomeData> {
  try {
    const [items, zones] = await Promise.all([listItems(), listZones()]);
    if (items.length === 0) throw new Error("database returned no curated artifacts");
    return { items, zones, dataSource: "database" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[home] database read failed, using fixtures: ${message}`);
    return {
      items: fixtureItems,
      zones: buildZoneSummaries(fixtureItems),
      dataSource: "fixtures",
      error: message,
    };
  }
}

export interface SourcesPageData {
  sources: Source[];
  dataSource: PageDataSource;
  error?: string;
}

export async function getSourcesPageData(): Promise<SourcesPageData> {
  try {
    const sources = await listSources();
    if (sources.length === 0) throw new Error("database returned no sources");
    return { sources, dataSource: "database" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[sources] database read failed, using fixtures: ${message}`);
    return { sources: fixtureSources, dataSource: "fixtures", error: message };
  }
}

export interface ComparePageData {
  items: Item[];
  dataSource: PageDataSource;
  error?: string;
}

export async function getComparePageData(): Promise<ComparePageData> {
  try {
    const items = await listItems();
    if (items.length === 0) throw new Error("database returned no curated artifacts");
    return { items, dataSource: "database" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[compare] database read failed, using fixtures: ${message}`);
    return { items: fixtureItems, dataSource: "fixtures", error: message };
  }
}
