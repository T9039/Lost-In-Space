import { query } from "@/lib/db";
import { toSource, type SourceRow } from "@/lib/contract";
import type { Source } from "@/lib/types";

const SOURCE_COLUMNS = `
  source_id, name, homepage_url, license_name, license_url, citation
`;

export async function listSources(): Promise<Source[]> {
  const rows = await query<SourceRow>(`SELECT ${SOURCE_COLUMNS} FROM source ORDER BY name`);
  return rows.map(toSource);
}

export async function sourcesForIds(ids: string[]): Promise<Source[]> {
  if (ids.length === 0) return [];
  const rows = await query<SourceRow>(
    `SELECT ${SOURCE_COLUMNS}
       FROM source
      WHERE source_id = ANY($1::text[])
      ORDER BY name`,
    [ids]
  );
  return rows.map(toSource);
}
