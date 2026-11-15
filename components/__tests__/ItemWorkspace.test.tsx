import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ItemWorkspace from "../ItemWorkspace";
import { CompareProvider } from "../CompareProvider";
import { items, sources } from "../../lib/fixtures";
import type { LineageEdge, NarrationSummary } from "../../lib/types";

const item = items.find((candidate) => candidate.id === "opportunity");
const peers = items.filter((candidate) => candidate.id !== "opportunity");

function render(edges: LineageEdge[], gp = null, narration: NarrationSummary | null = null) {
  assert.ok(item);
  return renderToStaticMarkup(
    createElement(
      CompareProvider,
      null,
      createElement(ItemWorkspace, { item, sources, peers, edges, gp, narration })
    )
  );
}

test("ItemWorkspace renders the three-act story, location and archive photographs", () => {
  const html = render([]);
  assert.match(html, /THE MISSION &amp; THE MACHINE|MISSION STORY \/ THREE ACTS/);
  assert.match(html, /INTO THE UNKNOWN/);
  assert.match(html, /SILENT, NOT GONE/);
  assert.match(html, /dust storm/i);
  assert.match(html, /LAST RECORDED LOCATION/);
  assert.match(html, /-2\.2500°/);
  assert.match(html, /No linked carrier or related spacecraft is recorded/);
  assert.match(html, /PIA20285|Potts/);
});

test("ItemWorkspace shows live element age when GP data exists", () => {
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
        narration: null,
      })
    )
  );
  assert.match(html, /420 km altitude/);
  assert.match(html, /2 h ago/);
  assert.match(html, /15 November 2026/);
});

test("ItemWorkspace labels generated narration and links its facts", () => {
  const html = render([], null, {
    id: "1",
    text: "A generated museum label grounded in stored facts.",
    model: "ollama:llama3",
    prompt_version: "lost-in-space/narration/v1",
    fact_hash: "abc",
    is_ai_generated: true,
    facts_used: ["opp-f1", "opp-f2"],
    created_at: "2026-11-15T00:00:00.000Z",
  });
  assert.match(html, /AI generated/);
  assert.match(html, /2 facts used/);
  assert.match(html, /facts used ↗/);
  assert.match(html, /A generated museum label/);
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
  assert.match(html, /deployed from/);
});
