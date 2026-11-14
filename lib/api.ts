import { items, sources } from "./fixtures";
import { ZONES, type Item, type Source, type Zone, type ZoneSummary } from "./types";

/**
 * Every screen reads data through this file.
 * When the backend lands, set NEXT_PUBLIC_API_BASE and nothing else changes.
 *
 * Required endpoints (see hackathonWoes.md §6):
 *   GET  /api/zones
 *   GET  /api/items?zone=
 *   GET  /api/items/:id
 *   GET  /api/sources
 *   GET  /api/items/:id/lineage   (AGE/Cypher, backend side)
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const USING_MOCK = BASE === "";

async function get<T>(path: string, fallback: T): Promise<T> {
  if (USING_MOCK) return fallback;
  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[api] ${path} failed, using fixtures`, err);
    return fallback;
  }
}

export async function getSources(): Promise<Source[]> {
  return get("/api/sources", sources);
}

export async function getSource(id: string): Promise<Source | undefined> {
  const all = await getSources();
  return all.find((s) => s.id === id);
}

export async function getItems(zone?: Zone): Promise<Item[]> {
  const all = await get("/api/items", items);
  return zone ? all.filter((i) => i.zone === zone) : all;
}

export async function getItem(id: string): Promise<Item | null> {
  const all = await get("/api/items", items);
  return all.find((i) => i.id === id) ?? null;
}

export async function getZones(): Promise<ZoneSummary[]> {
  const all = await getItems();
  return (Object.keys(ZONES) as Zone[]).map((id) => {
    const inZone = all.filter((i) => i.zone === id);
    return {
      id,
      label: ZONES[id].label,
      blurb: ZONES[id].blurb,
      item_count: inZone.length,
      hero_image: inZone[0]?.images[0]?.src,
    };
  });
}
