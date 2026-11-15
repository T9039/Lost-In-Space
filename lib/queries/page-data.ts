import { buildZoneSummaries, toUiId } from "@/lib/contract";
import { items as fixtureItems, sources as fixtureSources } from "@/lib/fixtures";
import { unstable_cache } from "next/cache";
import { buildFactsSnapshot, factHash, PROMPT_VERSION } from "@/lib/narration";
import { formatAge } from "@/lib/time";
import type { GpSummary, Item, LineageEdge, NarrationSummary, Source, ZoneSummary } from "@/lib/types";
import { getItemByAnyId, listItems } from "./items";
import { getLatestGp } from "./gp";
import { listEdgesForItem } from "./lineage";
import { getCachedStory } from "./story";
import { listSources } from "./sources";
import { listZones } from "./zones";

export type PageDataSource = "database" | "fixtures";

export interface ItemPageData {
  item: Item;
  sources: Source[];
  peers: Item[];
  edges: LineageEdge[];
  gp: GpSummary | null;
  narration: NarrationSummary | null;
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

    const [items, sources, edges, gp, narration] = await Promise.all([
      listItems(),
      listSources(),
      listEdgesForItem(id),
      item.zone === "earth-orbit" ? getLatestGp(id) : Promise.resolve(null),
      getCachedStory(
        item.id,
        "simple",
        PROMPT_VERSION,
        factHash(buildFactsSnapshot(item))
      ),
    ]);
    return {
      item,
      sources,
      peers: items.filter((peer) => peer.id !== item.id),
      edges,
      gp: gp
        ? {
            satcat_no: gp.satcat_no,
            epoch: gp.epoch,
            fetched_at: gp.fetched_at,
            age: formatAge(gp.epoch),
            position: gp.position
              ? {
                  latitude: gp.position.latitude,
                  longitude: gp.position.longitude,
                  altitudeKm: gp.position.altitudeKm,
                  velocityKmS: gp.position.velocityKmS,
                }
              : null,
          }
        : null,
      narration,
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
    gp: null,
    narration: null,
    dataSource: "fixtures",
  };
}

export interface HomeData {
  items: Item[];
  zones: ZoneSummary[];
  dataSource: PageDataSource;
  error?: string;
}

const cachedHomeData = unstable_cache(
  async (): Promise<HomeData> => {
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
  },
  ["home-data"],
  { revalidate: 3600 }
);

export function getHomeData(): Promise<HomeData> {
  return cachedHomeData();
}

export interface SourcesPageData {
  sources: Source[];
  dataSource: PageDataSource;
  error?: string;
}

const cachedSourcesData = unstable_cache(
  async (): Promise<SourcesPageData> => {
  try {
    const sources = await listSources();
    if (sources.length === 0) throw new Error("database returned no sources");
    return { sources, dataSource: "database" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[sources] database read failed, using fixtures: ${message}`);
    return { sources: fixtureSources, dataSource: "fixtures", error: message };
  }
  },
  ["sources-data"],
  { revalidate: 3600 }
);

export function getSourcesPageData(): Promise<SourcesPageData> {
  return cachedSourcesData();
}

export interface ComparePageData {
  items: Item[];
  dataSource: PageDataSource;
  error?: string;
}

const cachedCompareData = unstable_cache(
  async (): Promise<ComparePageData> => {
  try {
    const items = await listItems();
    if (items.length === 0) throw new Error("database returned no curated artifacts");
    return { items, dataSource: "database" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[compare] database read failed, using fixtures: ${message}`);
    return { items: fixtureItems, dataSource: "fixtures", error: message };
  }
  },
  ["compare-data"],
  { revalidate: 3600 }
);

export function getComparePageData(): Promise<ComparePageData> {
  return cachedCompareData();
}
