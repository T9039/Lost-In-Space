# Data sources, licences and ingest notes

Checked against the live sites on 2026-11-14. Re-check before launch; licences
and endpoints change.

## 1. Matrix

| Source | Role | Licence / terms | Redistribution | Cadence | Ingest |
|---|---|---|---|---|---|
| **GCAT** | Backbone: identity, phases, launches, orgs, sites, surface coordinates | **CC-BY-4.0** | Yes, with attribution | Daily; release **1.8.9**, data **2026-11-13** | Bulk TSV |
| **NSSDCA** | Mission prose, spacecraft IDs, history | NASA public domain unless noted | Yes; credit NASA, check third-party material | Per mission page | Curated scrape / manual |
| **Space Artefacts** | Component-level detail and surface-object shortlists | **Custom: free duplication with citation** (not CC-BY) | Yes, with citation | Irregular | Curated, with citation |
| **CelesTrak** | Live Earth-orbit element sets | Free-use policy, not a CC licence | Cache and attribute; do not relicense | ~2 hours | OMM JSON/CSV |
| **NASA Image API** | Imagery | NASA public domain, per-image credit | Yes, preserve credit | Continuous | API proxy |
| **JPL Horizons** | Selected Moon/Mars/deep-space ephemerides | NASA/JPL public domain | Yes, credit | On demand | API, selected objects only |
| **Space-Track** | — | Account + User Agreement | **No** | — | **Excluded** |
| **KeepTrack** | Code reference only | AGPL-3.0 | Code reuse triggers AGPL | — | **No content scraping** |
| **Orbital Radar** | UI reference only | Proprietary | **No** | — | **Excluded** |

Only GCAT is licensed as open data in the CC sense. The app must describe each
source accurately rather than labelling everything “open data”.

---

## 2. GCAT

**Home:** <https://planet4589.org/space/gcat/>
**Release notes:** <https://planet4589.org/space/gcat/web/rel.html>
**Licence:** CC-BY-4.0 — <https://creativecommons.org/licenses/by/4.0/>

### Endpoints

| What | URL |
|---|---|
| Data directory | `https://planet4589.org/space/gcat/data/` |
| TSV directory | `https://planet4589.org/space/gcat/tsv/` |
| Object catalogs | `https://planet4589.org/space/gcat/tsv/cat/<name>.tsv` |
| Launch files (one per LV) | `https://planet4589.org/space/gcat/tsv/launch/<LV>.tsv` |
| Lookup tables | `https://planet4589.org/space/gcat/tsv/tables/<name>.tsv` |
| Bulk archives | `/data/cats.tar.gz`, `/data/launches.tar.gz`, `/data/tables.tar.gz` |
| Column docs | `/web/cat/cols.html`, `/web/launch/lcols.html`, `/web/cat/landercols.html` |
| VagueDate spec | `/web/intro/vague.html` |
| Status codes | `/web/intro/phases.html` |
| Orbit categories | `/web/intro/orbits.html` |
| SatType scheme | `/web/intro/type.html` |

`cats.tar.gz` and `launches.tar.gz` contain HTML-wrapped fixed-width files.
The `/tsv/` tree is cleaner for ingestion. Prefer TSV; use the tarballs only to
discover filenames.

### Catalogs to load

Object catalogs share one 43-column layout (`JCAT`, `Satcat`, `Launch_Tag`,
`Piece`, `Type`, `Name`, `PLName`, `LDate`, `Parent`, `SDate`, `Primary`,
`DDate`, `Status`, `Dest`, `Owner`, `State`, `Manufacturer`, `Bus`, `Motor`,
`Mass`, `MassFlag`, `DryMass`, `DryFlag`, `TotMass`, `TotFlag`, `Length`,
`LFlag`, `Diameter`, `DFlag`, `Span`, `SpanFlag`, `Shape`, `ODate`, `Perigee`,
`PF`, `Apogee`, `AF`, `Inc`, `IF`, `OpOrbit`, `OQUAL`, `AltNames`).

