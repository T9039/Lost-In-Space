import assert from "node:assert/strict";
import test from "node:test";

import { compareItems } from "./compare";
import { items } from "./fixtures";

const opportunity = items.find((item) => item.id === "opportunity");
const insight = items.find((item) => item.id === "insight");

test("comparison is deterministic and grounded in the item records", () => {
  assert.ok(opportunity);
  assert.ok(insight);

  const result = compareItems(opportunity, insight);
  assert.equal(result.a.id, "opportunity");
  assert.equal(result.b.id, "insight");
  assert.ok(result.specs.length > 0);
  assert.equal(result.sharedCount + result.differentCount, result.specs.length);
  assert.ok(result.specs.every((row) => row.same === (row.a === row.b)));
  assert.ok(result.factsByKind.length > 0);
  assert.ok(result.highlights.length > 0);
  assert.equal("story" in result, false);
});
