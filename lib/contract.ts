import { imageProxySrc } from "./images";
import {
  ZONES,
  type Fact,
  type FactKind,
  type Item,
  type ItemImage,
  type ItemStatus,
  type ItemType,
  type Phase,
  type PhaseKey,
  type Source,
  type SourceKind,
  type Zone,
  type ZoneSummary,
} from "./types";

/**
 * Database -> UI contract.
 *
 * Pure functions only: no queries, no network, no generated text. The
 * database owns the facts (names, masses, dates, locations, statuses, media,
 * sources); this file decides how those facts are presented to the existing
 * `lib/types.ts` shapes.
 *
 * Rules that are easy to break:
 *   - a catalog number belongs to a phase, not to an artifact;
 *   - dates never gain precision, so year ranges are rendered as years;
 *   - `story` is never read here.
 */

/* ------------------------------------------------------------------ */
/* Database row shapes (aliases used by lib/queries)                   */
/* ------------------------------------------------------------------ */

export type DbZone = "moon" | "mars" | "earth_orbit" | "deep_space" | "other";

export interface CardRow {
  artifact_id: string;
  slug: string;
  canonical_name: string;
  short_name: string | null;
  primary_zone: DbZone;
  sat_type_raw: string | null;
  mass_kg: string | number | null;
  dry_mass_kg: string | number | null;
  phase_count: string | number | null;
  first_start: string | Date | null;
  last_end: string | Date | null;
  current_status: string | null;
  primary_location_name: string | null;
  primary_body: string | null;
  latitude_deg: number | string | null;
  longitude_deg: number | string | null;
  satcat_no: string | number | null;
  cospar_id: string | null;
}

export interface MissionRow {
  slug: string;
  mission_name: string | null;
  program: string | null;
  summary_text: string | null;
  abandonment_reason: string | null;
  result_code: string | null;
  source_id: string | null;
}

export interface FactRow {
  slug: string;
  fact_id: string | number;
  fact_type: string;
  fact_text: string;
  value: unknown;
  source_id: string;
  source_url: string | null;
}

export interface MediaRow {
  slug: string;
  media_id: string | number;
  url: string;
  title: string | null;
  credit: string | null;
  media_type: string | null;
  is_primary: boolean;
  source_id: string;
}

export interface TimelineRow {
  slug: string;
  seq: number | string;
  phase_key: string;
  launch_id: string | null;
  start_best: string | Date | null;
  end_best: string | Date | null;
  status_code: string | null;
  status_description: string | null;
  dest_raw: string | null;
  zone: DbZone | null;
  source_id?: string | null;
}

export interface SourceRow {
  source_id: string;
  name: string;
  homepage_url: string;
  license_name: string;
  license_url: string | null;
  citation: string;
}

/* ------------------------------------------------------------------ */
/* Identity aliases                                                    */
/* ------------------------------------------------------------------ */

/** Database slug -> the id the checked-in UI already links to. */
export const UI_ID_BY_DB_SLUG: Record<string, string> = {
  "apollo-11-lunar-module-eagle": "apollo-11-eagle",
  skylab: "skylab-debris",
};

/** UI id -> database slug. */
export const DB_SLUG_BY_UI_ID: Record<string, string> = Object.fromEntries(
  Object.entries(UI_ID_BY_DB_SLUG).map(([dbSlug, uiId]) => [uiId, dbSlug])
);

export function toUiId(dbSlug: string): string {
  return UI_ID_BY_DB_SLUG[dbSlug] ?? dbSlug;
}

export function toDbSlug(id: string): string {
  return DB_SLUG_BY_UI_ID[id] ?? id;
}

/* ------------------------------------------------------------------ */
/* Primitive mappings                                                  */
/* ------------------------------------------------------------------ */

const ZONE_ORDER: Zone[] = ["moon", "mars", "earth-orbit", "deep-space"];

export function isZone(value: string): value is Zone {
  return (ZONE_ORDER as string[]).includes(value);
}

export function toZone(value: DbZone | string | null): Zone | null {
  switch (value) {
    case "moon":
      return "moon";
    case "mars":
      return "mars";
    case "earth_orbit":
      return "earth-orbit";
    case "deep_space":
      return "deep-space";
    default:
      return null;
  }
}