| File | Rows (2026-11-13) | Use |
|---|---:|---|
| `cat/satcat.tsv` | 69,999 | Earth-orbit objects and phases |
| `cat/deepcat.tsv` | 1,238 | Deep-space, Moon, Mars and planetary phases |
| `cat/hcocat.tsv` | — | Heliocentric objects (Sun orbit, escape) |
| `cat/csocat.tsv` | — | Cislunar / special-orbit objects |
| `cat/landercat.tsv` | 469 | Surface objects: **enrichment, not a phase source** |
| `cat/psatcat.tsv` | — | Payload metadata keyed by JCAT (program, class, category, discipline) |

`landercat` overlaps `deepcat` on 431 of 469 JCATs. Loading both as phases would
duplicate them. Use `landercat` to attach surface coordinates and to build the
Moon/Mars shortlist; use `deepcat` for the phase itself.

Other catalogs (`lcat`, `rcat`, `ecat`, `ftocat`, `plcat`, …) exist but are not
needed for the first curated set. The staging table accepts any file with the
same layout.

### Launch files

One TSV per launch vehicle (396 files). Columns:

`Launch_Tag`, `Launch_JD`, `Launch_Date`, `LV_Type`, `Variant`, `Fairing`,
`Flight_ID`, `Flight`, `Mission`, `FlightCode`, `Platform`, `Launch_Site`,
`Launch_Pad`, `Ascent_Site`, `Ascent_Pad`, `Perigee`, `Apogee`, `Apoflag`,
`Inc`, `Azimuth`, `Range`, `RangeFlag`, `Dest`, `OrbMass`, `OrbPay`, `Agency`,
`LaunchCode`, `FailCode`, `Group`, `Category`, `LTCite`, `Cite`, `Notes`.

Load all of them; the join key is `Launch_Tag`.

### Lookup tables

`tables/orgs.tsv`: `Code`, `UCode`, `StateCode`, `Type`, `Class`, `TStart`,
`TStop`, `ShortName`, `Name`, `Location`, `Longitude`, `Latitude`, `Error`,
`Parent`, `ShortEName`, `EName`, `UName`.

`tables/sites.tsv`: `Site`, `Code`, `UCode`, `Type`, `StateCode`, `TStart`,
`TStop`, `ShortName`, `Name`, `Location`, `Longitude`, `Latitude`, `Error`,
`Parent`, `ShortEName`, `EName`, `Group`, `UName`.

### Data quirks that the loader must respect

- `VagueDate`: keep raw, normalised value, precision and `?` approximation.
- `Parent` can be an extended JCAT, a body name, or include a port/location
  suffix. Store raw; resolve separately.
- `Satcat` can be `NNA`, `NSO` or blank. Never cast blindly.
- `MassFlag`, `DryFlag`, `LengthFlag`, etc. use `?`, `-` and blank to mean
  unknown or estimated. Store the flag next to the number.
- `Primary` is the central body, not the launch planet.
- `Status` is a phase status code, not “mission status”.
- `Type` is a 12-byte SatType string; byte 1 is the coarse type.
- `Class` is A/B/C/D; `Category` is the payload category (`TECH`, `COM`, …).
  Neither means “civil/military/commercial”.

---

## 3. CelesTrak

**Home:** <https://celestrak.org/>
**GP formats:** <https://celestrak.org/NORAD/documentation/gp-data-formats.php>
**Usage policy:** <https://celestrak.org/usage-policy.php>

Use OMM JSON or CSV, **not TLE**. CelesTrak exhausted 5-digit catalog numbers on
2026-07-11; new objects use 6-digit IDs that TLE cannot express.

Example OMM query:

```text
https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON
https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=CSV
```

Policy requirements that affect the design:

- Fetch on a schedule (about every 2 hours), not per user request.
- Cache aggressively; one fetch per cycle.
- Send a descriptive `User-Agent` and do not hammer the service.
- Attribute CelesTrak and the US Space Force origin of the data.
- Do not present the data as a CelesTrak-certified product.

Ingestion maps OMM fields directly to `gp_element`:

| OMM | Column |
|---|---|
| `NORAD_CAT_ID` | `satcat_no` |
| `EPOCH` | `epoch` |
| `INCLINATION` | `inclination_deg` |
| `RA_OF_ASC_NODE` | `raan_deg` |
| `ECCENTRICITY` | `eccentricity` |
| `ARG_OF_PERICENTER` | `arg_perigee_deg` |
| `MEAN_ANOMALY` | `mean_anomaly_deg` |
| `MEAN_MOTION` | `mean_motion_rev_day` |
| `BSTAR` | `bstar` |
| full record | `raw_omm` |

