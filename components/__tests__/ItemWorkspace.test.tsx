import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ItemWorkspace from "../ItemWorkspace";
import { CompareProvider } from "../CompareProvider";
import { items, sources } from "../../lib/fixtures";
import type { LineageEdge } from "../../lib/types";

const item = items.find((candidate) => candidate.id === "opportunity");
const peers = items.filter((candidate) => candidate.id !== "opportunity");

function render(edges: LineageEdge[], gp = null) {
  assert.ok(item);
  return renderToStaticMarkup(
    createElement(
      CompareProvider,
      null,
      createElement(ItemWorkspace, { item, sources, peers, edges, gp })
    )
  );
}

test("ItemWorkspace renders abandonment, lineage and provenance", () => {
  const html = render([]);
  assert.match(html, /Why it was left/);
  assert.match(html, /Lineage/);
  assert.match(html, /No curated parent\/child edges yet/);
  assert.match(html, /Provenance/);
  assert.match(html, /LAST KNOWN POSITION/);
  assert.match(html, /-2\.2500°/);
  assert.match(html, /PIA20285|Potts/);
});

test("ItemWorkspace shows an element epoch and age when GP data exists", () => {
  const orbiting = items.find((candidate) => candidate.id === "skylab-debris");
  assert.ok(orbiting);
  const html = renderToStaticMarkup(
    createElement(
      CompareProvider,
      null,
      createElement(ItemWorkspace, {
        item: orbiting,
        sources,
        peers,
        edges: [],
        gp: {
          satcat_no: 6633,
          epoch: "2026-11-15T10:00:00.000Z",
          fetched_at: "2026-11-15T10:05:00.000Z",
          age: "2 h ago",
          position: { latitude: 1.2, longitude: 103.4, altitudeKm: 420, velocityKmS: 7.66 },
        },
      })
    )
  );
  assert.match(html, /LIVE ELEMENT SET/);
  assert.match(html, /Element epoch 2026-11-15 10:00 UTC/);
  assert.match(html, /2 h ago/);
});

test("ItemWorkspace renders curated lineage edges", () => {
  const html = render([
    {
      kind: "relation",
      label: "deployed_from",
      via: null,
      parent_id: "apollo-15-rover",
      parent_slug: "apollo-15-rover",
      parent_name: "Apollo 15 Lunar Roving Vehicle",
      child_id: "opportunity",
      child_slug: "opportunity",
      child_name: "Opportunity Rover",
    },
  ]);
  assert.match(html, /Apollo 15 Lunar Roving Vehicle/);
  assert.match(html, /Opportunity Rover/);
  assert.match(html, /deployed_from/);
});
