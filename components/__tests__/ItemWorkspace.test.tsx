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

function render(edges: LineageEdge[]) {
  assert.ok(item);
  return renderToStaticMarkup(
    createElement(
      CompareProvider,
      null,
      createElement(ItemWorkspace, { item, sources, peers, edges })
    )
  );
}

test("ItemWorkspace renders abandonment, lineage and provenance", () => {
  const html = render([]);
  assert.match(html, /Why it was left/);
  assert.match(html, /Lineage/);
  assert.match(html, /No curated parent\/child edges yet/);
  assert.match(html, /Provenance/);
  assert.match(html, /PIA20285|Potts/);
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
