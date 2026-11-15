import assert from "node:assert/strict";
import test from "node:test";

import {
  buildItem,
  buildZoneSummaries,
  derivePhaseKey,
  deriveStatus,
  deriveType,
  toDbSlug,
  toDbZone,
  toSourceKind,
  toUiId,
  toZone,
  type CardRow,
  type FactRow,
  type MissionRow,
  type MediaRow,
  type TimelineRow,
} from "./contract";

const card: CardRow = {
  artifact_id: "00000000-0000-0000-0000-000000000001",
  slug: "opportunity",
  canonical_name: "Opportunity Rover",
  short_name: "Opportunity",
  primary_zone: "mars",
  sat_type_raw: "P   D      D",
  mass_kg: "185.000",
  dry_mass_kg: "185.000",
  phase_count: 2,
  first_start: "2003-07-08T04:36:00.000Z",
  last_end: "2004-01-20T21:50:00.000Z",
  current_status: "EAO",
  primary_location_name: "Opportunity Rover site",
  primary_body: "Mars",
  latitude_deg: -1.9483,
  longitude_deg: -5.5258,
  satcat_no: "27849",
  cospar_id: "2003-032A",
};

const mission: MissionRow = {
  slug: "opportunity",
  mission_name: "Mars Exploration Rover B (Opportunity)",
  program: "Mars Exploration Program",
  summary_text: "A rover that far outlived its design life.",
  abandonment_reason: "Contact was lost after a planet-wide dust storm in June 2018.",
  result_code: null,
  source_id: "curated",
};

const facts: FactRow[] = [
  {
    slug: "opportunity",
    fact_id: 17,
    fact_type: "history",
    fact_text: "Opportunity landed in Meridiani Planum on 25 January 2004.",
    value: null,
    source_id: "nasa",
    source_url: "https://science.nasa.gov/mission/mer-opportunity/",
  },
];

const media: MediaRow[] = [
  {
    slug: "opportunity",
    media_id: 1,
    url: "/models/opportunity.glb",
    title: "Opportunity 3D model",
    credit: "NASA 3D Resources — Opportunity",
    media_type: "model",
    is_primary: false,
    source_id: "nasa_3d",
  },
];

const timeline: TimelineRow[] = [
  {
    slug: "opportunity",
    seq: 1,
    phase_key: "S27849:1",
    launch_id: "2003-032",
    start_best: "2003-07-08T04:36:00.000Z",
    end_best: "2004-01-20T21:50:00.000Z",
    status_code: "DSA",
    status_description: "Attached to the parent while passing the deep-space boundary.",
    dest_raw: "D00815",
    zone: "mars",
  },
  {
    slug: "opportunity",
    seq: 2,
    phase_key: "D00815:1",
    launch_id: null,
    start_best: "2004-01-20T21:50:00.000Z",
    end_best: null,
    status_code: "EAO",
    status_description: "Escape while attached to the parent.",
    dest_raw: "Mars",
    zone: "mars",
  },
];

test("zone mapping round-trips the two hyphenated zones", () => {
  assert.equal(toZone("earth_orbit"), "earth-orbit");
  assert.equal(toZone("deep_space"), "deep-space");
  assert.equal(toDbZone("earth-orbit"), "earth_orbit");
  assert.equal(toDbZone("deep-space"), "deep_space");
  assert.equal(toZone("other"), null);
});

test("legacy UI ids resolve to database slugs and back", () => {
  assert.equal(toDbSlug("apollo-11-eagle"), "apollo-11-lunar-module-eagle");
  assert.equal(toDbSlug("skylab-debris"), "skylab");
  assert.equal(toUiId("apollo-11-lunar-module-eagle"), "apollo-11-eagle");
  assert.equal(toUiId("opportunity"), "opportunity");
});

test("status is derived from phase code and mission outcome", () => {
  const base = { slug: "x", primary_zone: "mars" as const };
  assert.equal(deriveStatus({ ...base, current_status: "R" }, "Abandoned"), "destroyed");
  assert.equal(deriveStatus({ ...base, current_status: "EAO" }, null), "active");
  assert.equal(
    deriveStatus({ ...base, current_status: "EAO" }, "Contact was lost in 2018."),
    "inactive"
  );
  assert.equal(
    deriveStatus({ ...base, current_status: "EAO" }, "Left on the Moon at the landing site."),
    "derelict"
  );
});