Only curated Earth-orbit artifacts need live tracking. Fetching the full active
catalog is possible later without a schema change.

---

## 4. NSSDCA

**Home:** <https://nssdc.gsfc.nasa.gov/>
**Obtaining data:** <https://nssdc.gsfc.nasa.gov/nssdc/obtaining_data.html>

No bulk API for mission prose. Use per-mission pages, keyed by COSPAR or NSSDCA
ID, and copy only the facts the app needs. Record the exact page in
`fact.source_url`.

NASA content is generally public domain, but individual images and contributed
text can carry third-party rights. Check the credit line on each item.

---

## 5. Space Artefacts

**Home:** <https://spaceartefacts.com/>
**Legal notice:** <https://spaceartefacts.com/legal-notice>

Terms: the data is freely available for duplication **if the site and author are
cited**. This is not CC-BY. Do not relicense their tables and do not present
them as CC-BY.

Useful for:

- surface-object shortlists (Moon, Mars, Venus, asteroids)
- component-level histories (descent stages, rovers, tools, crash sites)
- cross-checking GCAT mass and status values

Every row taken from this source gets `source_id = 'space_artefacts'` and a
citation in `fact.source_url` or `media.credit`. `ATTRIBUTION.md` carries the
required notice.

---

## 6. NASA Image and Video Library

**Home:** <https://images.nasa.gov/>
**API:** <https://api.nasa.gov/> (the images endpoint works without a key for
basic use, but a key raises limits)

Proxy requests server-side so the key is not exposed and responses can be
cached. Preserve `credit`, `title` and the asset page URL in `media`.

NASA does not license all assets identically. Do not assume every image on a
NASA page is public domain; read the credit.

---

## 7. JPL Horizons

**Home:** <https://ssd.jpl.nasa.gov/horizons/>
**API:** <https://ssd.jpl.nasa.gov/api/horizons.api>

Use only for selected active spacecraft and for spot-checking historical
positions. Do not bulk-poll. Store the retrieved ephemeris as a fact or a small
cached table; do not turn it into a live feed.

---

## 8. Excluded sources

### Space-Track

Account-gated, throttled, and covered by a User Agreement that restricts
redistribution. Fine for private analysis; not acceptable as a dependency of an
open repository or a public deployment.

### KeepTrack

The application code is AGPL-3.0. Reusing or modifying it in a served product
triggers AGPL source obligations. Its website content is not an open dataset.
Reference it for ideas, not as an ingest target.

### Orbital Radar

Proprietary, all rights reserved. UI inspiration only.

---

## 9. Attribution block

Use this in `ATTRIBUTION.md` and on the Sources screen:

> Space object and launch data: Jonathan C. McDowell, *General Catalog of
> Artificial Space Objects* (GCAT), <https://planet4589.org/space/gcat/>,
> CC-BY-4.0. Release 1.8.9, data updated 2026-11-13.
>
> Mission descriptions and imagery: NASA Space Science Data Coordinated Archive
> (NSSDCA) and NASA Image and Video Library. Individual assets retain their
> published credit lines.
>
> Component detail: *Space Artefacts*,
> <https://spaceartefacts.com/>, duplicated with citation.
>
> Live Earth-orbit element sets: CelesTrak, <https://celestrak.org/>. GP data
> originated by the US Space Force.
>
> Ephemerides: JPL Horizons, NASA Jet Propulsion Laboratory.

Do not describe GCAT as public domain. Do not describe Space Artefacts or
CelesTrak data as CC-BY.

---

## 10. Refresh schedule

| Job | Cadence | Action |
|---|---|---|
| GCAT object catalogs | Nightly | Replace staging, rebuild canonical rows, refresh card view |
| GCAT launches/orgs/sites | Nightly | Same run |
| CelesTrak OMM | Every 2 hours | Upsert `gp_element` |
| NASA images | On demand | Fetch and cache per artifact |
| NSSDCA / Space Artefacts facts | Curation only | Human-verified, sourced |

Record every run in `etl_run` with release tag and row counts.
