"""Database connection and ETL bookkeeping helpers."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row


def dsn() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise SystemExit(
            "DATABASE_URL is not set. Copy .env.example to .env or export it."
        )
    return value


def connect() -> psycopg.Connection:
    """Open one connection with dict rows. Callers own the transaction."""
    return psycopg.connect(dsn(), row_factory=dict_row)


@contextmanager
def transaction(conn: psycopg.Connection) -> Iterator[psycopg.Connection]:
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


@contextmanager
def try_advisory_lock(conn: psycopg.Connection, name: str) -> Iterator[bool]:
    """Prevent overlapping runs of the same job.

    The lock is session-scoped and released explicitly, so a crashed process
    cannot leave it held after the connection closes.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(hashtext(%s)) AS locked", (name,))
        locked = bool(cur.fetchone()["locked"])
    try:
        yield locked
    finally:
        if locked:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (name,))


def start_run(
    conn: psycopg.Connection,
    *,
    source_id: str,
    job: str,
    release_tag: str | None = None,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO etl_run (source_id, job, release_tag, status)
            VALUES (%s, %s, %s, 'running')
            RETURNING run_id
            """,
            (source_id, job, release_tag),
        )
        return int(cur.fetchone()["run_id"])


def finish_run(
    conn: psycopg.Connection,
    run_id: int,
    *,
    status: str,
    rows_read: int = 0,
    rows_written: int = 0,
    notes: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl_run
               SET finished_at = now(),
                   status = %s,
                   rows_read = %s,
                   rows_written = %s,
                   notes = %s
             WHERE run_id = %s
            """,
            (status, rows_read, rows_written, notes, run_id),
        )
