# Migrations

The baseline schema is `db/schema.sql`. It is applied once to an empty database,
followed by `db/seed/001_lookups.sql` and `db/staging.sql`.

After the baseline has been applied anywhere, schema changes go here as
forward-only, numbered SQL files:

```text
db/migrations/001_add_artifact_status.sql
db/migrations/002_media_model_rows.sql
```

Rules:

- Apply in filename order.
- Never edit a migration after it has been applied outside your machine.
- A destructive change is split into: add the new shape, backfill, switch reads,
  then drop in a later migration.
- Record the applied filename in `schema_migrations` when the migration runner
  lands.
- CI must apply every migration to an empty database.

There are no migrations yet; the baseline is the current schema.
