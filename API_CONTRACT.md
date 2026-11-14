# Frontend API contract

This document describes the JSON contract for connecting the frontend to a REST API. The TypeScript data shapes below mirror `lib/types.ts`; comparison result fields mirror `lib/compare.ts`.

Set `NEXT_PUBLIC_API_BASE` to the API origin without a trailing slash (for example, `https://api.example.com`). The frontend's shared GET helper requests `${NEXT_PUBLIC_API_BASE}${path}` and falls back to fixture data when a request fails.

## Endpoints

| Method and path | Request | Successful response | Frontend status |
|---|---|---|---|
| `GET /api/zones` | None | `ZoneSummary[]` | The adapter currently derives zones from `GET /api/items` and `ZONES`; it does not call this endpoint. |
| `GET /api/items?zone={zone}` | Optional `zone`: `moon`, `mars`, `earth-orbit`, or `deep-space` | `Item[]` (filtered when `zone` is supplied) | `getItems()` currently calls `GET /api/items` without a query and filters locally. |
| `GET /api/items/:id` | URL-encoded item ID | One `Item` | The current `getItem()` fetches the list and finds the item locally; it does not call this endpoint. |
| `GET /api/items/:id/lineage` | URL-encoded item ID | `LineageResponse` below | Documented backend contract; the current UI builds its lineage from the item record and does not call this endpoint. |
| `GET /api/sources` | None | `Source[]` | Called by `getSources()` and `getSource()`. |
| `POST /api/compare` | `CompareRequest` below | `CompareResult` below | Documented backend contract; the current compare page computes the result locally with `compareItems()` and does not POST. |

All successful responses are JSON. IDs in paths must be URL-encoded. A missing item should return HTTP `404`; invalid query/body fields should return HTTP `400`. The current GET helper treats non-2xx responses as errors and uses local fixtures as its fallback.

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
interface LineageResponse {
  item_id: string;
  phases: Phase[];
  facts: Fact[];
  sources: Source[];
}
```

The `sources` array should contain the sources referenced by the returned facts (and may include sources referenced by item images). Return `404` when the item does not exist.

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
  factsByKind: Array<{ kind: FactKind; a: Fact[]; b: Fact[] }>;
}
```

The response should be grounded in the two item records. `depth` selects presentation detail; it must not change the underlying facts or calculated diff. The existing frontend does not yet consume this POST response.

## Adapter wiring notes

- `lib/api.ts` calls `/api/items` and `/api/sources` when `NEXT_PUBLIC_API_BASE` is set.
- `getItems(zone)` currently fetches the unfiltered item list and filters it in memory.
- `getZones()` currently builds summaries from fetched items and the local `ZONES` constants rather than calling `/api/zones`.
- `getItem(id)` currently fetches the item list and searches it locally.
- Lineage and comparison are currently assembled client-side; the two additional endpoints above define the backend integration contract but are not wired to the adapter yet.
