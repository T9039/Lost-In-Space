# ETL pipeline

The loader is not implemented yet. This document pins the pipeline so the code
has one obvious shape.

```
download → staging (text) → normalise → resolve → curate → read models
```

Never write directly to canonical tables from a parsed file. Every step is
re-runnable and idempotent.

---

## 1. Download

| Source | Destination | Notes |
|---|---|---|
| `tsv/cat/*.tsv` | `data/gcat/cat/` | Core: `satcat`, `deepcat`, `hcocat`, `csocat`, `landercat`, `psatcat` |
| `tsv/launch/*.tsv` | `data/gcat/launch/` | 396 files; all are small |
| `tsv/tables/*.tsv` | `data/gcat/tables/` | `orgs`, `sites` at minimum |
| CelesTrak OMM | not persisted to disk | Straight into `gp_element` |

`data/` is gitignored. Record the GCAT release tag and retrieval time in
`source.last_release` / `source.retrieved_at` and in `etl_run.release_tag`.

Use a descriptive `User-Agent` and a single scheduled run. Do not re-download
inside a request handler.

---

## 2. Load staging

`copy` is the right tool: it preserves blanks and avoids type coercion.

```bash
psql "$DATABASE_URL" -c "\copy staging.gcat_object (jcat,satcat,launch_tag,piece,type,name,pl_name,ldate,parent,sdate,primary_body,ddate,status,dest,owner,state,manufacturer,bus,motor,mass,mass_flag,dry_mass,dry_flag,tot_mass,tot_flag,length,length_flag,diameter,diameter_flag,span,span_flag,shape,odate,perigee,perigee_flag,apogee,apogee_flag,inc,inc_flag,op_orbit,oqual,alt_names,source_file,source_row) FROM 'data/gcat/cat/satcat.clean.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\b')"
```

Notes:

- GCAT TSV files begin with `#` comment lines, including the header. Strip them
  before `copy`.
- Append `source_file` and `source_row` to every row when cleaning, otherwise the
  trailing two columns are missing. `source_row` is the data-row number, not the
  physical line number.
- `QUOTE E'\b'` disables quote handling, so literal quotes in names survive.
- Keep `source_file` and `source_row` for auditability.
- `landercat` goes to `staging.gcat_lander`, launches to `staging.gcat_launch`,
  and so on. It is never a phase source.
- A truncated download produces a short final row. Validate field counts before
  loading and fail the run instead of ingesting a partial catalog.

---

## 3. Normalise

### VagueDate

Implement one parser with one output shape:

```python
@dataclass
class VagueDate:
    raw: str
    best: datetime | None
    precision: str      # year | month | day | hour | minute | second | unknown
    approx: bool        # trailing '?'
```

Rules:

- Preserve `raw` byte-for-byte (trim trailing whitespace only).
- Detect precision from the fields present. `1969 Jul 20 2017:33` is `minute`.
- A trailing `?` sets `approx`, not a different precision.
- Never fill missing month/day with “January 1” and call it a real date; the
  precision column is what makes the placeholder honest.
- Store UTC; GCAT times are UTC.
- If parsing fails, write `best = NULL`, `precision = 'unknown'`, keep `raw`, and
  log the value. Do not drop the row.

### Numbers and flags

- Mass, length, diameter, span, perigee, apogee and inclination are text in
  staging. Parse to `numeric`/`double precision`; on failure, `NULL` and log.
- Preserve the flag column (`?`, `-`, blank) so the UI can say “estimated”.
- `Satcat` values like `NNA` or `NSO` are not numbers. Store them as text in
  `artifact_catalog_id`; only cast when the value matches `^[0-9]+$`.

---

## 4. Resolve identity

This is the hard part. The ETL proposes; a curator confirms.

1. **Seed artifacts.** For each selected object, take the first phase row and
   create one `artifact`.
2. **Add catalog aliases.** Every JCAT encountered for that artifact becomes an
   `artifact_catalog_id` with `scheme = 'JCAT'`. Add SATCAT and COSPAR values
   from the same rows.
