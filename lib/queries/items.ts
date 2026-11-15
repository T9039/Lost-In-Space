import { query } from "@/lib/db";
import {
  buildItem,
  toDbSlug,
  toDbZone,
  type CardRow,
  type FactRow,
  type MediaRow,
  type MissionRow,
  type TimelineRow,
} from "@/lib/contract";
import type { Item, Zone } from "@/lib/types";

const CARD_COLUMNS = `
    c.artifact_id,
    c.slug,
    c.canonical_name,
    c.short_name,
    c.primary_zone,
    c.sat_type_raw,
    c.mass_kg,
    c.dry_mass_kg,
    c.phase_count,
    c.first_start,
    c.last_end,
    c.current_status,
    c.primary_location_name,
    c.primary_body,
    c.latitude_deg,
    c.longitude_deg,
    c.satcat_no,
    cospar.value AS cospar_id
`;

const CARD_FROM = `
  FROM v_artifact_card c
  LEFT JOIN LATERAL (
      SELECT ac.value
      FROM artifact_catalog_id ac
      WHERE ac.artifact_id = c.artifact_id
        AND ac.scheme = 'COSPAR'
      ORDER BY ac.is_primary DESC, ac.valid_from DESC NULLS LAST
      LIMIT 1
  ) cospar ON true
`;

const CARD_ORDER = `
  ORDER BY
      CASE c.primary_zone
          WHEN 'moon'        THEN 1
          WHEN 'mars'        THEN 2
          WHEN 'earth_orbit' THEN 3
          WHEN 'deep_space'  THEN 4
          ELSE 5
      END,
      c.canonical_name
`;

function groupBySlug<T extends { slug: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.slug);
    if (list) list.push(row);
    else map.set(row.slug, [row]);
  }
  return map;
}

async function hydrate(cards: CardRow[]): Promise<Item[]> {
  if (cards.length === 0) return [];
  const slugs = cards.map((card) => card.slug);

  const [missionRows, factRows, mediaRows, timelineRows] = await Promise.all([
    query<MissionRow>(
      `SELECT a.slug, m.mission_name, m.program, m.summary_text,
              m.abandonment_reason, m.result_code, m.source_id
         FROM mission m
         JOIN artifact a ON a.artifact_id = m.artifact_id
        WHERE a.slug = ANY($1::text[])`,
      [slugs]
    ),
    query<FactRow>(
      `SELECT a.slug, f.fact_id, f.fact_type, f.fact_text, f.value,
              f.source_id, f.source_url
         FROM fact f
         JOIN artifact a ON a.artifact_id = f.artifact_id
        WHERE a.slug = ANY($1::text[])
        ORDER BY a.slug, f.fact_id`,
      [slugs]
    ),
    query<MediaRow>(
      `SELECT a.slug, m.media_id, m.url, m.title, m.credit, m.media_type,
              m.is_primary, m.source_id
         FROM media m
         JOIN artifact a ON a.artifact_id = m.artifact_id
        WHERE a.slug = ANY($1::text[])
        ORDER BY a.slug, m.is_primary DESC, m.media_id`,
      [slugs]
    ),
    query<TimelineRow>(
      `SELECT t.slug, t.seq, t.phase_key, t.launch_id, t.start_best, t.end_best,
              t.status_code, t.status_description, t.dest_raw, t.zone,
              ph.source_id
         FROM v_artifact_timeline t
         JOIN artifact a ON a.slug = t.slug
         JOIN artifact_phase ph ON ph.phase_key = t.phase_key
        WHERE t.slug = ANY($1::text[])
        ORDER BY t.slug, t.seq`,
      [slugs]
    ),
  ]);

  const missions = new Map(missionRows.map((row) => [row.slug, row]));
  const facts = groupBySlug(factRows);
  const media = groupBySlug(mediaRows);
  const timeline = groupBySlug(timelineRows);

  return cards.map((card) =>
    buildItem({
      card,
      mission: missions.get(card.slug) ?? null,
      facts: facts.get(card.slug) ?? [],
      media: media.get(card.slug) ?? [],
      timeline: timeline.get(card.slug) ?? [],
    })
  );
}

export async function listItems(zone?: Zone): Promise<Item[]> {
  const params: unknown[] = [];
  let zoneClause = "";
  if (zone) {
    params.push(toDbZone(zone));
    zoneClause = ` AND c.primary_zone = $${params.length}::zone_kind`;
  }

  const cards = await query<CardRow>(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM}
      WHERE c.is_curated = true
        AND c.primary_zone <> 'other'${zoneClause}
      ${CARD_ORDER}`,
    params
  );

  return hydrate(cards);
}

export async function getItemByAnyId(id: string): Promise<Item | null> {
  const dbSlug = toDbSlug(id);
  const cards = await query<CardRow>(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM}
      WHERE c.is_curated = true
        AND c.slug = $1`,
    [dbSlug]
  );
  const items = await hydrate(cards);
  return items[0] ?? null;
}
