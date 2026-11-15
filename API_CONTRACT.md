# Frontend API contract

This document is the frontend/backend handoff for Lost in Space. The JSON types below mirror `lib/types.ts`; the local deterministic comparison result mirrors `lib/compare.ts`.

## Connecting the live backend

The frontend only talks to a REST API. It never connects directly to PostgreSQL or Apache AGE; those are behind the backend service, which owns persistence and lineage queries.

- If `NEXT_PUBLIC_API_BASE` is unset or empty, `lib/api.ts` sets `USING_MOCK = true` and serves the local records in `lib/fixtures.ts`.
- If `NEXT_PUBLIC_API_BASE` is non-empty, the shared GET helper requests `${NEXT_PUBLIC_API_BASE}${path}` with `cache: "no-store"`.
- A network failure, non-2xx response, or JSON parse failure is caught by the helper; it logs a warning and returns the corresponding fixture fallback.
- The helper casts JSON to the TypeScript type but does not runtime-validate it. The backend must return the exact shapes documented below.

Set the variable to the API origin without a trailing slash, for example `NEXT_PUBLIC_API_BASE=https://api.example.com`. In local development, place it in `.env.local` (which is gitignored). Set it before `next dev` or `next build`; Next.js `NEXT_PUBLIC_*` values are embedded at build time. The live API can use PostgreSQL and Apache AGE behind that origin; those technologies are not frontend runtime dependencies.

## Endpoints

| Method and path | Request | Successful response | Frontend status |
|---|---|---|---|
| `GET /api/zones` | None | `ZoneSummary[]` | Backend endpoint contract. `getZones()` currently derives summaries from `/api/items` and local `ZONES`; it does not call this endpoint. |
| `GET /api/items` | None | `Item[]` | Called by `getItems()`, `getItem()`, and indirectly by `getZones()`. |
| `GET /api/items?zone={zone}&q={query}` | Optional zone and trigram search filters | `Item[]` | Supported backend contract. The archive uses server-side search. |
| `GET /api/items/:id` | URL-encoded item ID | One `Item` | Backend endpoint contract. Current `getItem()` searches the list from `/api/items`. |
| `GET /api/items/:id/lineage` | URL-encoded item ID | `LineageResponse` below | Backend endpoint contract for the provenance graph; not currently called by the UI. |
| `GET /api/sources` | None | `Source[]` | Called by `getSources()` and `getSource()`. |
| `POST /api/compare` | `CompareRequest` below | `CompareResult` below | Backend endpoint contract. The current compare page calls `compareItems()` locally and does not POST. |

All successful responses are JSON. IDs in paths must be URL-encoded. A missing item should return HTTP `404`; invalid query/body fields should return HTTP `400`. Fixture fallback applies to GETs made through the current `lib/api.ts` helper. `POST /api/compare` is documented for backend integration and has no client fallback wired yet.

## TypeScript data shapes

The unions and interfaces correspond to `lib/types.ts`:

```ts
type Zone = "moon" | "mars" | "earth-orbit" | "deep-space";
type ItemType = "rover" | "lander" | "orbiter" | "probe" | "stage";
type ItemStatus = "inactive" | "derelict" | "active" | "destroyed";
type PhaseKey = "built" | "launched" | "worked" | "abandoned" | "still-there";
type SourceKind = "mission-page" | "image" | "model" | "press-kit";
type FactKind = "spec" | "mission" | "discovery" | "legacy";

interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: SourceKind;
}

interface Fact {
  id: string;
  item_id: string;
  kind: FactKind;
  label: string;
  value: string;
  claim: string;
  source_id: string;
  phase_key?: PhaseKey;
}

interface Phase {
  id: string;
  item_id: string;
  order: number;
  key: PhaseKey;
  title: string;
  body: string;
  stat_value: string;
  stat_label: string;
  source_id?: string;
}

interface ItemImage {
  src: string;
  caption: string;
  source_id: string;
}

interface Item {
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
  catalog?: string;
  nasa_search_query: string;
  model_url?: string;
  model_credit?: string;
  images: ItemImage[];
  facts: Fact[];
  phases: Phase[];
}

interface ZoneSummary {
  id: Zone;
  label: string;
  blurb: string;
  item_count: number;
  hero_image?: string;
}
```

An `Item` response contains the three related data buckets: `facts`, `phases`, and image/source references. Each fact's `source_id` must identify a `Source` returned by `/api/sources`; each image's `source_id` uses the same source list. `phase_key`, when present, identifies the related phase. Keep `specs` values as strings because the UI displays them verbatim and compares them deterministically.

### Media and 3D assets

