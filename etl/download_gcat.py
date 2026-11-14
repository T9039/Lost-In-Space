"""Fetch the GCAT TSV tree into ``data/gcat``.

This command performs no database work. It is safe to re-run: existing files are
skipped unless ``--force`` is given, and every file is written atomically.

Usage:

    python -m etl.download_gcat
    python -m etl.download_gcat --no-launches
    python -m etl.download_gcat --only satcat,deepcat,landercat
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from etl import config


def session() -> requests.Session:
    retry = Retry(
        total=4,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "HEAD"),
    )
    http = requests.Session()
    http.headers.update({"User-Agent": config.USER_AGENT})
    http.mount("https://", HTTPAdapter(max_retries=retry))
    http.mount("http://", HTTPAdapter(max_retries=retry))
    return http


def fetch_text(http: requests.Session, url: str) -> str:
    response = http.get(url, timeout=60)
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"
    return response.text


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def discover_launch_files(http: requests.Session, base: str) -> list[str]:
    """Read the launch directory index and return the published .tsv names."""
    try:
        html = fetch_text(http, f"{base}/launch/")
    except requests.RequestException as exc:
        print(f"warning: could not list launch files: {exc}", file=sys.stderr)
        return []
    names = sorted(set(re.findall(r'href="(?:\./)?([^"/]+\.tsv)"', html)))
    return names


def first_comment(text: str) -> str | None:
    for line in text.splitlines():
        if line.startswith("#"):
            return line.lstrip("#").strip()
        if line.strip():
            break
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=config.DATA_DIR)
    parser.add_argument("--base", default=config.GCAT_TSV_BASE)
    parser.add_argument("--no-launches", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument(
        "--only",
        help="Comma-separated catalog or table names, e.g. satcat,deepcat,orgs",
    )
    args = parser.parse_args(argv)

    base = args.base.rstrip("/")
    data_dir: Path = args.data_dir
    only = {part.strip() for part in args.only.split(",")} if args.only else None
    http = session()

    targets: list[tuple[str, str, str]] = []
    if only is None:
        for name in config.CATALOG_FILES:
            targets.append((f"cat/{name}.tsv", "cat", name))
        for name in config.TABLE_FILES:
            targets.append((f"tables/{name}.tsv", "tables", name))
    else:
        for name in only:
            if name in config.CATALOG_FILES:
                targets.append((f"cat/{name}.tsv", "cat", name))
            elif name in config.TABLE_FILES:
                targets.append((f"tables/{name}.tsv", "tables", name))
            else:
                parser.error(f"unknown catalog or table: {name}")

    if not args.no_launches and only is None:
        for name in discover_launch_files(http, base):
            targets.append((f"launch/{name}", "launch", name))

    manifest = {
        "base": base,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "files": {},
    }
    downloads = skipped = failures = 0

    for relative, folder, name in targets:
        url = f"{base}/{relative}"
        dest = data_dir / relative
        if dest.exists() and not args.force:
            skipped += 1
            manifest["files"][relative] = {"bytes": dest.stat().st_size}
            continue
        try:
            text = fetch_text(http, url)
        except requests.RequestException as exc:
            print(f"error: {url}: {exc}", file=sys.stderr)
            failures += 1
            continue
        if not text.strip():
            print(f"error: {url}: empty response", file=sys.stderr)
            failures += 1
            continue
        write_atomic(dest, text)
        downloads += 1
        manifest["files"][relative] = {
            "bytes": dest.stat().st_size,
            "header": first_comment(text),
        }
        if name == "satcat":
            manifest["updated"] = first_comment(text)
        print(f"fetched {relative} ({dest.stat().st_size} bytes)")

    if not args.only:
        (data_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

    print(
        f"done: {downloads} downloaded, {skipped} skipped, {failures} failed",
        file=sys.stderr,
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