3. **Group phases.**
   - Same `Satcat` and a continuous date range usually means one artifact.
   - A `Parent` that points at an EJCAT means “this came from that”.
   - `Status` in (`DSO`, `DSA`, `DSA IN`) means the next row is the same object
     under a new deep-space JCAT.
   - `Status` in (`LO`, `LOA`, `REFLT`) means a relaunch with a new catalog
     number.
   - `SatType` `PA` is an alias/lease entry. It describes the same hardware and
     must not become a second artifact.
4. **Write phases.** Order by start date, assign `seq`, set `parent_artifact_id`
   when the parent is already known.
5. **Write relations.** `deployed_from` for rovers released by landers,
   `component_of` for attached instruments, `left_behind_by` for explicitly
   abandoned crew equipment.

Anything unresolved stays `parent_ref_raw` only. Never guess on name alone.

---

## 5. Assign zones

Apply the rules in `docs/DATABASE.md` §6. Implement them as one SQL function so
the API and the ETL cannot disagree:

```sql
CREATE FUNCTION derive_zone(
    primary_body text,
    op_orbit text,
    world text
) RETURNS zone_kind ...
```

Order: Moon → Mars → Earth orbit → deep space → other.

Surface coordinates come from `staging.gcat_lander` (`Lon`, `Lat`, `World`,
`LSite`). Match by `jcat`, insert one `location` per site, and attach it to the
phase that is on the surface.

---

## 6. Validate before promoting

Run these after every load. None should return rows for a healthy release.

```sql
-- Duplicate JCAT within staging
SELECT jcat, count(*) FROM staging.gcat_object
GROUP BY jcat HAVING count(*) > 1;

-- Object rows whose launch tag has no launch record
SELECT DISTINCT o.launch_tag
FROM staging.gcat_object o
LEFT JOIN staging.gcat_launch l ON l.launch_tag = o.launch_tag
WHERE o.launch_tag IS NOT NULL
  AND o.launch_tag <> '-'
  AND l.launch_tag IS NULL;

-- Lander rows that do not appear in any object catalog
SELECT l.jcat, l.name
FROM staging.gcat_lander l
LEFT JOIN staging.gcat_object o ON o.jcat = l.jcat
WHERE o.jcat IS NULL;

-- Catalog values that would fail a numeric cast
SELECT DISTINCT satcat FROM staging.gcat_object
WHERE satcat IS NOT NULL AND satcat !~ '^[0-9]+$';

-- Phases with no resolved artifact (promotion check)
SELECT jcat_id FROM artifact_phase WHERE artifact_id IS NULL;
```

Also assert:

- every `artifact` has exactly one `primary_zone`
- every phase has `start_raw` when `start_best` is set
- every curated artifact has at least one `fact` with a `source_url`
- every `media` row has `license_name` and `credit`

---

## 7. CelesTrak job

`etl/celestrak_refresh.py` (to implement):

1. Read the curated SATCAT list:
   ```sql
   SELECT DISTINCT value::bigint
   FROM artifact_catalog_id
   WHERE scheme = 'SATCAT' AND value ~ '^[0-9]+$';
   ```
2. Fetch OMM JSON in one request per batch, with the configured `User-Agent`.
3. Upsert into `gp_element` on `(satcat_no, epoch)`.
4. Delete element sets older than 30 days for SATCATs no longer curated.
5. Write one `etl_run` row with counts and status.

Never fetch per user. Never store propagated positions.

---

## 8. Promote to canonical

Wrap the whole transform in one transaction:

```sql
BEGIN;
-- upsert source metadata
-- upsert organizations, sites
-- upsert launches
-- upsert artifacts, catalog ids, phases, relations
-- refresh materialized card view (when introduced)
INSERT INTO etl_run (...) VALUES (...) ;
COMMIT;
```

On failure, roll back and record `status = 'failed'` with the error in `notes`.
Staging keeps the evidence, so a retry never needs a re-download.

---

## 9. Commands (target)

```bash
python -m etl.download_gcat
python -m etl.load_staging
python -m etl.transform
python -m etl.celestrak_refresh
python -m etl.validate
```
