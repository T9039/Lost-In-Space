"""Tests for the strict text parsers and the staging row reader."""

from pathlib import Path

import pytest

from etl import load_staging, parse


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("7790", 7790.0),
        (" 28.0 ", 28.0),
        ("-", None),
        ("", None),
        ("*", None),
        ("?", None),
        ("abc", None),
        ("1,234.5", 1234.5),
    ],
)
def test_parse_float(raw, expected):
    assert parse.parse_float(raw) == expected


def test_clean_strips_and_nulls():
    assert parse.clean("  Eagle  ") == "Eagle"
    assert parse.clean("-") is None
    assert parse.clean("*") is None
    assert parse.clean(None) is None


def test_flag_preserved():
    assert parse.parse_flag("?") == "?"
    assert parse.parse_flag("") is None
    assert parse.parse_flag(" ") is None


def test_is_numeric():
    assert parse.is_numeric("00005") is True
    assert parse.is_numeric("NNA") is False
    assert parse.is_numeric("-") is False


def test_cospar_piece():
    assert parse.cospar_piece("1969-059C") == "1969-059C"
    assert parse.cospar_piece("2020-052A") == "2020-052A"
    assert parse.cospar_piece("1957 ALP 1") is None
    assert parse.cospar_piece("-") is None


def test_data_rows_skips_comments_and_counts_fields(tmp_path: Path):
    path = tmp_path / "sample.tsv"
    path.write_text(
        "#JCAT\tName\n# Updated 2026 Nov 13\nS00001\tEagle\nS00002\tColumbia\n",
        encoding="utf-8",
    )
    rows = list(load_staging.data_rows(path, expected=2))
    assert rows == [(["S00001", "Eagle"], 1), (["S00002", "Columbia"], 2)]


def test_data_rows_rejects_short_rows(tmp_path: Path):
    path = tmp_path / "bad.tsv"
    path.write_text("#JCAT\tName\nS00001\n", encoding="utf-8")
    with pytest.raises(ValueError, match="expected 2 fields"):
        list(load_staging.data_rows(path, expected=2))
