import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/**
 * One lazy database handle for the server.
 *
 * Two transports, one query interface:
 *
 *   neon-http  @neondatabase/serverless, SQL over HTTPS (port 443)
 *   pg         node-postgres over the native protocol (port 5432)
 *
 * The desktop network used for development blocks outbound TCP/5432, so a
 * Neon URL is sent over HTTPS by default. `DB_DRIVER=pg` forces the TCP pool
 * (Render, a local Docker database, or a network that allows 5432).
 *
 * Nothing here may be imported by a client component.
 */

export type DbDriver = "neon-http" | "pg";

type QueryFn = <T>(text: string, params?: readonly unknown[]) => Promise<T[]>;

interface DbHandle {
  driver: DbDriver;
  host: string;
  query: QueryFn;
}

let handle: DbHandle | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and set the Neon or PostgreSQL connection string."
    );
  }
  return url;
}

export function driverFor(url: string): DbDriver {
  const explicit = process.env.DB_DRIVER?.trim().toLowerCase();
  if (explicit === "neon" || explicit === "neon-http" || explicit === "http") {
    return "neon-http";
  }
  if (explicit === "pg" || explicit === "tcp") {
    return "pg";
  }

  // Auto: Neon's HTTP endpoint is the safest default because it only needs
  // outbound HTTPS. Anything else (Render, Docker, a VPS) speaks the native
  // protocol over the pool.
  try {
    return new URL(url).hostname.endsWith(".neon.tech") ? "neon-http" : "pg";
  } catch {
    return "pg";
  }
}

function poolFor(url: string): Pool {
  const sslRequired = /sslmode=(require|verify-ca|verify-full)/i.test(url);
  return new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
  });
}

function createHandle(url: string): DbHandle {
  const driver = driverFor(url);
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "unknown";
    }
  })();

  if (driver === "neon-http") {
    const sql = neon(url);
    return {
      driver,
      host,
      query: async <T>(text: string, params: readonly unknown[] = []) =>
        (await sql.query(text, params as unknown[])) as T[],
    };
  }

  const pool = poolFor(url);
  return {
    driver,
    host,
    query: async <T>(text: string, params: readonly unknown[] = []) => {
      const result = await pool.query(text, params as unknown[]);
      return result.rows as T[];
    },
  };
}

export function getDb(): DbHandle {
  if (!handle) handle = createHandle(connectionString());
  return handle;
}

export function getDbInfo(): { driver: DbDriver; host: string } {
  const db = getDb();
  return { driver: db.driver, host: db.host };
}

export function query<T>(text: string, params: readonly unknown[] = []): Promise<T[]> {
  return getDb().query<T>(text, params);
}

export async function ping(): Promise<void> {
  await query<{ ok: number }>("select 1 as ok");
}

/** Reset the cached handle. Used by tests and by a process that changes env. */
export function resetDb(): void {
  handle = null;
}