test("phase keys separate launch, work and the final state", () => {
  const launch = { seq: 1, launch_id: "2003-032", status_code: "DSA" };
  const final = { seq: 2, launch_id: null, status_code: "EAO" };
  const destroyed = { seq: 2, launch_id: null, status_code: "R" };
  assert.equal(derivePhaseKey(launch, false, "Left behind"), "launched");
  assert.equal(derivePhaseKey(final, true, "Left behind"), "abandoned");
  assert.equal(derivePhaseKey(final, true, null), "still-there");
  assert.equal(derivePhaseKey(destroyed, true, null), "abandoned");
});

test("buildItem maps database rows without reading story text", () => {
  const item = buildItem({ card, mission, facts, media: [], timeline });

  assert.equal(item.id, "opportunity");
  assert.equal(item.zone, "mars");
  assert.equal(item.type, "rover");
  assert.equal(item.status, "inactive");
  assert.equal(item.years_active, "2003 – 2004");
  assert.equal(item.specs["Launch mass"], "185 kg");
  assert.match(item.catalog ?? "", /SATCAT 27849/);
  assert.equal(item.location.lat, -1.9483);
  assert.equal(item.facts[0].kind, "mission");
  assert.equal(item.facts[0].claim, facts[0].fact_text);
  assert.deepEqual(
    item.phases.map((phase) => phase.key),
    ["launched", "abandoned"]
  );
  assert.equal(item.model_url, "/models/opportunity.glb");
  assert.equal("story" in item, false);
});

test("media model rows supply the model URL and credit", () => {
  const item = buildItem({ card, mission, facts, media, timeline });
  assert.equal(item.model_url, "/models/opportunity.glb");
  assert.equal(item.model_credit, "NASA 3D Resources — Opportunity");
  assert.equal(item.images.length, 0);
});

test("source kinds and zone summaries are deterministic", () => {
  assert.equal(toSourceKind("nasa_images", "NASA Image and Video Library"), "image");
  assert.equal(toSourceKind("nasa", "NASA mission pages"), "mission-page");

  const item = buildItem({ card, mission, facts, media: [], timeline });
  const zones = buildZoneSummaries([item]);
  assert.equal(zones.length, 4);
  assert.equal(zones.find((zone) => zone.id === "mars")?.item_count, 1);
  assert.equal(zones.find((zone) => zone.id === "moon")?.item_count, 0);
});


test("new curated slugs have explicit hardware types", () => {
  assert.equal(
    deriveType({ slug: "apollo-17-lunar-roving-vehicle", primary_zone: "moon", sat_type_raw: "PX-LD--" }),
    "rover"
  );
  assert.equal(
    deriveType({ slug: "apollo-15-lunar-module-falcon", primary_zone: "moon", sat_type_raw: "PP HD" }),
    "lander"
  );
  assert.equal(deriveType({ slug: "juno", primary_zone: "deep_space", sat_type_raw: "P" }), "orbiter");
  assert.equal(deriveType({ slug: "voyager-2", primary_zone: "deep_space", sat_type_raw: "P" }), "probe");
});


test("Mars and Earth-orbit additions have explicit types", () => {
  assert.equal(deriveType({ slug: "spirit", primary_zone: "mars", sat_type_raw: "P" }), "rover");
  assert.equal(deriveType({ slug: "phoenix", primary_zone: "mars", sat_type_raw: "P" }), "lander");
  assert.equal(deriveType({ slug: "curiosity", primary_zone: "mars", sat_type_raw: "P" }), "rover");
  assert.equal(deriveType({ slug: "mir", primary_zone: "earth_orbit", sat_type_raw: "P" }), "orbiter");
  assert.equal(deriveType({ slug: "envisat", primary_zone: "earth_orbit", sat_type_raw: "P" }), "orbiter");
});
