// 06 — Data Sources
// Part of Lost in Space — Technical System Documentation

= Data Sources
<sec-data-sources>

Every fact in the archive comes from a named source. This section records what
each source provides, what its licence actually permits, how it is ingested, and
what was rejected. It is the reference behind `docs/DATA-SOURCES.md` and the
`source` table.

== Selection criteria

A source is admitted only if all five hold:

1. *Stable identity.* Rows can be keyed to a catalog identifier rather than a
   page title.
2. *Machine-readable or reliably parseable.* Bulk access is preferred; a small
   curated scrape is acceptable for enrichment.
3. *Licence compatible with public reuse.* The licence allows the project to
   display and redistribute the derived facts with attribution.
4. *Provenance is expressible.* Each row can carry a source URL or row
   reference.
5. *Survivable.* The source can disappear without taking the archive with it,
   because raw data is cached or re-derivable.

A source that fails criterion 3 is excluded even if it is technically excellent.
A source that fails criterion 5 is cached aggressively or treated as optional.

== Source matrix

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Source matrix],
  table(
    columns: (2.4cm, 3.0cm, 3.4cm, 1fr),
    inset: 7pt,
    stroke: 0.5pt,
    align: (left, left, left, left),
    table.header([*Source*], [*Role*], [*Licence / terms*], [*Ingest mode*]),
    [GCAT], [Identity, phases, launches, organizations, sites, surface coordinates], [CC-BY-4.0], [Bulk TSV, nightly],
    [NSSDCA], [Mission prose, spacecraft identifiers, history], [NASA public domain unless noted], [Curated page extraction],
    [Space Artefacts], [Component detail, surface-object shortlists], [Custom: free duplication with citation], [Curated, cited],
    [CelesTrak], [Live Earth-orbit element sets], [Free-use policy, not CC], [OMM JSON/CSV, two-hourly],
    [NASA Images], [Imagery], [Mostly public domain, per-asset credit], [Server proxy, cached],
    [JPL Horizons], [Selected ephemerides], [NASA/JPL public domain], [API, selected objects],
    [Space-Track], [—], [Account + User Agreement], [Excluded],
    [KeepTrack], [Code reference only], [AGPL-3.0], [No content ingest],
    [Orbital Radar], [UI reference only], [Proprietary], [Excluded],
  ),
)

== GCAT — the backbone

*Provider.* Jonathan C. McDowell, *General Catalog of Artificial Space Objects*
@gcat, `planet4589.org/space/gcat`.

*Licence.* CC-BY-4.0. Attribution is mandatory. The required credit line is
stored in `source.citation` and shown on the Sources screen and in
`ATTRIBUTION.md`.

*Release used.* 1.8.9, data updated 2026-11-13.

*What it provides.* The only source in the stack that models *phases*: an
object in one state between two events, with its own catalog number, launch tag,
status code, orbit and dates. It also publishes launches, organizations, sites,
lander coordinates and payload metadata. This is why GCAT is the backbone rather
than an enrichment.

*Endpoints.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [GCAT endpoints used by the loader],
  table(
    columns: (3.2cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Resource*], [*URL*]),
    [TSV root], [`https://planet4589.org/space/gcat/tsv/`],
    [Object catalogs], [`tsv/cat/<name>.tsv`],
    [Launch files], [`tsv/launch/<vehicle>.tsv`],
    [Lookup tables], [`tsv/tables/<name>.tsv`],
    [Bulk archives], [`data/cats.tar.gz`, `data/launches.tar.gz`, `data/tables.tar.gz`],
    [Column documentation], [`web/cat/cols.html`, `web/launch/lcols.html`],
    [Date format], [`web/intro/vague.html`],
    [Status codes], [`web/intro/phases.html`],
    [Orbit categories], [`web/intro/orbits.html`],
  ),
)

*Files loaded.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [GCAT files and their role],
  table(
    columns: (2.8cm, 2.2cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, right, left),
    table.header([*File*], [*Rows (2026-11-13)*], [*Role*]),
    [`cat/satcat.tsv`], [69,999], [Earth-orbit objects and phases],
    [`cat/deepcat.tsv`], [1,238], [Deep-space, Moon, Mars and planetary phases],
    [`cat/hcocat.tsv`], [—], [Heliocentric and escape objects],
    [`cat/csocat.tsv`], [—], [Cislunar and special-orbit objects],
    [`cat/landercat.tsv`], [469], [Surface objects; enrichment, not a phase source],
    [`cat/psatcat.tsv`], [27,940], [Payload metadata keyed by JCAT],
    [`launch/*.tsv`], [396 files], [Launch events, joined by launch tag],
    [`tables/orgs.tsv`], [—], [Owners, manufacturers, agencies],
    [`tables/sites.tsv`], [—], [Launch sites and platforms],
  ),
)

