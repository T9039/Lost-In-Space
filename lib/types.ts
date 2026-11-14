/**
 * API CONTRACT — the frontend never reads Postgres or AGE directly.
 * These types are the shapes the backend must return (see lib/api.ts).
 *
 * The three "buckets" map 1:1 to the lead's tables:
 *   sources -> `sources`
 *   facts   -> `facts`   (each fact carries a source_id FK)
 *   phases  -> `phases`  (ordered story beats per item)
 */

export type Zone = "moon" | "mars" | "earth-orbit" | "deep-space";

export type ItemType = "rover" | "lander" | "orbiter" | "probe" | "stage";

export type ItemStatus = "inactive" | "derelict" | "active" | "destroyed";

export type PhaseKey = "built" | "launched" | "worked" | "abandoned" | "still-there";

export type SourceKind = "mission-page" | "image" | "model" | "press-kit";

export type FactKind = "spec" | "mission" | "discovery" | "legacy";

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: SourceKind;
}

export interface Fact {
  id: string;
  item_id: string;
  kind: FactKind;
  label: string;
  value: string;
  claim: string;
  source_id: string;
  phase_key?: PhaseKey;
}

export interface Phase {
  id: string;
  item_id: string;
  order: number;
  key: PhaseKey;
  title: string;
  body: string;
  stat_value: string;
  stat_label: string;
}

export interface ItemImage {
  src: string;
  caption: string;
  source_id: string;
}

export interface Item {
  id: string;
  name: string;
  short_name: string;
  zone: Zone;
  type: ItemType;
  years_active: string;
  status: ItemStatus;
  abandonment_reason: string;
  location: { label: string; lat?: number; lon?: number };
  specs: Record<string, string>;
  /** SATCAT / COSPAR identifier when the object has a tracked orbit. */
  catalog?: string;
  nasa_search_query: string;
  model_url?: string;
  model_credit?: string;
  images: ItemImage[];
  facts: Fact[];
  phases: Phase[];
}

export interface ZoneSummary {
  id: Zone;
  label: string;
  blurb: string;
  item_count: number;
  hero_image?: string;
}

export const ZONES: Record<Zone, { label: string; blurb: string }> = {
  moon: {
    label: "The Moon",
    blurb: "Landers, cars and footprints that never got cleaned up.",
  },
  mars: {
    label: "Mars",
    blurb: "Robots that went quiet but never came home.",
  },
  "earth-orbit": {
    label: "Earth Orbit",
    blurb: "Dead satellites and old space stations still circling us.",
  },
  "deep-space": {
    label: "Deep Space",
    blurb: "Probes that left the solar system and cannot turn back.",
  },
};