export function toDbZone(value: Zone): DbZone {
  switch (value) {
    case "earth-orbit":
      return "earth_orbit";
    case "deep-space":
      return "deep_space";
    default:
      return value;
  }
}

const TYPE_BY_SLUG: Record<string, ItemType> = {
  "apollo-11-lunar-module-eagle": "lander",
  "apollo-15-rover": "rover",
  "surveyor-3": "lander",
  insight: "lander",
  opportunity: "rover",
  "perseverance-rover": "rover",
  "viking-lander-1": "lander",
  "hubble-space-telescope": "orbiter",
  skylab: "orbiter",
  "vanguard-1": "orbiter",
  "pioneer-10": "probe",
  "voyager-1": "probe",
  "apollo-12-lunar-module-intrepid": "lander",
  "apollo-15-lunar-module-falcon": "lander",
  "apollo-17-lunar-module-challenger": "lander",
  "apollo-17-lunar-roving-vehicle": "rover",
  "voyager-2": "probe",
  "pioneer-11": "probe",
  "new-horizons": "probe",
  juno: "orbiter",
  spirit: "rover",
  phoenix: "lander",
  curiosity: "rover",
  mir: "orbiter",
  envisat: "orbiter",
  "landsat-5": "orbiter",
};

export function deriveType(row: Pick<CardRow, "slug" | "primary_zone" | "sat_type_raw">): ItemType {
  const known = TYPE_BY_SLUG[row.slug];
  if (known) return known;

  const raw = (row.sat_type_raw ?? "").trim();
  if (row.primary_zone === "earth_orbit") return "orbiter";
  if (raw.includes("LD") || raw.includes("HD")) return "lander";
  if (row.primary_zone === "moon" || row.primary_zone === "mars") return "lander";
  return "probe";
}

const DESTROYED_STATUS = new Set(["R", "D", "F", "LF", "AF", "C", "AR", "AS", "ERR"]);

/**
 * The database stores GCAT phase codes, not an artifact-level status. Derive
 * the UI status from the final phase plus the curated mission outcome.
 */
export function deriveStatus(
  row: Pick<CardRow, "slug" | "primary_zone" | "current_status">,
  abandonmentReason: string | null
): ItemStatus {
  const status = row.current_status ?? "";
  if (DESTROYED_STATUS.has(status)) return "destroyed";
  if (!abandonmentReason) return "active";

  // A lost signal is "inactive"; hardware deliberately left in place is
  // "derelict". Both are deterministic reads of the curated mission record.
  if (/contact was lost|went silent|transmissions? (?:ended|stopped)|mission ended|last (?:contact|message)|no signal/i.test(abandonmentReason)) {
    return "inactive";
  }
  if (/left|abandon|remains|still (?:sitting|there|in orbit)|parked|never recovered/i.test(abandonmentReason)) {
    return "derelict";
  }

  return row.primary_zone === "moon" || row.primary_zone === "mars" ? "derelict" : "inactive";
}

const FACT_KIND_BY_TYPE: Record<string, FactKind> = {
  spec: "spec",
  history: "mission",
  mission: "mission",
  abandonment: "mission",
  discovery: "discovery",
  trivia: "legacy",
  legacy: "legacy",
};

const FACT_LABEL_BY_TYPE: Record<string, string> = {
  spec: "Specification",
  history: "Mission record",
  mission: "Mission record",
  abandonment: "Why it was left",
  discovery: "Discovery",
  trivia: "Legacy",
  legacy: "Legacy",
};

export function toFactKind(factType: string): FactKind {
  return FACT_KIND_BY_TYPE[factType] ?? "mission";
}

function jsonValueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["value", "text", "label", "formatted"]) {
      if (record[key] !== undefined) return jsonValueToString(record[key]);
    }
  }
  return "";
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function yearOf(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

function formatKg(value: string | number | null): string | null {
  const n = toNumber(value);
  if (n === null) return null;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(n)} kg`;
}

function formatCatalog(row: Pick<CardRow, "satcat_no" | "cospar_id">): string | undefined {
  const parts: string[] = [];
  const satcat = row.satcat_no === null || row.satcat_no === undefined ? "" : String(row.satcat_no).trim();
  if (satcat && /^\d+$/.test(satcat)) parts.push(`SATCAT ${satcat.padStart(5, "0")}`);
  if (row.cospar_id) parts.push(`COSPAR ${row.cospar_id.trim()}`);
  return parts.length ? parts.join(" · ") : undefined;
}

function formatRange(first: number | null, last: number | null, status: ItemStatus): string {
  if (first && last && first !== last) return `${first} – ${last}`;
  if (first && last) return `${first}`;
  if (first) return status === "active" ? `${first} – present` : `${first}`;
  if (last) return `${last}`;
  return "Unknown";
}

function deriveLocation(row: CardRow, zone: Zone, status: ItemStatus): Item["location"] {
  const lat = toNumber(row.latitude_deg);
  const lon = toNumber(row.longitude_deg);

  let label = row.primary_location_name;
  if (!label) {
    if (zone === "earth-orbit") {
      label = status === "destroyed" ? "Re-entered Earth's atmosphere" : "Earth orbit";
    } else if (zone === "deep-space") {
      label = "Deep space";
    } else {
      label = row.primary_body ? `${row.primary_body} surface` : ZONES[zone].label;
    }
  }

  return lat !== null && lon !== null ? { label, lat, lon } : { label };
}

/* ------------------------------------------------------------------ */
/* Story phases                                                        */
/* ------------------------------------------------------------------ */

const PHASE_TITLE: Record<PhaseKey, string> = {
  built: "Built",
  launched: "Launch",
  worked: "Mission operations",
  abandoned: "Left behind",
  "still-there": "Still out there",
};

export function derivePhaseKey(
  row: Pick<TimelineRow, "seq" | "launch_id" | "status_code">,
  isLast: boolean,
  abandonmentReason: string | null
): PhaseKey {
  const status = row.status_code ?? "";
  if (isLast && DESTROYED_STATUS.has(status)) return "abandoned";
  if (Number(row.seq) === 1) return row.launch_id ? "launched" : "built";
  if (isLast) return abandonmentReason ? "abandoned" : "still-there";
  return "worked";
}

function phaseWindow(row: TimelineRow): string {
  const start = yearOf(row.start_best);
  const end = yearOf(row.end_best);
  if (start && end && start !== end) return `${start} – ${end}`;
  if (start && end) return `${start}`;
  if (start) return `${start} – present`;
  if (end) return `${end}`;
  return "Undated phase";
}

function toPhase(
  itemId: string,
  row: TimelineRow,
  index: number,
  total: number,
  abandonmentReason: string | null
): Phase {
  const key = derivePhaseKey(row, index === total - 1, abandonmentReason);
  const window = phaseWindow(row);
  const description = row.status_description?.trim();
  const title = key === "worked" && row.dest_raw ? `Cruise to ${row.dest_raw}` : PHASE_TITLE[key];
  return {
    id: row.phase_key,
    item_id: itemId,
    order: Number(row.seq),
    key,
    title,
    body: description ? `${window}. ${description}` : `${window}.`,
    stat_value: window,
    stat_label: "Phase window",
    source_id: row.source_id ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Media, models and sources                                           */
/* ------------------------------------------------------------------ */

const MODEL_BY_SLUG: Record<string, { url: string; credit: string }> = {
  opportunity: {
    url: "/models/opportunity.glb",
    credit: "NASA 3D Resources — Mars Exploration Rover Opportunity (MER-B)",
  },
  "apollo-11-lunar-module-eagle": {
    url: "/models/apollo-lm.glb",
    credit: "NASA 3D Resources — Apollo Lunar Module",
  },
  insight: {
    url: "/models/insight.glb",
    credit: "NASA 3D Resources — InSight Cruise Lander",
  },
  skylab: { url: "/models/skylab.glb", credit: "NASA 3D Resources — Skylab" },
  "voyager-1": { url: "/models/voyager.glb", credit: "NASA 3D Resources — Voyager Probe" },
  "pioneer-10": { url: "/models/pioneer.glb", credit: "NASA 3D Resources — Pioneer 10" },
};

export function toSourceKind(sourceId: string, name: string): SourceKind {
  const key = `${sourceId} ${name}`.toLowerCase();
  if (key.includes("image") || key.includes("imagery")) return "image";
  if (key.includes("3d") || key.includes("model")) return "model";
  if (key.includes("press")) return "press-kit";
  return "mission-page";
}

export function toSource(row: SourceRow): Source {
  return {
    id: row.source_id,
    title: row.name,
    publisher: row.name,
    url: row.homepage_url,
    kind: toSourceKind(row.source_id, row.name),
  };
}

function toMedia(row: MediaRow): ItemImage | null {
  if (row.media_type && row.media_type !== "image") return null;
  if (!row.url) return null;
  const caption = [row.title, row.credit].filter(Boolean).join(" — ");
  return { src: imageProxySrc(row.url), caption: caption || "NASA image", source_id: row.source_id };
}

/* ------------------------------------------------------------------ */
/* Item assembly                                                       */
/* ------------------------------------------------------------------ */

export interface ItemInput {
  card: CardRow;
  mission: MissionRow | null;
  facts: FactRow[];
  media: MediaRow[];
  timeline: TimelineRow[];
}

export function buildItem(input: ItemInput): Item {
  const { card, mission, facts, media, timeline } = input;
  const zone = toZone(card.primary_zone);
  if (!zone) {
    throw new Error(`Artifact ${card.slug} has no navigable zone (${card.primary_zone})`);
  }

  const id = toUiId(card.slug);
  const status = deriveStatus(card, mission?.abandonment_reason ?? null);
  const type = deriveType(card);
  const firstYear = yearOf(card.first_start);
  const lastYear = yearOf(card.last_end);
  const catalog = formatCatalog(card);
  const modelRow = media.find((row) => row.media_type === "model");
  const model = modelRow
    ? { url: modelRow.url, credit: modelRow.credit ?? "NASA 3D Resources" }
    : MODEL_BY_SLUG[card.slug];

  const specs: Record<string, string> = {};
  const mass = formatKg(card.mass_kg);
  const dryMass = formatKg(card.dry_mass_kg);
  if (mass) specs["Launch mass"] = mass;
  if (dryMass) specs["Dry mass"] = dryMass;
  if (catalog) specs["Catalog"] = catalog;
  specs["Type"] = type;
  specs["Zone"] = ZONES[zone].label;
  specs["Phases"] = String(toNumber(card.phase_count) ?? 0);
  if (firstYear) specs["First record"] = String(firstYear);
  if (lastYear) specs["Latest record"] = String(lastYear);

  const itemFacts: Fact[] = facts.map((row) => ({
    id: String(row.fact_id),
    item_id: id,
    kind: toFactKind(row.fact_type),
    label: FACT_LABEL_BY_TYPE[row.fact_type] ?? "Record",
    value: jsonValueToString(row.value),
    claim: row.fact_text,
    source_id: row.source_id,
  }));

  const phases: Phase[] = timeline.map((row, index) =>
    toPhase(id, row, index, timeline.length, mission?.abandonment_reason ?? null)
  );

  return {
    id,
    name: card.canonical_name,
    short_name: card.short_name ?? card.canonical_name,
    zone,
    type,
    years_active: formatRange(firstYear, lastYear, status),
    status,
    abandonment_reason: mission?.abandonment_reason ?? "",
    location: deriveLocation(card, zone, status),
    specs,
    catalog,
    nasa_search_query: `${card.canonical_name} NASA`,
    model_url: model?.url,
    model_credit: model?.credit,
    images: media.map(toMedia).filter((image): image is ItemImage => image !== null),
    facts: itemFacts,
    phases,
  };
}

export function buildZoneSummaries(items: Item[]): ZoneSummary[] {
  return ZONE_ORDER.map((id) => {
    const inZone = items.filter((item) => item.zone === id);
    return {
      id,
      label: ZONES[id].label,
      blurb: ZONES[id].blurb,
      item_count: inZone.length,
      hero_image: inZone[0]?.images[0]?.src,
    };
  });
}

export function sourceIdsForItem(item: Item): string[] {
  return Array.from(
    new Set([
      ...item.facts.map((fact) => fact.source_id),
      ...item.images.map((image) => image.source_id),
    ])
  );
}