*Quirks that the loader must respect.*

- `satcat.tsv` begins with a `#` comment header; data rows have 42 tab-separated
  fields.
- `landercat` overlaps `deepcat` on 431 of 469 JCATs. It is enrichment only; using
  it as a second phase source would duplicate phases.
- `Satcat` may be `NNA`, `NSO` or blank. It is text, not an integer.
- `MassFlag`, `DryFlag`, `LengthFlag`, `SpanFlag`, `PF`, `AF` and `IF` encode
  uncertainty as `?`, `-` or blank. The flag is meaningful and is stored.
- `Parent` may be an extended JCAT, a body name, or include a port/location
  suffix. It is stored raw and resolved separately.
- `Type` is a 12-byte SatType string; the first byte is the coarse type.
- `Status` is a *phase* status, not a mission outcome.

*Alternatives considered.* No other source models phases with this coverage.
Space-Track has current element sets and a satellite catalog, but it is
account-gated, throttled and restricts redistribution; it cannot be the backbone
of an open archive. NSSDCA is prose-first and does not publish a unified catalog.
Using a commercial catalog would violate the sovereignty constraint. The real
alternative was “no phase model”, which would have forced a false
one-catalog-number-per-object schema.

*Refresh.* Nightly. The loader records `release_tag` and `retrieved_at` on
`source` and in `etl_run`. A failed run keeps the previous canonical rows.

== NSSDCA — mission prose and identifiers

*Provider.* NASA Space Science Data Coordinated Archive @nssdca.

*Licence.* Generally NASA public domain, but individual contributed texts and
images may carry third-party rights. The project copies only the facts it needs
and records the exact page in `fact.source_url`.

*What it provides.* Mission narratives, spacecraft identifiers, instrument
lists, historical outcomes and the occasional authoritative correction to a
catalog value.

*Ingest mode.* No bulk API for prose. Pages are read by a curator, the needed
statements are written as `fact` rows, and each row links to its page. There is no
crawler and no automated extraction.

*Why not automated.* Prose extraction would need an NLP pipeline to distinguish
mission facts from narrative framing, and it would still require review. A human
writing a sourced sentence is cheaper and more accurate at this scale.

*Alternatives considered.* Wikipedia is broad but not a primary source and its
licence (CC-BY-SA) would impose share-alike on derived text. ESA and JAXA
mission pages are authoritative for their own missions but not a unified
catalog. A general web crawl has no stable provenance.

== Space Artefacts — component detail

*Provider.* `spaceartefacts.com` @spaceartefacts.

*Licence.* Custom: free duplication *with citation of the site and author*. It
is not CC-BY. The project must not relicense the material or present it as CC-BY.

*What it provides.* Component-level histories (descent stages, rovers, tools,
crash sites), surface-object shortlists across the Moon, Mars, Venus and
asteroids, and cross-checks for GCAT mass and status values.

*Ingest mode.* Curated. Every row taken is written with
`source_id = 'space_artefacts'` and a citation in `fact.source_url` or
`media.credit`. `ATTRIBUTION.md` carries the required notice.

*Where it is used.* Primarily to build the Moon and Mars shortlists and to add
component detail that GCAT does not model. It is not used to override a GCAT
mass or date without a recorded reason.

*Alternatives considered.* NSSDCA covers missions, not abandoned components.
GCAT covers objects but not component-level narrative. Wikipedia is not a primary
source. Using Space Artefacts is the only option that gives component detail with
a clear citation requirement.

== CelesTrak — live Earth-orbit elements

*Provider.* CelesTrak @celestrak, with GP data originated by the US Space Force.

*Terms.* Free-use policy, not a Creative Commons licence. The project caches,
attributes and does not relicense. It also does not present the data as a
CelesTrak-certified product.

*What it provides.* Current general-perturbations element sets in CCSDS OMM
format for cataloged Earth-orbit objects.

*Ingest mode.* A scheduled job fetches OMM JSON/CSV for the curated SATCAT list
every two hours, with a descriptive `User-Agent`. One request per batch. Fields
map directly into `gp_element`; the full record is retained in `raw_omm`.

*Why OMM and not TLE.* CelesTrak exhausted five-digit catalog numbers on
2026-07-11. New objects carry six-digit identifiers that the fixed-width TLE
format cannot represent. OMM also names its fields and states its reference frame
and time system explicitly.

*What it is not used for.* Moon, Mars and deep-space positions. Those artifacts
show a surface coordinate or a stored ephemeris, clearly labelled.

