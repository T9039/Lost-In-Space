# Space Artifacts — Data Sources & Modeling Notes

## Quick Links

- [Space Artefacts](https://spaceartefacts.com/)
- [GCAT — Jonathan McDowell](https://planet4589.org/space/gcat)
- [NASA NSSDCA](https://nssdc.gsfc.nasa.gov)
- [Space-Track](https://space-track.org)
- [CelesTrak](https://celestrak.org)
- [KeepTrack](https://keeptrack.space)
- [Orbital Radar](https://orbitalradar.com)

---

## 1. How Each Dataset Answers Your Questions

| Dimension | Best Data Source | Exact Fields & Coverage |
| --- | --- | --- |
| **Who** (Owner, Builder, Launcher) | GCAT (`satcat.tsv`, `orgs.tsv`) | Tracks State (country/agency), Owner/Operator, Manufacturer (who built the bus/hardware), and Launch Site/Vehicle. |
| **When** (Lifecycle Timeline) | GCAT (`satcat.tsv`, `ecat.tsv`) | Records Launch Date/Time, Separation Date (when a rover detached from a cruise stage), TLast (last known active transmission), and Decay/Impact Date. |
| **Why** (Mission Purpose & Class) | GCAT Payload Catalogs (`psatcat.tsv`, `pdeepcat.tsv`) + NASA NSSDCA | GCAT classifies Class (Military, Civil, Commercial, Amateur) and Category/Discipline (e.g., IMG, COMMS, ASTROMETRY, WEAPON). NASA NSSDCA provides the long-form prose mission summaries explaining the scientific or political motivation. |
| **How & Where** (Trajectory & Fate) | GCAT (`deepcat.tsv`, `landercat.tsv`, `hcocat.tsv`) + Space Artefacts | GCAT tracks Parent JCAT ID (linking debris or landers back to the parent rocket/mission), orbital elements, and exact landing/impact coordinates (`landercat`). Space Artefacts adds granular sub-component histories (e.g., specific Apollo tools, descent stages, crash sites). |

---

## 2. How to Deduplicate & Stitch Them Together

If you merge raw files blindly, you will get massive duplication—for example, an Apollo spacecraft, its lunar module, its descent stage, and its ascent stage appear across Earth orbit catalogs, deep-space catalogs, and lunar surface tables.

To build a clean relational database (e.g., in PostgreSQL or SQLite), use a three-key deduplication and linking strategy:

1. **Primary Master Key (JCAT ID):** Use GCAT's JCAT identifier (e.g., `S00001` for Sputnik 1, `D00012` for deep-space objects) as your primary key. GCAT already cross-indexes standard Earth-orbit objects (`satcat`) with deep-space objects (`deepcat`) via the `deepcat` to `satcat`/`auxcat` crossindex, so you can filter out overlapping records immediately.
2. **Universal Join Keys (COSPAR & NORAD IDs):**
   - **COSPAR International Designator** (e.g., `1969-059A` for Apollo 11 Command Module, `1969-059C` for Eagle Lunar Module): Every piece from the same launch shares the `YYYY-NNN` prefix, allowing you to group a rocket body, its payload, and its discarded adapters into a single mission story.
   - **NORAD / SATCAT Number:** Use this to join live orbital telemetry from CelesTrak or Space-Track onto your GCAT historical records.
3. **Parent-Child Genealogy (Parent Column):** GCAT includes a Parent JCAT field. By self-joining on `parent_jcat_id`, your database can reconstruct the exact chain of events—showing how Rocket Launch X deployed Cruise Stage Y, which released Lander Z, which ejected Heat Shield W.

---

## 3. Direct Access to the Raw Data

**GCAT Full Relational Tables (TSV/CSV):** Available directly at [planet4589.org/space/gcat/data/](https://planet4589.org/space/gcat/data/) (or mirrored in clean CSV/JSON schemas on DataHub and Hugging Face under CC-BY / Open Data Commons licenses). Specifically download:

- `satcat.tsv` & `psatcat.tsv` — Earth orbit objects + payload mission purposes
- `deepcat.tsv` & `pdeepcat.tsv` — Beyond-Earth objects + payload purposes
- `landercat.tsv` & `hcocat.tsv` — Planetary surface landings/impacts & heliocentric objects
- `launch.tsv` & `orgs.tsv` — Launch vehicle details, sites, and agency/manufacturer lookup tables

**CelesTrak Bulk CSV/JSON:** `celestrak.org/pub/satcat.csv` gives you a single flat file of all cataloged Earth-orbiting objects with current operational status and NORAD/COSPAR keys to sync against GCAT.

**NASA NSSDCA & Space Artefacts:** Neither offers a single bulk SQL dump, so the standard approach is to seed your database with GCAT and use the COSPAR ID to scrape or query NSSDCA mission descriptions (`nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=<COSPAR>`) and Space Artefacts tables for narrative text.

---

## 4. Relational Database Design (PostgreSQL / SQLite)

To build a clean, queryable story of human artifacts in space without drowning in duplication, a **relational database (like PostgreSQL or SQLite)** is your best starting point. Because space history involves parent rockets deploying probes, which land and drop heat shields, a relational schema lets you model these genealogies cleanly using foreign keys.

Here is a robust relational schema design, followed by the architectural rationale and alternative database options.

### Recommended Relational Schema

This schema splits data into four core entities: **Launches**, **Artifacts** (the physical objects with parent-child lineage), **Mission Metadata** (the "why"), and **Orbital State** (the tracking data).

```sql
-- 1. Launches: The event that sent items into space
CREATE TABLE launches (
    launch_id SERIAL PRIMARY KEY,
    cospar_launch_id VARCHAR(20) UNIQUE NOT NULL, -- e.g., '1969-059'
    launch_date TIMESTAMP WITH TIME ZONE,
    launch_site VARCHAR(100),
    launch_vehicle VARCHAR(100),
    owning_state VARCHAR(50)                      -- Country or agency (e.g., 'US', 'USSR')
);

-- 2. Artifacts: The physical objects (payloads, rocket bodies, debris, landers)
CREATE TABLE artifacts (
    artifact_id SERIAL PRIMARY KEY,
    jcat_id VARCHAR(20) UNIQUE NOT NULL,          -- GCAT primary ID (e.g., 'S00001')
    norad_cat_id INT UNIQUE,                      -- Satellite catalog number (links to CelesTrak)
    cospar_piece_id VARCHAR(25) UNIQUE NOT NULL,  -- e.g., '1969-059C'
    name VARCHAR(150) NOT NULL,                   -- e.g., 'Apollo 11 Lunar Module'
    object_type VARCHAR(20),                      -- 'Payload', 'Rocket Body', 'Debris', 'Lander'
    parent_jcat_id VARCHAR(20) REFERENCES artifacts(jcat_id), -- Genealogy link
    launch_id INT REFERENCES launches(launch_id),
    manufacturer VARCHAR(100),
    mass_kg FLOAT,
    decay_date TIMESTAMP WITH TIME ZONE           -- When it re-entered or landed
);

-- 3. Mission Metadata: The narrative context ("Why" and "Who")
CREATE TABLE mission_details (
    mission_id SERIAL PRIMARY KEY,
    artifact_id INT REFERENCES artifacts(artifact_id),
    primary_purpose VARCHAR(50),                  -- 'COMMUNICATIONS', 'ASTROMETRY', 'LUNAR_LANDER'
    mission_class VARCHAR(50),                    -- 'Civil', 'Military', 'Commercial'
    summary_text TEXT,                            -- Long-form description (from NSSDCA / GCAT)
    destination VARCHAR(50)                       -- 'LEO', 'Lunar Surface', 'Mars', 'Heliocentric'
);

-- 4. Orbital States: Live or historical tracking data (synced from CelesTrak)
CREATE TABLE orbital_states (
    state_id SERIAL PRIMARY KEY,
    norad_cat_id INT REFERENCES artifacts(norad_cat_id),
    epoch TIMESTAMP WITH TIME ZONE,
    orbital_regime VARCHAR(30),                   -- 'LEO', 'MEO', 'GEO', 'Deep Space'
    decay_status VARCHAR(30)                      -- 'Active', 'Inactive', 'Decayed', 'On Celestial Body'
);
```

### Why Structure It This Way?

1. **Self-Referencing Lineage (`parent_jcat_id`):** Space items split up. An upper stage releases a satellite, which drops a protective fairing, which later shatters into shrapnel. By referencing back to another row in the same `artifacts` table, you can write recursive queries to trace an entire family tree of space junk back to its single parent launch.
2. **Decoupling Static History from Dynamic State:** A spacecraft's launch date, manufacturer, and mission purpose *never change*. However, its orbital parameters or decay status change constantly. Keeping `artifacts` and `orbital_states` separate prevents massive data duplication and keeps updates clean.
3. **Natural Keys as Bridges:** Using **COSPAR IDs** and **NORAD IDs** as relational anchors allows you to seamlessly pull night-to-night orbital updates from CelesTrak and map them onto Jonathan McDowell's historical GCAT archives without overwriting metadata.

### Other Architectural Options to Consider

Depending on how you plan to query or visualize your dataset, three alternatives stand out:

#### 1. Graph Database (e.g., Neo4j)

- **How it works:** Instead of rows and foreign keys, items are **Nodes** (`:Artifact`, `:Launch`, `:Destination`) connected by **Edges** (`[:DEPLOYED]`, `[:FRAGMENTED_INTO]`, `[:LANDED_ON]`).
- **Why choose it:** Space genealogy is fundamentally a network. If you want to query *"Show me every piece of debris spawned by anti-satellite tests or rocket explosions, and trace what other objects they threatened,"* graph traversal queries are drastically simpler and faster than complex SQL recursive CTEs.

#### 2. Document Store / NoSQL (e.g., MongoDB)

- **How it works:** Stores data as nested JSON documents where each mission is a single document containing arrays of sub-components, telemetry logs, and narrative paragraphs.
- **Why choose it:** GCAT data structures and space mission profiles map very naturally to nested JSON. If you are building a web app that pulls up a single "mission dossier" page containing all sub-parts, a document store requires zero multi-table `JOIN` operations.

#### 3. Analytical Data Store / Lakehouse (e.g., DuckDB + Parquet files)

- **How it works:** Instead of a traditional server database, you ingest the raw TSV/CSV dumps from GCAT and CelesTrak directly into **DuckDB** and query them using SQL over compressed columnar files.
- **Why choose it:** If your main goal is data science, running complex text analysis, or string together scripts to clean and stitch records in Python (`pandas` / `polars`), DuckDB requires zero database administration, handles millions of rows instantly, and operates entirely locally.

---

## 5. Graph Database Design (Neo4j)

Designing a graph database (such as Neo4j) to model space artifacts mirrors the physical reality of space exploration. Space history is inherently network-driven: a single launch vehicle deploys multiple stages, which release payloads, which drop heat shields, and which eventually fragment or land on celestial bodies.

A property graph model captures this lineage, timeline, and narrative context cleanly without requiring complex multi-table SQL joins.

### 1. The Graph Schema Design

In a graph database, data is modeled as **Nodes** (entities with properties) connected by directed **Relationships** (edges with types and properties).

#### Core Nodes & Properties

- **`(:Artifact)`** — Represents any physical object (payload, rocket body, debris, lander, or sub-component).
  - *Properties:* `jcatId`, `noradId`, `name`, `objectType` (Payload, Rocket Body, Debris, Lander), `massKg`, `launchDate`, `decayDate`, `status`
- **`(:Launch)`** — Represents the historical launch event.
  - *Properties:* `cosparLaunchId`, `launchDate`, `launchSite`, `vehicleName`
- **`(:Organization)`** — Agencies, manufacturers, or operators.
  - *Properties:* `name`, `type` (Agency, Manufacturer, Operator), `country`
- **`(:Mission)`** — The overarching purpose and scientific goals.
  - *Properties:* `name`, `primaryPurpose`, `classification` (Civil, Military, Commercial)
- **`(:Location)`** — Where the artifact currently resides or ended up.
  - *Properties:* `name`, `regime` (LEO, GEO, Lunar Surface, Mars Surface, Heliocentric)

#### Core Relationships (Edges)

- `(Artifact)-[:LAUNCHED_ON]->(Launch)`
- `(Launch)-[:EXECUTED_BY]->(Organization)` (Who launched it)
- `(Artifact)-[:BUILT_BY]->(Organization)` (Who manufactured it)
- `(Artifact)-[:SERVES_MISSION]->(Mission)` (Why it exists)
- `(Artifact)-[:DEPLOYED_FROM | :SPAWNED_FROM]->(Artifact)` (**The Genealogy Link**: Captures parent-child splits, like a rocket shedding a fairing or an orbiter releasing a lander)
- `(Artifact)-[:LANDED_ON | :IMPACTED_ON | :ORBITING]->(Location)` (Where it rests or orbits)

### 2. Why a Graph Model Excels Here

1. **Native Genealogy and Splitting:** When an upper-stage rocket explodes or a spacecraft deploys multiple sub-satellites and covers, relational databases require recursive Common Table Expressions (CTEs) that quickly degrade in performance as depth increases. In a graph, tracing an item's lineage is a direct traversal (`(:Artifact)-[:SPAWNED_FROM*]->(:Artifact)`).
2. **Schema Flexibility:** Space artifacts have wildly varying metadata. A communications satellite has frequencies and orbital slots; a planetary rover has landing coordinates and scientific instruments; a discarded rocket body has dry mass and empty propellant tanks. Graph databases let you attach arbitrary properties to specific nodes without altering a rigid table schema.
3. **Storytelling and Traversal:** Graph databases allow you to ask narrative-driven questions natively—such as connecting a manufacturer to a launch vehicle, down to a specific deployed probe, and out to its final resting crater on the Moon.

### 3. Example Cypher Queries (How You'd Query the Story)

Once ingested from sources like GCAT, you can run graph traversals to extract full stories and timelines.

#### Trace the Complete Lineage of Apollo 11

This query follows the parent-child genealogy graph to show every hardware piece derived from the Apollo 11 launch:

```cypher
MATCH path = (l:Launch {cosparLaunchId: '1969-059'})<-[:LAUNCHED_ON]-(root:Artifact)-[:SPAWNED_FROM*0..3]->(child:Artifact)
RETURN path
```

#### Find All Artifacts Resting on the Lunar Surface and Their Builders

This query traverses from the lunar destination back to the physical objects and their manufacturers:

```cypher
MATCH (loc:Location {name: 'Moon'}),
      (art:Artifact)-[:LANDED_ON | :IMPACTED_ON]->(loc),
      (art)-[:BUILT_BY]->(org:Organization)
RETURN art.name AS Artifact, art.objectType AS Type, org.name AS Manufacturer, art.decayDate AS LandingDate
ORDER BY art.decayDate ASC
```
