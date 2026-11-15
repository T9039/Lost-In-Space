#!/usr/bin/env node
/**
 * Diagnose desktop -> database connectivity.
 *
 *   npm run db:check
 *
 * It reports which transport the runtime will pick, whether native TCP/5432 is
 * reachable, and whether SQL over HTTPS works. No credentials are printed.
 */

import fs from "node:fs";
import net from "node:net";
import { neon } from "@neondatabase/serverless";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("DATABASE_URL is not a valid URL.");
  process.exit(1);
}

const host = parsed.hostname;
const explicit = process.env.DB_DRIVER?.trim().toLowerCase();
const driver =
  explicit === "pg" || explicit === "tcp"
    ? "pg"
    : explicit === "neon" || explicit === "neon-http" || explicit === "http"
      ? "neon-http"
      : host.endsWith(".neon.tech")
        ? "neon-http"
        : "pg";

function probeTcp(hostname, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: hostname, port });
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

console.log(`host        ${host}`);
console.log(`driver      ${driver} (${driver === "neon-http" ? "HTTPS/443" : "native TCP/5432"})`);

const tcp = await probeTcp(host, 5432);
console.log(`TCP 5432    ${tcp ? "reachable" : "blocked or filtered"}`);

const started = Date.now();
try {
  const sql = neon(url);
  const rows = await sql`SELECT current_user AS who, current_database() AS db`;
  console.log(`HTTPS SQL   ok (${Date.now() - started} ms, db=${rows[0]?.db ?? "?"})`);
} catch (error) {
  console.log(`HTTPS SQL   failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

if (!tcp && driver === "neon-http") {
  console.log(
    "\nNative TCP/5432 is blocked on this network. The Next.js app uses the Neon\n" +
      "HTTPS driver automatically. `psql`, `pg_dump` and the Python ETL need a\n" +
      "network or tunnel that permits 5432, unless they are run on the database host."
  );
}