*Alternatives considered.* Space-Track offers a richer catalog but requires an
account and restricts redistribution. TLE is deprecated for new objects.
Self-propagating from launch state vectors would duplicate a calibrated service
for no product gain. Keeping a full local copy of the active catalog is possible
later without a schema change, but is not needed for a curated archive.

== NASA Image and Video Library

*Provider.* NASA @nasaimages.

*Terms.* NASA content is generally not copyrighted in the United States, but
individual assets can include third-party material. Each asset's published credit
line is authoritative and is stored in `media.credit`.

*What it provides.* Photographs and video of the artifacts, launches and surface
sites.

*Ingest mode.* Server-side proxy. The browser requests a stable route, the server
fetches metadata with a server-held key, caches the response and returns a
normalised payload. Binaries are not re-hosted.

*Why a proxy.* It hides the API key, allows shared caching, gives stable URLs and
survives upstream latency. It also centralises the credit line so the UI cannot
omit it.

*Alternatives considered.* Browser-side calls expose the key and cannot cache
across users. Re-hosting binaries shifts licence and takedown responsibility onto
the project. A third-party image CDN adds a proprietary dependency for a
non-core path.

== JPL Horizons — selected ephemerides

*Provider.* NASA Jet Propulsion Laboratory @horizons.

*Terms.* NASA/JPL public domain with credit.

*What it provides.* High-precision ephemerides for selected active spacecraft and
historical position spot-checks, including bodies and frames that SGP4 cannot
handle.

*Ingest mode.* On demand, selected objects only. Results are stored as a fact or
a small cached table; they are never turned into a high-frequency feed.

*Why not more.* Horizons is a query service, not a bulk element source. Polling it
per user would be impolite and slow. The curated deep-space set needs a handful
of positions, not a live simulation.

*Alternatives considered.* Skyfield with JPL ephemerides can compute positions
locally and is a good fit for a scheduled job, but it still depends on the same
underlying ephemeris files. Orekit is more precise but adds a JVM. SGP4 does not
apply beyond near-Earth.

== Excluded sources

=== Space-Track

Account-gated, throttled, and covered by a User Agreement that restricts
redistribution @spacetrack. Acceptable for private analysis, not for a public open
repository or a mirrored deployment. Its absence is a deliberate cost: the
project uses CelesTrak for the live layer and GCAT for the catalog.

=== KeepTrack

The application code is AGPL-3.0 @keeptrack. Reusing or modifying it in a served product
triggers AGPL source obligations. Its website content is not an open dataset.
It is a reference for interaction design, not an ingest target.

=== Orbital Radar

Proprietary, all rights reserved. Used as a visual reference only. No content,
code or data is copied.

=== Wikipedia and general web sources

Not primary sources, and CC-BY-SA would impose share-alike on derived text. They
may help a curator find the primary source, but the cited source is the primary
one.

== Attribution rules

The following rules are enforced in code and review:

1. `source.citation` is the exact line the UI renders.
2. An artifact page shows the credit for every source used by its facts and media.
3. The Sources screen lists every source with its licence and link.
4. A `media` row without `license_name` and `credit` fails validation.
5. GCAT is never described as public domain.
6. Space Artefacts and CelesTrak are never described as CC-BY.
7. NASA imagery keeps its per-asset credit, even when NASA is the agency.

== Refresh schedule

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Refresh schedule],
  table(
    columns: (3.4cm, 2.2cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, center, left),
    table.header([*Job*], [*Cadence*], [*Action*]),
    [GCAT catalogs, launches, lookups], [Nightly], [Replace staging, rebuild canonical rows, record `etl_run`],
    [CelesTrak OMM], [Every 2 hours], [Upsert `gp_element`, prune sets older than 30 days for uncurated objects],
    [NASA images], [On demand], [Proxy and cache per artifact],
    [NSSDCA and Space Artefacts facts], [Curation only], [Human-verified, cited rows],
    [JPL Horizons], [On demand], [Store a selected ephemeris as a fact or cache],
  ),
)

== Source failure policy

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Source failure policy],
  table(
    columns: (2.6cm, 1fr, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Source*], [*If it is unavailable*], [*If it changes format*]),
    [GCAT], [Keep the previous canonical release; the archive stays correct but stale], [Fail the loader loudly; fix the parser before promoting],
    [CelesTrak], [Serve the last stored element sets and show their age], [Reject the batch; keep existing elements],
    [NASA Images], [Show a labelled placeholder], [Proxy returns an error; no broken image],
    [NSSDCA / Space Artefacts], [No runtime effect; content is already curated], [No runtime effect; curation notes the change],
    [Horizons], [No runtime effect; stored values remain], [Treat as a curation task],
  ),
)