- `images` is `ItemImage[]`. `src` is the browser-loadable NASA image path or URL; `caption` is the image attribution/context shown by the gallery; `source_id` links to `/api/sources`.
- `model_url` is optional and points to a browser-loadable GLB model (for example, `/models/opportunity.glb`). `model_credit` is the optional display credit. The `<model-viewer>` UI derives a PNG poster path by replacing `.glb` with `.png`; provide that sibling asset when available.
- `hero_image` on `ZoneSummary` is an optional browser-loadable image path/URL used for the Home zone portal.

### Zone IDs and dynamic sector discovery

The current API union is exactly `"moon" | "mars" | "earth-orbit" | "deep-space"`. `ZoneSummary.id` and `Item.zone` use this union. The frontend's `lib/zones.ts` also has `ZoneMeta` coordinates and visual metadata ready for `mercury`, `venus`, `asteroid-belt`, and `titan`. When new zone IDs are admitted to the API/type contract and `getZones()` returns a `ZoneSummary` for them, the map and Archive can render the new sectors from that metadata without changing the map scene. **With the current adapter as checked in, an item in a new zone alone is not enough:** `getZones()` still iterates only the four keys in `ZONES`, and the `Zone` union has only those four values. The adapter/type list must be widened or `getZones()` must consume the backend `/api/zones` response before those future zones can appear automatically.

## Endpoint JSON

### `GET /api/zones`

Return a JSON array of summaries. `hero_image` may be omitted when there is no image.

```json
[
  {
    "id": "mars",
    "label": "Mars",
    "blurb": "Robots that went quiet but never came home.",
    "item_count": 2,
    "hero_image": "/img/opportunity-1.jpg"
  }
]
```

### `GET /api/items` and `GET /api/items?zone=mars`

Return a JSON array of complete `Item` records. The optional zone filter narrows the array; an unknown zone should be rejected with `400`. Do not wrap the array in an object. An item record includes `facts: Fact[]` and `phases: Phase[]` as shown by the interfaces above.

### `GET /api/items/:id`

Return one complete `Item` object (not an array and not `{ "item": ... }`). A not-found ID returns `404`.

### `GET /api/items/:id/lineage`

Return the linked bucket records for the requested item. The relationship is expressed by `item_id`, `Fact.phase_key`, and `Fact.source_id` rather than duplicated graph nodes:

```ts
interface LineageEdge {
  kind: string;          // "relation" | "phase_parent"
  label: string;         // relation kind or phase status code
  via: string | null;    // JCAT id for phase_parent edges
  parent_id: string;
  parent_slug: string;
  parent_name: string;
  child_id: string;
  child_slug: string;
  child_name: string;
}

interface LineageResponse {
  item_id: string;
  phases: Phase[];
  facts: Fact[];
  sources: Source[];
  edges: LineageEdge[];
}
```

`edges` is the direct one-hop projection of `v_artifact_edge`, joined to both
artifacts' slugs and names. The `sources` array contains the sources referenced
by the returned facts (and may include sources referenced by item images).
Return `404` when the item does not exist.

### `GET /api/sources`

Return a JSON array of `Source` objects. This endpoint is currently used by `lib/api.ts`.

### `POST /api/compare`

Request body:

```ts
interface CompareRequest {
  aId: string;
  bId: string;
  depth: "simple" | "deep";
}
```

Response shape is the deterministic `CompareResult` currently defined in `lib/compare.ts`:

```ts
interface SpecRow {
  key: string;
  a: string;
  b: string;
  same: boolean;
}

interface CompareResult {
  a: Item;
  b: Item;
  specs: SpecRow[];
  sharedCount: number;
  differentCount: number;
  highlights: string[];
  factsByKind: Array<{ kind: string; a: Fact[]; b: Fact[] }>;
}
```

The spec join and the `same`/count arithmetic run in PostgreSQL. The response is grounded in the two item records; `depth` selects presentation detail and must not change the underlying facts or calculated diff. No narrative field is defined by the current `CompareResult` TypeScript interface. The existing frontend does not yet consume this POST response.

## Adapter wiring notes

- `lib/api.ts` calls `/api/items` and `/api/sources` when `NEXT_PUBLIC_API_BASE` is set.
- `getItems(zone)` currently fetches the unfiltered item list and filters it in memory.
- `getZones()` currently builds summaries from fetched items and the local `ZONES` constants rather than calling `/api/zones`.
- `getItem(id)` currently fetches the item list and searches it locally.
- Lineage and comparison are currently assembled client-side; the two additional endpoints above define the backend integration contract but are not wired to the adapter yet.
