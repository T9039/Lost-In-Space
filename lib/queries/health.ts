import { getDbInfo, query } from "@/lib/db";

export interface HealthReport {
  ok: true;
  database: "up";
  driver: string;
  host: string;
  artifacts: number;
  sources: number;
}

export async function checkHealth(): Promise<HealthReport> {
  const info = getDbInfo();
  const rows = await query<{ artifacts: string | number; sources: string | number }>(
    `SELECT (SELECT count(*) FROM artifact WHERE is_curated)::int AS artifacts,
            (SELECT count(*) FROM source)::int AS sources`
  );
  const row = rows[0];
  return {
    ok: true,
    database: "up",
    driver: info.driver,
    host: info.host,
    artifacts: Number(row?.artifacts ?? 0),
    sources: Number(row?.sources ?? 0),
  };
}
