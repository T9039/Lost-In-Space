import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

if (!process.env.DATABASE_URL && fs.existsSync(".env.local")) {
  const match = fs
    .readFileSync(".env.local", "utf8")
    .match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (match) process.env.DATABASE_URL = match[1];
}

const hasDatabase = Boolean(process.env.DATABASE_URL);

test("listItems reads the curated archive", { skip: !hasDatabase }, async () => {
  const { listItems } = await import("./items");
  const items = await listItems();
  assert.ok(items.length >= 12);
  const opportunity = items.find((item) => item.id === "opportunity");
  assert.ok(opportunity);
  assert.equal(opportunity.zone, "mars");
  assert.ok(opportunity.facts.length >= 1);
  assert.ok(opportunity.phases.length >= 1);
  assert.ok(opportunity.images.length >= 1);
  assert.equal(opportunity.model_url, "/models/opportunity.glb");
  assert.match(opportunity.model_credit ?? "", /NASA 3D Resources/);
});

test("zone filters and aliases resolve against PostgreSQL", { skip: !hasDatabase }, async () => {
  const { getItemByAnyId, listItems } = await import("./items");
  const mars = await listItems("mars");
  assert.ok(mars.length >= 4);
  assert.ok(mars.every((item) => item.zone === "mars"));

  const eagle = await getItemByAnyId("apollo-11-eagle");
  assert.equal(eagle?.id, "apollo-11-eagle");
  const canonical = await getItemByAnyId("apollo-11-lunar-module-eagle");
  assert.equal(canonical?.id, "apollo-11-eagle");
  assert.equal(await getItemByAnyId("not-an-artifact"), null);
});

test("trigram search narrows items in SQL", { skip: !hasDatabase }, async () => {
  const { listItems } = await import("./items");
  const results = await listItems(undefined, "opportunity");
  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => /opportunity/i.test(item.name)));
  assert.equal((await listItems(undefined, "no-such-artifact-xyz")).length, 0);
});

test("zones and sources come from the database", { skip: !hasDatabase }, async () => {
  const { listZones } = await import("./zones");
  const { listSources, sourcesForIds } = await import("./sources");
  const zones = await listZones();
  assert.equal(zones.length, 4);
  const counts = Object.fromEntries(zones.map((zone) => [zone.id, zone.item_count]));
  assert.ok(zones.reduce((sum, zone) => sum + zone.item_count, 0) >= 20);
  assert.equal(counts.moon, 7);
  assert.equal(counts.mars, 7);
  assert.equal(counts["earth-orbit"], 6);
  assert.equal(counts["deep-space"], 6);

  const sources = await listSources();
  assert.ok(sources.length >= 8);
  const nasa = await sourcesForIds(["nasa"]);
  assert.equal(nasa.length, 1);
  assert.match(nasa[0].title, /NASA/);
});

test("lineage returns phases, facts, sources and edges", { skip: !hasDatabase }, async () => {
  const { getLineage } = await import("./lineage");
  const lineage = await getLineage("opportunity");
  assert.ok(lineage);
  assert.equal(lineage.item_id, "opportunity");
  assert.ok(lineage.phases.length >= 1);
  assert.ok(lineage.facts.length >= 1);
  assert.ok(lineage.sources.length >= 1);
  assert.ok(Array.isArray(lineage.edges));
});
