"""The single VagueDate parser.

GCAT publishes dates such as ``1969 Jul 20 2017:33``, ``1969 Jul``, ``1969``,
``1970s`` and ``2010 Q3``. Precision is real information and must survive into
the database, so this module returns all four parts together:

    VagueDate(raw, best, precision, approx)

Rules:

* ``raw`` is the published string, trimmed but otherwise unchanged.
* ``best`` is the best UTC interpretation, or ``None`` when there is none.
* ``precision`` is one of year, month, day, hour, minute, second, unknown.
* ``approx`` is true when the source wrote a trailing ``?``.

A decade or a quarter has no exact precision in the schema, so it is stored as
``unknown`` with ``best`` set to the start of the period. The UI must render the
raw string in that case; the normalised value exists only for ordering.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone

MONTHS = {
    "Jan": 1,
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9,
    "Oct": 10,
    "Nov": 11,
    "Dec": 12,
}

PRECISIONS = (
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
    "unknown",
)

_DECADE = re.compile(r"^(\d{4})s$")
_QUARTER = re.compile(r"^(\d{4})\s+Q([1-4])$")
_YEAR = re.compile(r"^(\d{4})$")
_MONTH = re.compile(r"^(\d{4})\s+([A-Z][a-z]{2})$")
_FULL = re.compile(
    r"^(\d{4})\s+([A-Z][a-z]{2})\s+(\d{1,2})"
    r"(?:\s+(\d{2})(\d{2})(?::(\d{2}))?)?$"
)
_HOUR_MINUTE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")


@dataclass(frozen=True)
class VagueDate:
    raw: str
    best: datetime | None
    precision: str
    approx: bool

    def as_row(self) -> tuple[str, datetime | None, str, bool]:
        """Return the four values in the order the schema expects."""
        return (self.raw, self.best, self.precision, self.approx)


def _utc(year: int, month: int, day: int, hour: int = 0, minute: int = 0, second: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


def parse(raw: str | None) -> VagueDate:
    """Parse one GCAT date string. Never raises; unknown values are preserved."""
    if raw is None:
        return VagueDate("", None, "unknown", False)

    text = str(raw).strip()
    if text in ("", "-", "*"):
        return VagueDate(text, None, "unknown", False)

    approx = text.endswith("?")
    body = text[:-1].rstrip() if approx else text

    try:
        match = _DECADE.fullmatch(body)
        if match:
            return VagueDate(text, _utc(int(match.group(1)), 1, 1), "unknown", approx)

        match = _QUARTER.fullmatch(body)
        if match:
            year = int(match.group(1))
            month = (int(match.group(2)) - 1) * 3 + 1
            return VagueDate(text, _utc(year, month, 1), "unknown", approx)

        match = _YEAR.fullmatch(body)
        if match:
            return VagueDate(text, _utc(int(match.group(1)), 1, 1), "year", approx)

        match = _MONTH.fullmatch(body)
        if match and match.group(2) in MONTHS:
            return VagueDate(
                text,
                _utc(int(match.group(1)), MONTHS[match.group(2)], 1),
                "month",
                approx,
            )

        match = _FULL.fullmatch(body)
        if match and match.group(2) in MONTHS:
            year = int(match.group(1))
            month = MONTHS[match.group(2)]
            day = int(match.group(3))
            if match.group(4) is None:
                best = _utc(year, month, day)
                precision = "day"
            else:
                hour = int(match.group(4))
                minute = int(match.group(5))
                if match.group(6) is None:
                    best = _utc(year, month, day, hour, minute)
                    precision = "minute"
                else:
                    best = _utc(year, month, day, hour, minute, int(match.group(6)))
                    precision = "second"
            return VagueDate(text, best, precision, approx)

        match = _HOUR_MINUTE.fullmatch(body)
        if match:
            precision = "second" if match.group(3) else "minute"
            return VagueDate(text, None, precision, approx)
    except ValueError:
        # Invalid day or month: preserve the raw value and report no precision.
        pass

    return VagueDate(text, None, "unknown", approx)


def format_for_display(value: VagueDate) -> str:
    """Render a VagueDate without inventing precision.

    This is a small reference implementation for the UI and for tests. The web
    application owns the real formatting.
    """
    if value.best is None:
        return value.raw or "unknown"
    if value.precision == "unknown":
        return value.raw or value.best.isoformat()
    if value.precision == "year":
        return f"{value.best.year}"
    if value.precision == "month":
        return value.best.strftime("%B %Y")
    if value.precision == "day":
        return value.best.strftime("%-d %B %Y")
    if value.precision == "hour":
        return value.best.strftime("%-d %B %Y, %H:00 UTC")
    if value.precision == "minute":
        return value.best.strftime("%-d %B %Y, %H:%M UTC")
    return value.best.strftime("%-d %B %Y, %H:%M:%S UTC")
