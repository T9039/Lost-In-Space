import { query } from "@/lib/db";
import { toDbSlug, toUiId } from "@/lib/contract";
import { propagateOmm, type OmmRecord, type OrbitPosition } from "@/lib/orbit";

interface GpRow {
  slug: string;
  canonical_name: string;
  satcat_no: string | number;
  epoch: string | Date;
  fetched_at: string | Date;
  raw_omm: OmmRecord;
}

export interface GpResponse {
  item_id: string;
  name: string;
  satcat_no: number;
  epoch: string;
  fetched_at: string;
  omm: OmmRecord;
  position: OrbitPosition | null;
}

/** Latest CelesTrak OMM element set for one curated Earth-orbit artifact. */
export async function getLatestGp(id: string): Promise<GpResponse | null> {
  const rows = await query<GpRow>(
    `SELECT a.slug,
            a.canonical_name,
            ac.value::bigint AS satcat_no,
            g.epoch,
            g.fetched_at,
            g.raw_omm
       FROM artifact a
       JOIN artifact_catalog_id ac
         ON ac.artifact_id = a.artifact_id
        AND ac.scheme = 'SATCAT'
        AND ac.value ~ '^[0-9]+$'
       JOIN LATERAL (
           SELECT epoch, fetched_at, raw_omm
             FROM gp_element
            WHERE satcat_no = ac.value::bigint
            ORDER BY epoch DESC
            LIMIT 1
       ) g ON true
      WHERE a.slug = $1
      LIMIT 1`,
    [toDbSlug(id)]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    item_id: toUiId(row.slug),
    name: row.canonical_name,
    satcat_no: Number(row.satcat_no),
    epoch: new Date(row.epoch).toISOString(),
    fetched_at: new Date(row.fetched_at).toISOString(),
    omm: row.raw_omm,
    position: row.raw_omm ? propagateOmm(row.raw_omm) : null,
  };
}
