"""Configuration shared by the ETL commands.

Everything is environment-first. Paths default to the repository-local
``data/gcat`` directory, which is gitignored.
"""

from __future__ import annotations

import os
from pathlib import Path

# Base URL of the GCAT TSV tree. The /data/ tarballs are ignored: the TSV tree
# is cleaner to ingest and has one file per object catalog.
GCAT_TSV_BASE = os.getenv(
    "GCAT_TSV_BASE", "https://planet4589.org/space/gcat/tsv"
).rstrip("/")

# Where downloads land. Override with ETL_DATA_DIR for tests or a mounted volume.
DATA_DIR = Path(os.getenv("ETL_DATA_DIR", "data/gcat"))

# A descriptive User-Agent is required by CelesTrak's usage policy and is polite
# to GCAT. Put a real contact URL here before deploying.
USER_AGENT = os.getenv(
    "ETL_USER_AGENT",
    "lost-in-space-etl/0.1 (+https://github.com/T9039/Lost-In-Space)",
)

# Object catalogs that share the 42-column layout.
CATALOG_FILES = (
    "satcat",
    "deepcat",
    "hcocat",
    "csocat",
    "landercat",
    "psatcat",
)

# Lookup tables.
TABLE_FILES = ("orgs", "sites")

# Number of rows per COPY batch. psycopg streams, so this only bounds memory
# for the generator.
COPY_BATCH = 5_000
