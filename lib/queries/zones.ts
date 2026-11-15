import { query } from "@/lib/db";
import { toZone, type DbZone } from "@/lib/contract";
import { ZONES, type Zone, type ZoneSummary } from "@/lib/types";

interface ZoneCountRow {
  primary_zone: DbZone;
  item_count: string | number;
  hero_image: string | null;
}

const ZONE_ORDER: Zone[] = ["moon", "mars", "earth-orbit", "deep-space"];

export async function listZones(): Promise<ZoneSummary[]> {
  const rows = await query<ZoneCountRow>(
    `SELECT c.primary_zone,
            count(*)::int AS item_count,
            (array_agg(m.url ORDER BY m.is_primary DESC, m.media_id))[1] AS hero_image
       FROM v_artifact_card c
       LEFT JOIN media m
         ON m.artifact_id = c.artifact_id
        AND m.media_type = 'image'
      WHERE c.is_curated = true
        AND c.primary_zone <> 'other'
      GROUP BY c.primary_zone`
  );

  const counts = new Map<Zone, { count: number; hero?: string }>();
  for (const row of rows) {
    const zone = toZone(row.primary_zone);
    if (!zone) continue;
    counts.set(zone, {
      count: Number(row.item_count) || 0,
      hero: row.hero_image ?? undefined,
    });
  }

  return ZONE_ORDER.map((id) => ({
    id,
    label: ZONES[id].label,
    blurb: ZONES[id].blurb,
    item_count: counts.get(id)?.count ?? 0,
    hero_image: counts.get(id)?.hero,
  }));
}
