import assert from "node:assert/strict";
import test from "node:test";

import { formatAge } from "./time";

const now = new Date("2026-11-15T12:00:00Z");

test("age labels are deterministic", () => {
  assert.equal(formatAge("2026-11-15T11:59:40Z", now), "just now");
  assert.equal(formatAge("2026-11-15T11:30:00Z", now), "30 min ago");
  assert.equal(formatAge("2026-11-15T09:00:00Z", now), "3 h ago");
  assert.equal(formatAge("2026-11-12T12:00:00Z", now), "3 days ago");
});

test("future and invalid epochs are handled", () => {
  assert.equal(formatAge("2026-11-15T13:00:00Z", now), "in 1 h");
  assert.equal(formatAge("not-a-date", now), "unknown age");
});
