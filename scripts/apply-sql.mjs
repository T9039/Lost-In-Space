#!/usr/bin/env node
/**
 * Apply a .sql file through Neon's HTTPS endpoint (port 443), for networks that
 * block outbound TCP/5432.
 *
 *   npm run db:apply-sql -- db/migrations/001_nasa_3d_models.sql
 *   npm run db:apply-sql -- --check
 *
 * The file is split into statements outside quotes, dollar-quoted bodies and
 * comments, then sent as one non-interactive transaction. BEGIN/COMMIT lines
 * are removed because the transaction is implicit.
 */

import fs from "node:fs";
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

export function splitStatements(sql) {
  const statements = [];
  let buffer = "";
  let state = "normal";
  let dollar = "";
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (state === "line") {
      buffer += char;
      if (char === "\n") state = "normal";
      i += 1;
      continue;
    }
    if (state === "block") {
      buffer += char;
      if (char === "*" && next === "/") {
        buffer += next;
        i += 2;
        state = "normal";
        continue;
      }
      i += 1;
      continue;
    }
    if (state === "single") {
      buffer += char;
      if (char === "'" && next === "'") {
        buffer += next;
        i += 2;
        continue;
      }
      if (char === "'") state = "normal";
      i += 1;
      continue;
    }
    if (state === "double") {
      buffer += char;
      if (char === '"' && next === '"') {
        buffer += next;
        i += 2;
        continue;
      }
      if (char === '"') state = "normal";
      i += 1;
      continue;
    }
    if (state === "dollar") {
      if (sql.startsWith(dollar, i)) {
        buffer += dollar;
        i += dollar.length;
        state = "normal";
        continue;
      }
      buffer += char;
      i += 1;
      continue;
    }

    if (char === "-" && next === "-") {
      buffer += char + next;
      i += 2;
      state = "line";
      continue;
    }
    if (char === "/" && next === "*") {
      buffer += char + next;
      i += 2;
      state = "block";
      continue;
    }
    if (char === "'") {
      buffer += char;
      i += 1;
      state = "single";
      continue;
    }
    if (char === '"') {
      buffer += char;
      i += 1;
      state = "double";
      continue;
    }
    if (char === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollar = match[0];
        buffer += dollar;
        i += dollar.length;
        state = "dollar";
        continue;
      }
    }
    if (char === ";") {
      if (buffer.trim()) statements.push(buffer.trim());
      buffer = "";
      i += 1;
      continue;
    }

    buffer += char;
    i += 1;
  }

  if (buffer.trim()) statements.push(buffer.trim());
  return statements.filter((statement) => !/^(BEGIN|COMMIT)$/i.test(statement.trim()));
}

const args = process.argv.slice(2);
loadEnv(".env.local");
loadEnv(".env");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(url);

if (args[0] === "--check") {
  const rows = await sql`SELECT current_user AS who, current_database() AS db`;
  console.log(`HTTPS SQL ok: user=${rows[0]?.who} db=${rows[0]?.db}`);
  process.exit(0);
}

const file = args[0];
if (!file) {
  console.error("Usage: node scripts/apply-sql.mjs <file.sql> | --check");
  process.exit(1);
}

const statements = splitStatements(fs.readFileSync(file, "utf8"));
if (statements.length === 0) {
  console.log(`${file}: no statements`);
  process.exit(0);
}

try {
  await sql.transaction((txn) => statements.map((statement) => txn.query(statement)));
  console.log(`${file}: applied ${statements.length} statement(s) over HTTPS`);
} catch (error) {
  console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
