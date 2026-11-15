import assert from "node:assert/strict";
import test from "node:test";

import { driverFor } from "./db";

function withDriver(value: string | undefined, fn: () => void) {
  const previous = process.env.DB_DRIVER;
  if (value === undefined) delete process.env.DB_DRIVER;
  else process.env.DB_DRIVER = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.DB_DRIVER;
    else process.env.DB_DRIVER = previous;
  }
}

test("Neon hosts use HTTPS by default", () => {
  withDriver(undefined, () => {
    assert.equal(
      driverFor("postgresql://u:p@ep-example-pooler.c-2.sa-east-1.aws.neon.tech/db"),
      "neon-http"
    );
  });
});

test("native PostgreSQL hosts use the pg pool by default", () => {
  withDriver(undefined, () => {
    assert.equal(driverFor("postgres://u:p@localhost:5433/db"), "pg");
    assert.equal(driverFor("postgres://u:p@db.render.internal/db"), "pg");
  });
});

test("DB_DRIVER overrides auto-detection", () => {
  withDriver("pg", () => {
    assert.equal(driverFor("postgres://u:p@x.neon.tech/db"), "pg");
  });
  withDriver("neon-http", () => {
    assert.equal(driverFor("postgres://u:p@localhost/db"), "neon-http");
  });
});

test("a malformed URL falls back to the native pool", () => {
  withDriver(undefined, () => {
    assert.equal(driverFor("not a url"), "pg");
  });
});
