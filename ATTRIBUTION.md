# Attribution

Lost in Space combines data under several licences. Each source keeps its own
terms. Nothing below is relicensed by this project.

## General Catalog of Artificial Space Objects (GCAT)

> McDowell, Jonathan C. *General Catalog of Artificial Space Objects* (GCAT).
> <https://planet4589.org/space/gcat/>. Release 1.8.9, data updated 2026-11-13.
> Licensed CC-BY-4.0: <https://creativecommons.org/licenses/by/4.0/>.

Used for object identity, phases, launches, organizations, sites, orbits and
surface coordinates. Changes made by this project (normalised dates, resolved
identities, curated groupings) are indicated by the schema itself; the raw source
strings are preserved in `*_raw` columns and `staging` tables.

## NASA Space Science Data Coordinated Archive (NSSDCA)

> NASA Space Science Data Coordinated Archive (NSSDCA), NASA Goddard Space
> Flight Center. <https://nssdc.gsfc.nasa.gov/>.

Used for mission descriptions and history. NASA material is generally not
copyrighted; individual images and third-party contributions may carry separate
credits, which are preserved per item.

## Space Artefacts

> *Space Artefacts* — Man-made objects wandering across the Solar System.
> <https://spaceartefacts.com/>. Data duplicated with citation.

Used for component-level detail and surface-object shortlists. This data is
**not** CC-BY. The site and author must be cited wherever the data appears.

## CelesTrak

> CelesTrak. <https://celestrak.org/>. GP data originated by the US Space Force.

Used for near-real-time Earth-orbit element sets. CelesTrak data is provided
under its free-use policy, not a Creative Commons licence. Access is cached and
rate-limited; see <https://celestrak.org/usage-policy.php>.

## NASA Image and Video Library

> NASA Image and Video Library. <https://images.nasa.gov/>.

Imagery is generally public domain, but each asset keeps its published credit
line. Third-party material is not relicensed here.

## NASA mission pages

> NASA mission pages. <https://science.nasa.gov/> and <https://www.nasa.gov/>.

Used for mission summaries, fact sheets and outcomes. NASA material is generally
public domain, but individual pages can include third-party text or imagery;
the page is checked before a fact is copied.

## JPL Horizons

> JPL Horizons System, NASA Jet Propulsion Laboratory.
> <https://ssd.jpl.nasa.gov/horizons/>.

Used for selected ephemerides only.

## Project content

Curated text and data authored for this project are released under CC-BY-4.0.
The source code is MIT licensed.

## Sources deliberately not used

- **Space-Track** — account-gated; redistribution restricted.
- **KeepTrack** — AGPL-3.0 code; site content is not an open dataset.
- **Orbital Radar** — proprietary.

If a future contributor adds a source, add its licence and required credit line
to `source` in the database and to this file before ingesting it.
